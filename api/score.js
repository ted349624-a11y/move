import { redis, KEYS, noDb } from '../lib/redis.js';

const NAME_RE = /^[A-Za-z0-9 _.\-]{2,16}$/;
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Best case is ~2.2 orbs per second at a x5 multiplier, so anything above
// this rate cannot come from real play.
const MAX_POINTS_PER_SEC = 12;
const GRACE_POINTS = 20;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!redis) return noDb(res);

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const { score, token } = body;

  if (!NAME_RE.test(name)) {
    return res.status(400).json({ error: 'Name must be 2-16 characters: letters, numbers, spaces, _ - .' });
  }
  if (!Number.isInteger(score) || score < 1 || score > 1_000_000) {
    return res.status(400).json({ error: 'Invalid score.' });
  }
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) {
    return res.status(400).json({ error: 'This run could not be verified. Check your connection and play again.' });
  }

  try {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const allowed = await redis.set(KEYS.rate(ip), '1', { nx: true, ex: 3 });
    if (!allowed) {
      return res.status(429).json({ error: 'Too many submissions. Try again in a moment.' });
    }

    // Each run token can be used exactly once.
    const startedAt = await redis.getdel(KEYS.session(token));
    if (!startedAt) {
      return res.status(403).json({ error: 'This run has expired or was already submitted.' });
    }

    const elapsed = (Date.now() - Number(startedAt)) / 1000;
    if (!Number.isFinite(elapsed) || score > elapsed * MAX_POINTS_PER_SEC + GRACE_POINTS) {
      return res.status(422).json({ error: 'Score could not be verified.' });
    }

    // Keep only each player's best score.
    await redis.zadd(KEYS.board, { gt: true }, { score, member: name });

    const [bestRaw, totalRaw] = await Promise.all([
      redis.zscore(KEYS.board, name),
      redis.zcard(KEYS.board),
    ]);
    const best = Number(bestRaw);
    const higher = await redis.zcount(KEYS.board, `(${best}`, '+inf');

    return res.status(200).json({
      ok: true,
      name,
      score,
      best,
      rank: Number(higher) + 1,
      total: Number(totalRaw),
    });
  } catch (err) {
    console.error('score error', err);
    return res.status(500).json({ error: 'Could not save your score.' });
  }
}
