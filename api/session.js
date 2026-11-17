import crypto from 'node:crypto';
import { redis, KEYS, noDb } from '../lib/redis.js';

// Called when a run starts. The server remembers when it started so a
// submitted score can be checked against the real time that was played.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!redis) return noDb(res);

  try {
    const token = crypto.randomUUID();
    await redis.set(KEYS.session(token), String(Date.now()), { ex: 60 * 60 * 2 });
    return res.status(200).json({ token });
  } catch (err) {
    console.error('session error', err);
    return res.status(500).json({ error: 'Could not start a session.' });
  }
}
