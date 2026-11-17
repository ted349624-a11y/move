import { redis, KEYS, noDb } from '../lib/redis.js';

const LIMIT = 25;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!redis) return noDb(res);

  try {
    const [raw, total] = await Promise.all([
      redis.zrange(KEYS.board, 0, LIMIT - 1, { rev: true, withScores: true }),
      redis.zcard(KEYS.board),
    ]);

    const entries = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ name: String(raw[i]), score: Number(raw[i + 1]) });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15');
    return res.status(200).json({ entries, total: Number(total) });
  } catch (err) {
    console.error('leaderboard error', err);
    return res.status(500).json({ error: 'Could not load the leaderboard.' });
  }
}
