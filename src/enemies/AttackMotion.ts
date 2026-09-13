/** Contact is shared by gameplay and all ordinary creature animation curves. */
export const STRIKE_CONTACT = 0.42;
export const STRIKE_DURATION = {
  armor: 0.56,
  spider: 0.38,
  wolf: 0.42,
  golem: 0.8,
  thornling: 0.5,
} as const;
const smooth = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
/** -1 = fully drawn back, +1 = contact, 0 = resting after follow-through. */
export function strikePose(windup: number, progress: number) {
  if (progress <= 0) return -smooth(windup);
  if (progress <= STRIKE_CONTACT) return -1 + 2 * smooth(progress / STRIKE_CONTACT);
  return 1 - smooth((progress - STRIKE_CONTACT) / (1 - STRIKE_CONTACT));
}
/** A full draw, impact and release for each authored Reaper scythe beat. */
export function reaperStrikePose(
  windup: number,
  elapsed: number,
  beats: readonly number[],
  heavy: boolean,
) {
  if (elapsed <= 0) return -smooth(windup);
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i],
      start = beat - (heavy ? 0.32 : 0.12),
      draw = Math.max(0, start - 0.14);
    if (elapsed < draw) return 0;
    if (elapsed < start) return -smooth((elapsed - draw) / (start - draw));
    if (elapsed <= beat) return -1 + 2 * smooth((elapsed - start) / (beat - start));
    if (elapsed < beat + 0.26) return 1 - smooth((elapsed - beat) / 0.26);
  }
  return 0;
}
