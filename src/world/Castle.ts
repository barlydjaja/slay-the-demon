import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CollisionSystem, type Obstacle } from '../game/CollisionSystem';
import { AREAS, type Quality } from '../game/config';
import { seededRandom } from '../game/math';
import { box, cylinder, sphere } from './primitives';
import { materials as m, stoneTexture, glowTexture } from './materials';
export interface Torch {
  position: THREE.Vector3;
  flame: THREE.Mesh;
  glow: THREE.Sprite;
  phase: number;
}
export interface Gate {
  z: number;
  zone: number;
  blocker: Obstacle;
  mesh: THREE.Group;
  opened: boolean;
}
export interface Memory {
  x: number;
  z: number;
  text: string;
  seen: boolean;
}
export class Castle {
  group = new THREE.Group();
  torches: Torch[] = [];
  gates: Gate[] = [];
  water: THREE.Mesh[] = [];
  memories: Memory[] = [];
  zoneGroups: THREE.Group[] = [];
  shrine = new THREE.Group();
  private rng = seededRandom();
  private glow = glowTexture();
  private fog: THREE.Mesh[] = [];
  private fogMaterial: THREE.MeshBasicMaterial;
  constructor(public collision: CollisionSystem) {
    this.fogMaterial = new THREE.MeshBasicMaterial({
      map: this.glow,
      color: 0x99b5bc,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const texture = stoneTexture();
    m.stone.map = texture;
    m.stone.bumpMap = texture;
    m.stone.bumpScale = 0.045;
    m.lightStone.map = texture;
    m.darkStone.map = texture;
    for (let i = 0; i < AREAS.length; i++) this.buildArea(i);
    this.makeShrine();
    this.memories = [
      {
        x: -6,
        z: 4,
        text: 'A little wooden horse. Someone was waiting for them to come home.',
        seen: false,
      },
      {
        x: 7,
        z: -31,
        text: 'The fountain is dry. The flowers were left here long after the kingdom fell.',
        seen: false,
      },
      {
        x: -7,
        z: -57,
        text: '“To whoever finds this: keep the little machine safe.”',
        seen: false,
      },
      {
        x: 6,
        z: -95,
        text: 'Every name has been scratched away. Only the candles remain.',
        seen: false,
      },
    ];
    for (let i = 0; i < 20; i++) {
      const fog = new THREE.Mesh(new THREE.PlaneGeometry(17, 7), this.fogMaterial);
      fog.rotation.x = -Math.PI / 2;
      fog.position.set((this.rng() - 0.5) * 22, 0.22 + (i % 3) * 0.1, 13 - i * 8.3);
      this.fog.push(fog);
      this.group.add(fog);
    }
  }
  private buildArea(index: number) {
    const area = AREAS[index],
      g = new THREE.Group();
    this.group.add(g);
    this.zoneGroups.push(g);
    const start = area.z,
      end = area.end,
      mid = (start + end) / 2,
      length = start - end;
    box(g, m.darkStone, 0, -0.65, mid, 27, 1.2, length);
    box(g, m.edge, 0, -1.15, mid, 27.3, 0.18, length);
    this.floor(g, start, end, index);
    for (const side of [-1, 1]) {
      box(g, m.darkStone, side * 13, -0.04, mid, 0.8, 0.7, length);
      this.collision.add(side * 13, mid, 0.85, length);
      for (let z = start - 3; z > end; z -= 8) {
        this.pillar(g, side * 11.8, z, side === -1 ? 5.8 : 2.5);
        if (side === -1) {
          box(g, m.stone, -12.8, 1.7, z - 3, 0.75, 3.4, 6.3);
          this.window(g, -12.35, z - 3.4, 4.2, Math.PI / 2, index === 3);
        } else if (this.rng() > 0.4) box(g, m.stone, 12.65, 0.8, z - 3, 0.65, 1.6, 5);
      }
    }
    if (index === 0) {
      this.arch(g, 0, 8, 7.8, 7.2);
      for (const side of [-1, 1]) {
        const door = box(g, m.wood, side * 3.3, 1.6, 9.2, 2.2, 3.3, 0.24);
        door.rotation.y = side * 0.9;
        door.rotation.z = side * 0.12;
        for (let y = 0.7; y < 3; y += 1) box(g, m.iron, side * 3.3, y, 9.43, 2.2, 0.1, 0.1);
        this.torch(g, side * 4.7, 1.6, 7.1);
      }
      this.statue(g, -7.8, 2);
      this.tree(g, 9.5, 3, 1);
      this.tree(g, -10.5, 12, 0.7);
      box(g, m.wood, -6, 0.26, 4, 0.65, 0.24, 0.24);
      cylinder(g, m.wood, -5.76, 0.43, 4, 0.12, 0.14, 0.4);
      box(g, m.wood, -6, 0.12, 4, 0.8, 0.06, 0.45);
      this.arch(g, 0, -12, 9, 6.5);
    }
    if (index === 1) {
      cylinder(g, m.darkStone, 7, 0.12, -31, 2.5, 2.7, 0.45, 16);
      cylinder(g, m.lightStone, 7, 0.45, -31, 1.9, 2, 0.32, 16);
      cylinder(g, m.darkStone, 7, 0.61, -31, 1.62, 1.62, 0.04, 16);
      this.statue(g, 7, -31, 0.7);
      this.collision.add(7, -31, 4.5, 4.5);
      this.tree(g, -9, -23, 1.3);
      this.tree(g, 10, -39, 0.9);
      this.statue(g, -8, -37);
      this.arch(g, 0, end, 8, 6.5);
      this.torch(g, -5, 1.8, -25);
      this.torch(g, 5, 1.8, -40);
    }
    if (index === 2) {
      for (let z = -50; z > -76; z -= 10) {
        this.pillar(g, -7, z, 5.5);
        this.pillar(g, 7, z, z === -60 ? 1.8 : 4.2);
        this.torch(g, -7, 2.3, z + 1);
      }
      box(g, m.wood, -8, 0.8, -57, 2.6, 0.2, 1.2);
      for (const x of [-9, -7]) box(g, m.wood, x, 0.36, -57, 0.14, 0.8, 1);
      for (let i = 0; i < 12; i++) {
        const book = box(
          g,
          i % 2 ? m.cloth : m.wood,
          -7.8 + this.rng() * 2,
          0.96 + Math.floor(i / 4) * 0.09,
          -57 + (this.rng() - 0.5) * 0.8,
          0.32,
          0.08,
          0.46,
        );
        book.rotation.y = this.rng() * 2;
      }
      box(g, m.gold, -12.2, 3.1, -59, 0.15, 2.6, 1.9);
      box(g, m.cloth, -12.05, 3.1, -59, 0.06, 2.2, 1.5);
      const fallen = box(g, m.lightStone, 8, 0.65, -65, 1.3, 1.3, 4.5);
      fallen.rotation.y = 0.43;
      this.collision.add(8, -65, 3, 4.5);
      this.arch(g, 0, end, 8, 7.5);
    }
    if (index === 3) {
      for (let z = -85; z > -104; z -= 5)
        for (const side of [-1, 1]) {
          const x = side * 6;
          box(g, m.wood, x, 0.65, z, 3.8, 0.23, 0.8);
          box(g, m.wood, x, 1.15, z - 0.4, 3.8, 1.1, 0.15).rotation.x = 0.13;
          for (const dx of [-1.4, 1.4]) box(g, m.wood, x + dx, 0.3, z, 0.15, 0.6, 0.6);
          this.collision.add(x, z, 4, 1);
        }
      box(g, m.lightStone, 0, 0.55, -107, 4.1, 1.1, 1.3);
      box(g, m.edge, 0, 1.15, -107, 4.4, 0.18, 1.6);
      this.collision.add(0, -107, 4.4, 1.6);
      for (const x of [-1.4, -0.7, 0.7, 1.4]) this.candle(g, x, 1.28, -107);
      this.statue(g, -8.7, -106, 1.3);
      this.statue(g, 8.7, -106, 1.3);
      this.arch(g, 0, end, 9, 8);
      this.window(g, 0, -113.7, 6.5, 0, true);
    }
    if (index === 4) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(10.6, 10.78, 80), m.gold);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.035, -134);
      g.add(ring);
      const inner = new THREE.Mesh(new THREE.RingGeometry(7.5, 7.57, 80), m.edge);
      inner.rotation.x = -Math.PI / 2;
      inner.position.set(0, 0.033, -134);
      g.add(inner);
      box(g, m.darkStone, 0, 2, -154, 27, 4, 1.6);
      this.arch(g, 0, -151, 10, 11);
      this.window(g, 0, -151, 7.7, 0, true);
      for (const x of [-9, 9]) this.statue(g, x, -146, 2);
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const x = Math.sin(angle) * 11,
          z = -134 + Math.cos(angle) * 13;
        this.candle(g, x, 0, z);
        this.candle(g, x + 0.32, 0, z + 0.26);
        this.candle(g, x - 0.2, 0, z - 0.24);
        if (i % 3 === 0) this.torch(g, x, 1.2, z);
      }
      this.puddle(0, -135, 8, 10);
      this.puddle(-6, -129, 4, 6);
      this.puddle(6, -140, 4, 5);
    }
    if (index > 0 && index < 4) this.makeGate(end, index);
    for (let i = 0; i < 12; i++) {
      const x = (this.rng() - 0.5) * 23,
        z = start - 2 - this.rng() * (length - 4);
      this.puddle(x, z, 0.6 + this.rng() * 2.6, 0.6 + this.rng() * 2);
    }
    for (let i = 0; i < 90; i++) {
      const x = (this.rng() > 0.5 ? 1 : -1) * (8 + this.rng() * 4.3),
        z = start - this.rng() * length;
      const rubble = box(
        g,
        this.rng() > 0.6 ? m.moss : m.stone,
        x,
        0.12 + this.rng() * 0.13,
        z,
        0.15 + this.rng() * 0.7,
        0.15 + this.rng() * 0.5,
        0.15 + this.rng() * 0.6,
      );
      rubble.rotation.set(this.rng() * 0.4, this.rng() * 6, this.rng() * 0.25);
    }
    for (let i = 0; i < 15; i++) {
      const z = start - this.rng() * length;
      box(
        g,
        m.moss,
        -12.25,
        this.rng() * 3,
        z,
        0.09,
        0.5 + this.rng() * 2,
        0.1 + this.rng() * 0.3,
      ).rotation.x = this.rng() * 0.5;
    }
    this.mergeStatic(g);
  }
  private floor(g: THREE.Group, start: number, end: number, index: number) {
    const geom = new THREE.BoxGeometry(1.48, 0.16, 1.48),
      dummy = new THREE.Object3D();
    const options = [
      { color: 0x405761, r: 0.9 },
      { color: 0x344c57, r: 0.53 },
      { color: 0x293f4a, r: 0.27 },
      { color: 0x52707a, r: 0.68 },
    ];
    const cells: { x: number; z: number; type: number; y: number }[] = [];
    for (let z = start - 0.75; z > end; z -= 1.55)
      for (let x = -12.4; x < 13; x += 1.55)
        cells.push({
          x: x + (Math.round(z) % 2) * 0.045,
          z,
          type: Math.floor(this.rng() * 4),
          y: this.rng() * 0.022,
        });
    options.forEach((o, type) => {
      const material = new THREE.MeshStandardMaterial({
        color: o.color,
        roughness: o.r,
        metalness: type === 2 ? 0.34 : 0.05,
        map: m.stone.map,
        bumpMap: m.stone.bumpMap,
        bumpScale: 0.025,
        envMapIntensity: 0.8,
      });
      const matching = cells.filter((c) => c.type === type),
        mesh = new THREE.InstancedMesh(geom, material, matching.length);
      matching.forEach((p, i) => {
        dummy.position.set(p.x, -0.07 + p.y, p.z);
        dummy.rotation.y = (this.rng() - 0.5) * 0.024;
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      g.add(mesh);
    });
    for (const x of [-3.6, 3.6])
      box(g, index === 4 ? m.gold : m.edge, x, 0.025, (start + end) / 2, 0.1, 0.035, start - end);
    if (index === 0)
      for (let i = 0; i < 4; i++)
        box(g, m.lightStone, 0, -0.14 + i * 0.015, 14 - i * 0.62, 8, 0.15, 0.57);
  }
  private pillar(g: THREE.Group, x: number, z: number, height: number) {
    box(g, m.darkStone, x, 0.25, z, 1.8, 0.5, 1.8);
    box(g, m.lightStone, x, 0.55, z, 1.5, 0.14, 1.5);
    cylinder(g, m.stone, x, height / 2 + 0.55, z, 0.49, 0.61, height, 8);
    for (let y = 1; y < height + 0.5; y += 1.1) cylinder(g, m.edge, x, y, z, 0.64, 0.64, 0.12, 8);
    box(g, m.lightStone, x, height + 0.65, z, 1.4, 0.25, 1.4);
    box(g, m.darkStone, x, height + 0.9, z, 1.65, 0.28, 1.65);
    this.collision.add(x, z, 1.65, 1.65);
  }
  private arch(g: THREE.Group, x: number, z: number, width: number, height: number) {
    const radius = width / 2;
    for (const side of [-1, 1]) {
      this.pillar(g, x + side * (radius + 0.5), z, height * 0.65);
      const wallWidth = 13 - radius - 1.1;
      box(g, m.stone, side * (radius + 1.1 + wallWidth / 2), 1.7, z, wallWidth, 3.4, 1.3);
      this.collision.add(side * (radius + 1.1 + wallWidth / 2), z, wallWidth, 1.3);
      for (let j = 0; j < 6; j++)
        box(
          g,
          m.edge,
          side * (radius + 1.1 + wallWidth / 2),
          0.3 + j * 0.55,
          z + 0.69,
          wallWidth,
          0.045,
          0.07,
        );
    }
    for (let i = 0; i < 17; i++) {
      const angle = (i / 16) * Math.PI;
      const block = box(
        g,
        m.lightStone,
        x + Math.cos(angle) * radius,
        height * 0.6 + Math.sin(angle) * radius * 0.77,
        z,
        0.85,
        0.72,
        1,
      );
      block.rotation.z = angle - Math.PI / 2;
    }
    box(g, m.gold, x, height * 0.6 + radius * 0.77 + 0.25, z, 0.5, 0.7, 1.08).rotation.z =
      Math.PI / 4;
  }
  private window(
    g: THREE.Group,
    x: number,
    z: number,
    y: number,
    rotation: number,
    stained = false,
  ) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    g.add(group);
    const glass = new THREE.MeshBasicMaterial({
      color: stained ? 0x8fa4b9 : 0x789cac,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    box(group, m.darkStone, 0, 0, -0.11, 3.2, 5, 0.18);
    for (const side of [-1, 1]) {
      box(group, m.lightStone, side * 1.5, 0, 0, 0.2, 5.2, 0.28);
      box(group, m.lightStone, side * 0.5, 0, 0.05, 0.11, 4.9, 0.19);
    }
    for (let i = 0; i < 6; i++) {
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.87, 1.43),
        stained
          ? new THREE.MeshBasicMaterial({
              color: [0x7c8eaf, 0x687e9f, 0x9b6f6b, 0xb8a174, 0x668995, 0x8da9ba][i],
              transparent: true,
              opacity: 0.64,
              side: THREE.DoubleSide,
            })
          : glass,
      );
      pane.position.set((i % 3) - 1, Math.floor(i / 3) * 1.6 - 0.8, 0.11);
      group.add(pane);
    }
    for (const yy of [-2.5, 0, 2.5]) box(group, m.lightStone, 0, yy, 0.1, 3.2, 0.15, 0.3);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 10, 4, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xa9cbd8,
        transparent: true,
        opacity: 0.028,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    beam.position.set(0, -2.8, 3);
    beam.rotation.x = -0.57;
    group.add(beam);
  }
  private statue(g: THREE.Group, x: number, z: number, scale = 1) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.scale.setScalar(scale);
    g.add(p);
    box(p, m.darkStone, 0, 0.3, 0, 1.8, 0.6, 1.6);
    box(p, m.lightStone, 0, 0.66, 0, 1.6, 0.15, 1.4);
    cylinder(p, m.stone, 0, 1.75, 0, 0.39, 0.65, 2, 7);
    sphere(p, m.lightStone, 0, 3, 0, 0.37, 0.49, 0.33);
    box(p, m.stone, -0.5, 2.14, 0.12, 0.3, 1.2, 0.35).rotation.z = -0.3;
    box(p, m.stone, 0.5, 2.38, 0.12, 0.3, 0.63, 0.35).rotation.z = 0.3;
    box(p, m.iron, -0.6, 1.5, 0.45, 0.065, 1.9, 0.07);
    this.collision.add(x, z, 1.8 * scale, 1.6 * scale);
  }
  private tree(g: THREE.Group, x: number, z: number, scale: number) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    g.add(tree);
    cylinder(tree, m.wood, 0, 1.5, 0, 0.17, 0.38, 3.1, 6).rotation.z = 0.12;
    for (let i = 0; i < 8; i++) {
      const branch = cylinder(
        tree,
        m.wood,
        Math.sin(i * 2) * 0.65,
        2.3 + i * 0.26,
        Math.cos(i * 2) * 0.4,
        0.015,
        0.13,
        1.7,
        5,
      );
      branch.rotation.set(Math.cos(i) * 0.9, 0, Math.sin(i * 2) * 0.85);
    }
    this.collision.add(x, z, 0.8, 0.8);
  }
  private torch(g: THREE.Group, x: number, y: number, z: number) {
    cylinder(g, m.iron, x, y / 2, z, 0.055, 0.085, y);
    cylinder(g, m.gold, x, y, z, 0.22, 0.08, 0.25);
    const flame = sphere(this.group, m.fire, x, y + 0.37, z, 0.115, 0.34, 0.115);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glow,
        color: 0xffa54b,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.position.set(x, y + 0.3, z);
    glow.scale.set(2.7, 2.7, 1);
    this.group.add(glow);
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({
        map: this.glow,
        color: 0xd8964e,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.04, z);
    this.group.add(pool);
    this.torches.push({
      position: new THREE.Vector3(x, y + 0.4, z),
      flame,
      glow,
      phase: this.rng() * 6,
    });
  }
  private candle(g: THREE.Group, x: number, y: number, z: number) {
    const h = 0.25 + this.rng() * 0.45;
    cylinder(g, m.bone, x, y + h / 2, z, 0.055, 0.075, h, 6);
    sphere(g, m.fire, x, y + h + 0.065, z, 0.035, 0.09, 0.035);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glow,
        color: 0xffb660,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.position.set(x, y + h, z);
    glow.scale.set(0.8, 0.8, 1);
    this.group.add(glow);
  }
  private puddle(x: number, z: number, sx: number, sz: number) {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2,
        r = 0.82 + this.rng() * 0.18,
        px = Math.cos(a) * sx * r,
        py = Math.sin(a) * sz * r;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    const material = new THREE.MeshStandardMaterial({
      color: 0x385564,
      roughness: 0.075,
      metalness: 0.72,
      transparent: true,
      opacity: 0.67,
      envMapIntensity: 1.3,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.035, z);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.water.push(mesh);
  }
  private makeGate(z: number, zone: number) {
    const group = new THREE.Group();
    group.position.z = z;
    this.group.add(group);
    const material = new THREE.MeshBasicMaterial({
      color: 0x966c8c,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    box(group, material, 0, 1.8, 0, 7.2, 3.6, 0.08);
    for (let x = -3.4; x < 3.5; x += 0.85) box(group, m.redEye, x, 0.65, 0, 0.04, 1.3, 0.04);
    this.gates.push({
      z,
      zone,
      blocker: this.collision.add(0, z, 8, 1),
      mesh: group,
      opened: false,
    });
  }
  private makeShrine() {
    this.shrine.position.set(5, 0, -110);
    this.group.add(this.shrine);
    cylinder(this.shrine, m.darkStone, 0, 0.17, 0, 1.4, 1.5, 0.34, 12);
    cylinder(this.shrine, m.gold, 0, 0.38, 0, 0.8, 1, 0.18, 8);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), m.eye);
    crystal.position.y = 1.3;
    this.shrine.add(crystal);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glow,
        color: 0x8de0e4,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.position.y = 1.2;
    glow.scale.set(3.5, 3.5, 1);
    this.shrine.add(glow);
  }
  private mergeStatic(g: THREE.Group) {
    g.updateMatrixWorld(true);
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const remove: THREE.Mesh[] = [];
    g.traverse((o) => {
      if (
        !(o instanceof THREE.Mesh) ||
        o instanceof THREE.InstancedMesh ||
        Array.isArray(o.material) ||
        o.material.transparent
      )
        return;
      const geom = o.geometry.clone();
      geom.applyMatrix4(o.matrixWorld);
      if (!geom.index)
        geom.setIndex(Array.from({ length: geom.attributes.position.count }, (_, i) => i));
      if (!groups.has(o.material)) groups.set(o.material, []);
      groups.get(o.material)!.push(geom);
      remove.push(o);
    });
    for (const mesh of remove) mesh.removeFromParent();
    for (const [material, geometries] of groups) {
      const geom = mergeGeometries(geometries, false);
      for (const item of geometries) item.dispose();
      if (geom) {
        const mesh = new THREE.Mesh(geom, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
      }
    }
  }
  update(time: number, dt: number, playerZ: number) {
    for (const t of this.torches) {
      const flicker =
        1 + Math.sin(time * 9 + t.phase) * 0.13 + Math.sin(time * 17 + t.phase) * 0.06;
      t.flame.scale.y = 0.34 * flicker;
      t.glow.material.opacity = 0.48 + flicker * 0.06;
    }
    for (let i = 0; i < this.fog.length; i++) {
      this.fog[i].position.x = Math.sin(time * 0.13 + i * 3) * 6;
      this.fog[i].rotation.z = Math.sin(time * 0.06 + i) * 0.12;
    }
    for (const gate of this.gates) {
      if (gate.opened) gate.mesh.position.y = Math.max(-5, gate.mesh.position.y - dt * 2.2);
      gate.mesh.visible = gate.mesh.position.y > -4;
    }
    const crystal = this.shrine.children[2];
    crystal.rotation.y = time * 0.6;
    crystal.position.y = 1.3 + Math.sin(time * 2) * 0.09;
    // Whole zones outside the camera corridor do not submit any render work.
    this.zoneGroups.forEach(
      (g, i) => (g.visible = playerZ < AREAS[i].z + 65 && playerZ > AREAS[i].end - 40),
    );
  }
  openGate(zone: number) {
    const gate = this.gates.find((g) => g.zone === zone);
    if (gate && !gate.opened) {
      gate.opened = true;
      gate.blocker.active = false;
      return true;
    }
    return false;
  }
  reset() {
    for (const gate of this.gates) {
      gate.opened = false;
      gate.blocker.active = true;
      gate.mesh.position.y = 0;
      gate.mesh.visible = true;
    }
    for (const memory of this.memories) memory.seen = false;
  }
  setReflections(quality: Quality) {
    for (const water of this.water) {
      (water.material as THREE.MeshStandardMaterial).envMapIntensity =
        quality === 'high' ? 1.3 : quality === 'medium' ? 0.8 : 0.35;
    }
  }
}
