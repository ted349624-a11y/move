import crypto from 'node:crypto';
import { redis, KEYS, noDb } from '../lib/redis.js';

// Admin password. Set ADMIN_PASSWORD in Vercel (Settings > Environment Variables) to use your own.
// Without it, the built-in password is checked against this scrypt hash; the password itself is not stored here.
const BUILTIN = { salt: 'f347bd2e18d971f36287b6960fc51477', hash: '0e516fc3f1b1588868d5c455d0e8ae4c442c362a71883eacd1353c43fd8d9174' };
const MAX_FAILS = 10;          // wrong passwords allowed per IP ...
const FAIL_WINDOW = 15 * 60;   // ... per 15 minutes
const NAME_MAX = 40;

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
function passwordOk(pw) {
  if (typeof pw !== 'string' || !pw || pw.length > 200) return false;
  const own = process.env.ADMIN_PASSWORD;
  if (own) return crypto.timingSafeEqual(sha(pw), sha(own));
  const got = crypto.scryptSync(pw, Buffer.from(BUILTIN.salt, 'hex'), 32);
  return crypto.timingSafeEqual(got, Buffer.from(BUILTIN.hash, 'hex'));
}
const toInt = (v, min, max, dflt) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};
const cleanNames = (list) => (Array.isArray(list) ? list : [])
  .filter((n) => typeof n === 'string' && n.length > 0 && n.length <= NAME_MAX)
  .slice(0, 200);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!redis) return noDb(res);

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  try {
    const fails = Number((await redis.get(KEYS.adminFail(ip))) || 0);
    if (fails >= MAX_FAILS) {
      return res.status(429).json({ error: 'Too many wrong passwords. Try again in 15 minutes.' });
    }
    const auth = String(req.headers.authorization || '');
    if (!passwordOk(auth.startsWith('Bearer ') ? auth.slice(7) : '')) {
      await redis.incr(KEYS.adminFail(ip));
      await redis.expire(KEYS.adminFail(ip), FAIL_WINDOW);
      return res.status(401).json({ error: 'Wrong password.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = null; }
    }
    body = body && typeof body === 'object' ? body : {};

    if (body.action === 'list') {
      const offset = toInt(body.offset, 0, 1_000_000, 0);
      const limit = toInt(body.limit, 1, 2000, 200);
      const [raw, total, xusers] = await Promise.all([
        redis.zrange(KEYS.board, offset, offset + limit - 1, { rev: true, withScores: true }),
        redis.zcard(KEYS.board),
        redis.hlen(KEYS.xusers),
      ]);
      const entries = [];
      for (let i = 0; i < raw.length; i += 2) entries.push({ name: String(raw[i]), score: Number(raw[i + 1]) });
      return res.status(200).json({ entries, total: Number(total), xusers: Number(xusers), offset });
    }

    if (body.action === 'live') {
      const keys = [];
      let cursor = '0';
      for (let i = 0; i < 30; i++) {
        const [next, batch] = await redis.scan(cursor, { match: KEYS.livePattern, count: 1000 });
        keys.push(...batch);
        cursor = String(next);
        if (cursor === '0' || keys.length >= 5000) break;
      }
      const values = keys.length ? await redis.mget(...keys.slice(0, 5000)) : [];
      const players = [];
      for (const v of values) {
        if (!v) continue;
        try { const p = JSON.parse(v); players.push({ user: String(p.user || ''), score: Number(p.score) || 0, dist: Number(p.dist) || 0, t: Number(p.t) || 0, at: Number(p.at) || 0 }); } catch {}
      }
      players.sort((a, b) => b.score - a.score);
      return res.status(200).json({ count: players.length, players: players.slice(0, 200), now: Date.now() });
    }

    if (body.action === 'delete') {
      const names = cleanNames(body.names);
      if (!names.length) return res.status(400).json({ error: 'No names given.' });
      // keep a record of what was removed, so a mistake can be put back
      const scores = await Promise.all(names.map((n) => redis.zscore(KEYS.board, n)));
      const at = new Date().toISOString();
      const records = names.map((name, i) => ({ name, score: scores[i] == null ? null : Number(scores[i]), at, by: ip }))
        .filter((r) => r.score != null);
      if (records.length) {
        await redis.lpush(KEYS.adminLog, ...records.map((r) => JSON.stringify(r)));
        await redis.ltrim(KEYS.adminLog, 0, 4999);
      }
      const removed = await redis.zrem(KEYS.board, ...names);
      const total = await redis.zcard(KEYS.board);
      console.log('admin delete', JSON.stringify(records));
      return res.status(200).json({ removed: Number(removed), total: Number(total), deleted: records });
    }

    if (body.action === 'restore') {
      const entries = (Array.isArray(body.entries) ? body.entries : [])
        .filter((e) => e && typeof e.name === 'string' && e.name.length > 0 && e.name.length <= NAME_MAX && Number.isInteger(e.score) && e.score >= 0 && e.score <= 10_000_000)
        .slice(0, 200);
      if (!entries.length) return res.status(400).json({ error: 'Nothing to restore.' });
      await redis.zadd(KEYS.board, ...entries.map((e) => ({ score: e.score, member: e.name })));
      const total = await redis.zcard(KEYS.board);
      console.log('admin restore', JSON.stringify(entries));
      return res.status(200).json({ restored: entries.length, total: Number(total) });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('admin error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
