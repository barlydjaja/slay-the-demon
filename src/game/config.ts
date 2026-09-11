export const PLAYER = {
  health: 100,
  speed: 5.5,
  sprintSpeed: 8.7,
  radius: 0.47,
  damage: 32,
  attackRange: 2.55,
  attackDuration: 0.48,
  stamina: 100,
  dodgeDuration: 0.3,
  dodgeCooldown: 0.8,
} as const;
export const BOSS_AGGRO_DISTANCE = 12;
export const BOSS = { health: 896, radius: 2.5, speed: 2.8, spawnZ: -136 } as const;
export const WORLD = {
  startZ: 11,
  minZ: -153,
  maxZ: 17,
  halfWidth: 13,
  checkpointZ: -111,
} as const;
export const AREAS = [
  {
    name: 'The Forgotten Gate',
    subtitle: 'CASTLE ENTRANCE',
    z: 17,
    end: -12,
    objective: 'Follow the light into the courtyard.',
  },
  {
    name: 'The Weeping Court',
    subtitle: 'RAIN-SOAKED COURTYARD',
    z: -12,
    end: -44,
    objective: 'Silence the restless guardians.',
  },
  {
    name: 'Hall of the Departed',
    subtitle: 'RUINED HALL',
    z: -44,
    end: -78,
    objective: 'Find what remains of the kingdom.',
  },
  {
    name: 'The Silent Chapel',
    subtitle: 'ABANDONED CHAPEL',
    z: -78,
    end: -114,
    objective: 'Reach the sanctuary before the darkness.',
  },
  {
    name: 'The Hollow Throne',
    subtitle: 'INNER CHAMBER',
    z: -114,
    end: -155,
    objective: 'Something waits beyond the water.',
  },
] as const;
export type Quality = 'low' | 'medium' | 'high';
export interface Settings {
  quality: Quality;
  shadows: Quality;
  reflections: Quality;
  particles: Quality;
  audio: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  quality: 'high',
  shadows: 'medium',
  reflections: 'high',
  particles: 'high',
  audio: true,
};
