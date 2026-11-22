import { createHash, randomUUID } from 'node:crypto';
import { redis, KEYS, noDb } from '../lib/redis.js';

export const GTD_TOP = 400;
const NAME_RE = /^[A-Za-z0-9 _.\-]{2,16}$/;
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const KEY_RE = /^[0-9a-f-]{36}$/;
const hash = (k) => createHash('sha256').update(String(k)).digest('hex');

// POST { name, wallet, key? }: save the EVM wallet for a player name in the top 400 (GTD spot).
// A name is protected by a key that only the device holding it knows: the device that set the
// name's best score (issued by /api/score), or the device that first saved a wallet for it.
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
  body = body && typeof body === 'object' ? body : {};
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const wallet = String(body.wallet || '').trim();
  const key = typeof body.key === 'string' && KEY_RE.test(body.key) ? body.key : '';
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'Enter the name you play with (2-16 characters).' });
  if (!EVM_RE.test(wallet)) return res.status(400).json({ error: 'Paste an EVM address: 0x followed by 40 characters.' });

  try {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const allowed = await redis.set(KEYS.gtdRate(ip), '1', { nx: true, ex: 5 });
    if (!allowed) return res.status(429).json({ error: 'Too many requests. Try again in a few seconds.' });

    const p = redis.pipeline();
    p.zrevrank(KEYS.board, name);
    p.hget(KEYS.gtd, name);
    p.hget(KEYS.owner, name);
    p.hget(KEYS.gtdWallets, wallet.toLowerCase());
    const [rankRaw, claimRaw, ownerHash, walletOwner] = await p.exec();

    if (rankRaw === null || rankRaw === undefined) return res.status(404).json({ error: 'No score found for this name. Use the exact name from the leaderboard.' });
    const rank = Number(rankRaw) + 1;
    if (rank > GTD_TOP) return res.status(403).json({ error: `Only the top ${GTD_TOP} get a GTD spot. ${name} is #${rank.toLocaleString('en-US')}.` });

    const keyHash = key ? hash(key) : '';
    let claim = null;
    if (claimRaw) { try { claim = typeof claimRaw === 'string' ? JSON.parse(claimRaw) : claimRaw; } catch {} }
    if (claim) {
      if (!keyHash || keyHash !== claim.keyHash) return res.status(409).json({ error: 'A wallet is already saved for this name. Only the device that saved it can change it.' });
    } else if (ownerHash && keyHash !== ownerHash) {
      return res.status(403).json({ error: 'This name is protected. Save your wallet from the device that set its best score.' });
    }
    if (walletOwner && walletOwner !== name) return res.status(409).json({ error: 'This wallet is already saved for another player.' });

    // the key the device keeps for this name (reuse the one it sent, or issue one)
    const deviceKey = key || randomUUID();
    const h = hash(deviceKey);
    const record = { name, wallet, at: new Date().toISOString(), keyHash: h, verified: claim ? Boolean(claim.verified) : Boolean(ownerHash) };
    const w = redis.pipeline();
    if (claim && claim.wallet && claim.wallet.toLowerCase() !== wallet.toLowerCase()) w.hdel(KEYS.gtdWallets, claim.wallet.toLowerCase());
    w.hset(KEYS.gtdWallets, { [wallet.toLowerCase()]: name });
    w.hset(KEYS.gtd, { [name]: JSON.stringify(record) });
    w.hsetnx(KEYS.owner, name, h); // from now on the name is protected
    await w.exec();
    return res.status(200).json({ ok: true, rank, wallet, key: deviceKey, updated: Boolean(claim) });
  } catch (err) {
    console.error('gtd error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
