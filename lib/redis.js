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
};

export function noDb(res) {
  return res.status(500).json({ error: 'Database is not configured on the server.' });
}
