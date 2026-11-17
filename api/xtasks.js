import { redis, KEYS, noDb } from '../lib/redis.js';

const USER_RE = /^[A-Za-z0-9_]{1,15}$/;

// Records the X username of a player who finished the one-time access steps.
// X does not let a website check likes, reposts or replies without its paid API,
// so this is a list of who went through the steps, to review by hand if needed.
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
  const username = String((body && body.username) || '').trim().replace(/^@/, '');
  if (!USER_RE.test(username)) {
    return res.status(400).json({ error: 'Invalid X username.' });
  }

  try {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const allowed = await redis.set(KEYS.xrate(ip), '1', { nx: true, ex: 5 });
    if (!allowed) return res.status(429).json({ error: 'Too many requests. Try again in a moment.' });

    const added = await redis.hsetnx(
      KEYS.xusers,
      username.toLowerCase(),
      JSON.stringify({ username, completedAt: new Date().toISOString() })
    );
    const total = await redis.hlen(KEYS.xusers);
    return res.status(200).json({ ok: true, new: Boolean(added), total: Number(total) });
  } catch (err) {
    console.error('xtasks error', err);
    return res.status(500).json({ error: 'Could not save.' });
  }
}
