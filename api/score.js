import { redis, KEYS, noDb } from '../lib/redis.js';
import { checkRun } from '../lib/runcheck.js';

const NAME_RE = /^[A-Za-z0-9 _.\-]{2,16}$/;
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
  if (!Number.isInteger(score) || score < 1 || score > 10_000_000) {
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

    // The heartbeats the game sent during this run (time:score), then forget them.
    const p = redis.pipeline();
    p.lrange(KEYS.cp(token), 0, 999);
    p.del(KEYS.cp(token));
    const [cpRaw] = await p.exec();
    const now = Date.now();
    const run = checkRun({ startedAt: Number(startedAt), now, score, checkpoints: Array.isArray(cpRaw) ? cpRaw : [] });
    if (!run.ok) {
      console.warn('score rejected', run.reason, name, score);
      return res.status(422).json({ error: 'Score could not be verified.' });
    }

    // Keep only each player's best score.
    await redis.zadd(KEYS.board, { gt: true }, { score, member: name });

    const [bestRaw, totalRaw] = await Promise.all([
      redis.zscore(KEYS.board, name),
      redis.zcard(KEYS.board),
    ]);
    // How this run went, kept for the admin page when it is the player's best.
    if (Number(bestRaw) === score) {
      await redis.hset(KEYS.runs, { [name]: JSON.stringify({ score, sec: Math.round(run.elapsed), cps: run.cps, gap: run.gap, flags: run.flags, at: now }) });
    }
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
