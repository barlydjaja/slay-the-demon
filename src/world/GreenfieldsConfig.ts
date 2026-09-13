export const FIELD_BOUNDS = { halfWidth: 40, minZ: -65, maxZ: 44 };
export const FIELD_SPAWN = { x: 0, z: 35 };
export const ELDER_POSITION = { x: -3.4, z: 27 };
export const VILLAGE = { x: 16, z: -23, radius: 15 };
export const VILLAGE_WALLS = {
  west: 0,
  east: 34,
  north: -42,
  south: -10,
  gateX: 14,
  gateWidth: 7.2,
};
export const FIELD_CHECKPOINT = { x: 16, z: -15 };
export type FieldMonster = 'wolf' | 'golem' | 'thornling';
export const FIELD_ENCOUNTERS: { id: string; type: FieldMonster; x: number; z: number }[] = [
  { id: 'briar-path', type: 'thornling', x: -9, z: 10 },
  { id: 'east-wolf', type: 'wolf', x: 17, z: 9 },
  { id: 'east-pack', type: 'wolf', x: 23, z: 3 },
  { id: 'pond-thorn', type: 'thornling', x: -18, z: 1 },
  { id: 'western-golem', type: 'golem', x: -22, z: -10 },
  { id: 'ruin-wolf', type: 'wolf', x: -11, z: -17 },
  { id: 'arch-thorn', type: 'thornling', x: -27, z: -25 },
  { id: 'northern-golem', type: 'golem', x: -14, z: -36 },
  { id: 'ridge-wolf', type: 'wolf', x: -22, z: -44 },
  { id: 'far-thorn', type: 'thornling', x: 2, z: -49 },
  { id: 'far-wolf', type: 'wolf', x: 14, z: -52 },
  { id: 'far-golem', type: 'golem', x: 28, z: -51 },
];
export function inVillage(x: number, z: number) {
  const w = VILLAGE_WALLS;
  return x > w.west + 0.7 && x < w.east - 0.7 && z > w.north + 0.7 && z < w.south - 0.7;
}
export function isFieldSanctuary(x: number, z: number) {
  return inVillage(x, z) || z > 20;
}
export function canLeaveCastle(bossDefeated: boolean, gateOpen: boolean, x: number, z: number) {
  return bossDefeated && gateOpen && Math.abs(x) < 3.5 && z < -150.8;
}
export const ELDER_STORY = [
  'The bells have fallen silent. So the Reaper is gone… Come closer, little one. I have waited a very long time to see those eyes shine again.',
  'Our kings wanted a world without death. They opened a door beneath the throne, and something hungry answered. The sky darkened. The cities fell. That was the end of the world we knew.',
  'You were told humanity was gone. Our kingdoms are. But a few of us endured, beyond the castle walls. We built Firstlight from what we could carry. You can see its roofs down the path.',
  'Then the rain softened the ash, and the grass returned. The earth began again. Yet the old darkness still wanders these fields: briar wolves, thornlings, and stones that should never have awakened.',
  'They built you as a weapon. I believe you can be something more. A guardian. A promise that what grows here will have a tomorrow. You, little machine, are humanity’s last hope.',
  'Follow the sunflowers to Firstlight. Rest by our well; its water will mend you. Beyond our lanterns, keep your blade ready. This is no longer the end of your story. It is the beginning of ours.',
];
