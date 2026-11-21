// Limits for a run, worked out from the game's own rules in index.html:
//   speed     = 24 + 38 * (1 - exp(-dist / 3000)) m/s   (tops out at 62 m/s)
//   barriers  = one every max(0.85 * speed, 56 - 0.005 * dist) m
//   bonuses   = per barrier at most 25 (near miss) + 4 x 15 (pickup trail) = 85
// Score = metres travelled + bonuses.
export const MAX_BONUS_PER_GATE = 85;
// Points per second at top speed with every possible bonus: 62 + 62 / 52.7 * 85 = about 162.
export const TOP_RATE = 165;
// The game checks in every 30 s while a run is going (also while paused). Without a check-in for
// longer than this, the score may only rise by what this many seconds of play can give.
export const MAX_SILENCE = 150;

// Most points a run can have after `seconds` of play, if every barrier pays `perGate`.
export function bestPossible(seconds, perGate = MAX_BONUS_PER_GATE) {
  const dt = 0.25;
  const steps = Math.min(Math.ceil(Math.max(0, seconds) / dt), 4 * 4 * 3600);
  let d = 0, s = 0;
  for (let i = 0; i < steps; i++) {
    const v = 24 + 38 * (1 - Math.exp(-d / 3000));
    const gap = Math.max(v * 0.85, 56 - d * 0.005);
    d += v * dt;
    s += v * dt + (v / gap) * perGate * dt;
  }
  return s;
}

// The hard ceiling a submitted score must stay under (5 % and 300 points of slack).
export const ceilingFor = (seconds) => bestPossible(seconds) * 1.05 + 300;
// Above this a run is better than strong human play (near miss on every barrier plus most pickups).
export const fastFor = (seconds) => bestPossible(seconds, 45);

// Checks the run's timeline: the start, the heartbeats sent during play, and the final score.
// Returns { ok, reason, flags, cps, gap }.
export function checkRun({ startedAt, now, score, checkpoints }) {
  const elapsed = (now - startedAt) / 1000;
  const flags = [];
  if (!Number.isFinite(elapsed) || elapsed <= 0) return { ok: false, reason: 'time' };
  if (score > ceilingFor(elapsed)) return { ok: false, reason: 'ceiling' };

  const cps = checkpoints
    .map((c) => String(c).split(':').map(Number))
    .filter(([t, s]) => Number.isFinite(t) && Number.isInteger(s) && t >= startedAt && t <= now)
    .sort((a, b) => a[0] - b[0]);
  const line = [[startedAt, 0], ...cps, [now, score]];
  let gap = 0;
  for (let i = 1; i < line.length; i++) {
    const dt = (line[i][0] - line[i - 1][0]) / 1000;
    const gain = line[i][1] - line[i - 1][1];
    // the score never goes down during a run, and cannot rise faster than the top rate
    if (gain < 0) { flags.push('MISMATCH'); continue; }
    if (gain > TOP_RATE * Math.min(dt, MAX_SILENCE) * 1.05 + 300) return { ok: false, reason: dt > MAX_SILENCE ? 'silent' : 'jump' };
    if (gain > 2000) gap = Math.max(gap, dt);
  }
  if (elapsed > 120 && cps.length === 0) flags.push('NO CHECKS');
  if (gap > 150) flags.push('GAP');
  if (score > fastFor(elapsed)) flags.push('FAST');
  return { ok: true, flags: [...new Set(flags)], cps: cps.length, gap: Math.round(gap), elapsed };
}
