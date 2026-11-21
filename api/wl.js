import { redis, KEYS, noDb } from '../lib/redis.js';

const USER_RE = /^[A-Za-z0-9_]{1,15}$/;
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

// GET: how many have joined. POST { username, wallet }: join the whitelist.
// One entry per X username and one per wallet; the first sign-up keeps it.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!redis) return noDb(res);

  if (req.method === 'GET') {
    try {
      return res.status(200).json({ count: Number(await redis.hlen(KEYS.wl)) });
    } catch (err) {
      console.error('wl count error', err);
      return res.status(500).json({ error: 'Server error.' });
    }
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // The whitelist is closed: no new sign-ups. The list stays in Redis for the admin export.
  const CLOSED = true;
  if (CLOSED) return res.status(403).json({ error: 'The whitelist is closed.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const username = String((body && body.username) || '').trim().replace(/^@/, '');
  const wallet = String((body && body.wallet) || '').trim();
  if (!USER_RE.test(username)) return res.status(400).json({ error: 'Invalid X username.' });
  if (!EVM_RE.test(wallet)) return res.status(400).json({ error: 'Paste an EVM address: 0x followed by 40 characters.' });

  try {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const allowed = await redis.set(KEYS.wlRate(ip), '1', { nx: true, ex: 5 });
    if (!allowed) return res.status(429).json({ error: 'Too many requests. Try again in a few seconds.' });

    const userKey = username.toLowerCase();
    const walletKey = wallet.toLowerCase();
    const existing = await redis.hget(KEYS.wl, userKey);
    if (existing) {
      let prev = {};
      try { prev = JSON.parse(existing); } catch {}
      const same = String(prev.wallet || '').toLowerCase() === wallet.toLowerCase();
      if (!same) return res.status(409).json({ error: 'This X account is already on the whitelist with another wallet.' });
      return res.status(200).json({ ok: true, already: true, count: Number(await redis.hlen(KEYS.wl)) });
    }
    const owner = await redis.hget(KEYS.wlWallets, walletKey);
    if (owner && owner !== userKey) return res.status(409).json({ error: 'This wallet is already registered with another X account.' });

    await redis.hsetnx(KEYS.wlWallets, walletKey, userKey);
    const added = await redis.hsetnx(KEYS.wl, userKey, JSON.stringify({ username, wallet, at: new Date().toISOString() }));
    const count = Number(await redis.hlen(KEYS.wl));
    return res.status(200).json({ ok: true, already: !added, count });
  } catch (err) {
    console.error('wl error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
