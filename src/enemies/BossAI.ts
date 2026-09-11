export type BossState =
  'idle' | 'wake' | 'chase' | 'prepare' | 'attack' | 'recover' | 'reposition' | 'dead';
export type AttackKind = 'slash' | 'heavy' | 'lunge' | 'sweep';
export const BOSS_ATTACKS: Record<
  AttackKind,
  {
    name: string;
    windup: number;
    duration: number;
    recovery: number;
    range: number;
    damage: number;
    heavy: boolean;
  }
> = {
  slash: {
    name: 'SCYTHE SLASH',
    windup: 0.8,
    duration: 0.28,
    recovery: 1.35,
    range: 5.5,
    damage: 20,
    heavy: false,
  },
  heavy: {
    name: 'HEAVY SCYTHE · EVADE',
    windup: 1.45,
    duration: 0.35,
    recovery: 2.1,
    range: 6,
    damage: 34,
    heavy: true,
  },
  lunge: {
    name: 'SPIDER LUNGE',
    windup: 1.1,
    duration: 0.62,
    recovery: 1.55,
    range: 4.3,
    damage: 24,
    heavy: false,
  },
  sweep: {
    name: 'CIRCULAR SWEEP · EVADE',
    windup: 1.65,
    duration: 0.5,
    recovery: 2.2,
    range: 8.4,
    damage: 29,
    heavy: true,
  },
};
export function chooseBossAttack(index: number, distance: number): AttackKind {
  if (distance > 9) return 'lunge';
  return (['slash', 'heavy', 'lunge', 'sweep'] as AttackKind[])[index % 4];
}
export function canBossAggro(distance: number, playerHealth: number, aggroDistance: number) {
  return playerHealth > 0 && distance < aggroDistance;
}
