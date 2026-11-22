import { Redis } from '@upstash/redis';

// Works with both the Vercel Marketplace integration (KV_REST_API_*)
// and a manually created Upstash database (UPSTASH_REDIS_REST_*).
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const redis = url && token
  ? new Redis({ url, token, automaticDeserialization: false })
  : null;

// Neon Tunnel Runner has its own leaderboard (the old Chroma Ring data stays untouched).
export const KEYS = {
  board: 'ntr:leaderboard',
  session: (id) => `ntr:session:${id}`,
  rate: (ip) => `ntr:rate:${ip}`,
  // X usernames of players who finished the one-time access steps
  xusers: 'ntr:xusers',
  xrate: (ip) => `ntr:xrate:${ip}`,
  // admin page
  adminFail: (ip) => `ntr:adminfail:${ip}`,
  adminLog: 'ntr:admin:deleted',
  // players in a run right now (each key expires shortly after its last heartbeat)
  live: (id) => `ntr:live:${id}`,
  livePattern: 'ntr:live:*',
  // whitelist sign-ups: X username -> { username, wallet, at }, and wallet -> username
  wl: 'ntr:wl',
  wlWallets: 'ntr:wl:wallets',
  wlRate: (ip) => `ntr:wlrate:${ip}`,
  ad: 'ntr:airdrop',
  cp: (token) => `ntr:cp:${token}`,
  runs: 'ntr:runs',
  owner: 'ntr:owner',          // player name -> sha256 of the device key that protects it
  gtd: 'ntr:gtd',              // player name -> GTD wallet record
  gtdWallets: 'ntr:gtd:wallets',
  gtdRate: (ip) => `ntr:gtdrate:${ip}`,
  adWallets: 'ntr:airdrop:wallets',
  adRate: (ip) => `ntr:adrate:${ip}`,
};

export function noDb(res) {
  return res.status(500).json({ error: 'Database is not configured on the server.' });
}
