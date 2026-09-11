export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const damp = (a: number, b: number, speed: number, dt: number) =>
  a + (b - a) * (1 - Math.exp(-speed * dt));
export function angleDamp(a: number, b: number, speed: number, dt: number) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * (1 - Math.exp(-speed * dt));
}
export function seededRandom(seed = 1729) {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}
export function inAttackArc(
  px: number,
  pz: number,
  facing: number,
  tx: number,
  tz: number,
  range: number,
  halfAngle = 1.3,
) {
  const dx = tx - px,
    dz = tz - pz,
    distance = Math.hypot(dx, dz);
  if (distance > range) return false;
  return (
    distance < 0.65 ||
    Math.abs(
      Math.atan2(Math.sin(Math.atan2(dx, dz) - facing), Math.cos(Math.atan2(dx, dz) - facing)),
    ) < halfAngle
  );
}
