export type BossState =
  'idle' | 'wake' | 'phase' | 'chase' | 'prepare' | 'attack' | 'recover' | 'reposition' | 'dead';
export type AttackKind = 'slash' | 'heavy' | 'lunge' | 'sweep' | 'hunt' | 'eruption';
export const BOSS_ATTACKS = {
  slash: {
    name: 'REAPING CUTS · TWO STRIKES',
    windup: 0.8,
    duration: 1.12,
    recovery: 1.25,
    range: 5.6,
    halfAngle: 1.0,
    damage: 24,
    heavy: false,
  },
  heavy: {
    name: 'EXECUTION · LEAVE THE SCYTHE',
    windup: 1.3,
    duration: 0.65,
    recovery: 1.65,
    range: 6.2,
    halfAngle: 0.55,
    damage: 36,
    heavy: true,
  },
  lunge: {
    name: 'GRAVE RUSH · SIDESTEP',
    windup: 1.05,
    duration: 0.78,
    recovery: 1.3,
    range: 11.1,
    halfAngle: 0,
    damage: 27,
    heavy: true,
  },
  sweep: {
    name: 'SOUL RING · ROLL THROUGH',
    windup: 1.3,
    duration: 1.3,
    recovery: 1.45,
    range: 10.5,
    halfAngle: Math.PI,
    damage: 29,
    heavy: true,
  },
  hunt: {
    name: 'HUNTING SHADOWS · KEEP MOVING',
    windup: 1.0,
    duration: 1.1,
    recovery: 1.1,
    range: 0,
    halfAngle: 0,
    damage: 23,
    heavy: false,
  },
  eruption: {
    name: 'GRAVE SPIRES · FIND A GAP',
    windup: 1.4,
    duration: 1.0,
    recovery: 1.3,
    range: 0,
    halfAngle: 0,
    damage: 30,
    heavy: true,
  },
} as const;
export const REAPING_BEATS = [0.12, 0.72, 1.32] as const;
export const RUSH = { start: 0.12, end: 0.6, speed: 18, radius: 1.3 } as const;
export const SOUL_RING = { start: 1.2, width: 0.6 } as const;
export function attackDuration(kind: AttackKind, phase: number) {
  return kind === 'slash' && phase === 2 ? 1.62 : BOSS_ATTACKS[kind].duration;
}
export function chooseBossAttack(index: number, distance: number): AttackKind {
  const near: AttackKind[] = ['slash', 'heavy', 'hunt', 'lunge', 'sweep', 'eruption'];
  const far: AttackKind[] = ['lunge', 'hunt', 'eruption'];
  return distance > 9 ? far[index % far.length] : near[index % near.length];
}
export function canBossAggro(distance: number, playerHealth: number, aggroDistance: number) {
  return playerHealth > 0 && distance < aggroDistance;
}
/** Squared distance to a swept rush segment, including both endpoints. */
export function distanceToSegmentSquared(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const dx = bx - ax,
    dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return (x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2;
}
