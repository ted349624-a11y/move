import { redis, KEYS, noDb } from '../lib/redis.js';

const ID_RE = /^[a-z0-9]{8,32}$/;
const USER_RE = /^[A-Za-z0-9_]{1,15}$/;
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RUN_TTL = 2 * 60 * 60; // a run token lives 2 hours
const TTL = 75; // seconds; the game sends a heartbeat every 30 s while a run is going
const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);

// Heartbeat from a running game: feeds the admin "Live now" panel and, with the run token,
// records a time:score checkpoint that /api/score checks the final score against.
// One request to Redis per call (a pipeline), or a DEL when the run ends.
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
  if (!body || typeof body !== 'object' || typeof body.id !== 'string' || !ID_RE.test(body.id)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  try {
    if (body.end) {
      await redis.del(KEYS.live(body.id));
      return res.status(200).json({ ok: true });
    }
    const user = typeof body.user === 'string' && USER_RE.test(body.user) ? body.user : '';
    const data = { user, score: int(body.score, 10_000_000), dist: int(body.dist, 10_000_000), t: int(body.t, 86_400), at: Date.now() };
    const p = redis.pipeline();
    p.set(KEYS.live(body.id), JSON.stringify(data), { ex: TTL });
    if (typeof body.token === 'string' && TOKEN_RE.test(body.token) && Number.isInteger(body.score) && body.score >= 0) {
      p.rpush(KEYS.cp(body.token), `${data.at}:${data.score}`);
      p.expire(KEYS.cp(body.token), RUN_TTL);
    }
    await p.exec();
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('live error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
