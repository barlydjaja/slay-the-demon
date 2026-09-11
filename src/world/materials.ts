import * as THREE from 'three';
import { seededRandom } from '../game/math';
const mat = (color: number, roughness = 0.7, metalness = 0.05) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
export const materials = {
  stone: mat(0x455963),
  lightStone: mat(0x73838a),
  darkStone: mat(0x24353d),
  edge: mat(0x627780),
  moss: mat(0x3d5347),
  wood: mat(0x3d3430),
  gold: mat(0x9b8459, 0.42, 0.65),
  iron: mat(0x303d44, 0.44, 0.75),
  blue: mat(0x4c92b0, 0.34, 0.55),
  blueEdge: mat(0x8cbac7, 0.31, 0.6),
  black: mat(0x111e25, 0.28, 0.48),
  rust: mat(0x7a5844, 0.8, 0.3),
  bone: mat(0xb9b5a3, 0.75, 0.1),
  cloth: mat(0x242735),
  eye: new THREE.MeshStandardMaterial({
    color: 0xc8faff,
    emissive: 0x82dafa,
    emissiveIntensity: 3,
  }),
  fire: new THREE.MeshBasicMaterial({ color: 0xffcd77 }),
  redEye: new THREE.MeshStandardMaterial({
    color: 0xf3a2a2,
    emissive: 0xd44a65,
    emissiveIntensity: 2.8,
  }),
};
export function stoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(94);
  ctx.fillStyle = '#a2a9a8';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2200; i++) {
    const shade = 110 + rng() * 90;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},.16)`;
    ctx.fillRect(rng() * 128, rng() * 128, 1 + rng() * 4, 1 + rng() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
export function makeEnvironment() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#748f9c');
  g.addColorStop(0.48, '#465d6b');
  g.addColorStop(0.6, '#192a33');
  g.addColorStop(1, '#0b141b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#acc7d0';
  for (let i = 0; i < 5; i++) ctx.fillRect(36 + i * 102, 60, 14, 52);
  ctx.fillStyle = '#d39751';
  for (let i = 0; i < 4; i++) ctx.fillRect(65 + i * 128, 138, 6, 15);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
