import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CollisionSystem, type Obstacle } from '../game/CollisionSystem';
import { AREAS, type Quality } from '../game/config';
import { seededRandom } from '../game/math';
import { box, sphere } from './primitives';
import { materials as m, glowTexture } from './materials';
import { CastleAssets } from './CastleAssets';
import { CastleExit } from './CastleExit';
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
  exitOpened = false;
  readonly exit: CastleExit;
  private crystal!: THREE.Object3D;
  private exitBlocker: Obstacle;
  private rng = seededRandom();
  private glow = glowTexture();
  private fog: THREE.Mesh[] = [];
  private fogMaterial: THREE.MeshBasicMaterial;
  constructor(
    public collision: CollisionSystem,
    private assets: CastleAssets,
  ) {
    this.fogMaterial = new THREE.MeshBasicMaterial({
      map: this.glow,
      color: 0x99b5bc,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < AREAS.length; i++) this.buildArea(i);
    this.exitBlocker = collision.add(0, -150, 8, 1);
    this.exit = new CastleExit(assets);
    this.group.add(this.exit.group);
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
    g.name = area.name;
    this.group.add(g);
    this.zoneGroups.push(g);
    const start = area.z,
      end = area.end,
      mid = (start + end) / 2,
      length = start - end;
    const base = this.assets.place(g, 'foundation', 0, 0, mid);
    base.scale.z = length / 8;
    this.floor(g, start, end);
    for (const side of [-1, 1]) {
      this.collision.add(side * 13, mid, 0.85, length);
      for (let z = start - 3; z > end; z -= 8) {
        this.pillar(g, side * 11.8, z, side === -1 ? 5.8 : 2.5);
        if (side === -1) {
          this.assets.place(g, 'wall_bay', -12.8, 0, z - 3.2, 1, Math.PI / 2);
          this.assets.place(g, 'buttress', -13.15, 0, z + 0.4, 1, Math.PI / 2);
          if (index === 3)
            this.assets.place(g, 'stained_window', -12.22, 1.68, z - 3.2, 0.88, Math.PI / 2);
        } else {
          const wall = this.assets.place(g, 'parapet', 12.65, 0, z - 3.2, 1, Math.PI / 2);
          wall.scale.x = 0.9;
        }
      }
    }
    if (index === 0) {
      this.arch(g, 0, 8, 7.8, 7.2, false);
      for (const side of [-1, 1]) {
        const door = this.assets.place(g, 'door_leaf', side * 3.3, 0, 9.2, 1, side * 0.9);
        door.rotation.z = side * 0.12;
        this.torch(g, side * 4.7, 1.6, 7.1);
      }
      this.statue(g, -7.8, 2);
      this.tree(g, 9.5, 3, 1);
      this.tree(g, -10.5, 12, 0.7);
      this.assets.place(g, 'wooden_horse', -6, 0.02, 4);
      this.arch(g, 0, -12, 9, 6.5, true);
    }
    if (index === 1) {
      this.assets.place(g, 'fountain', 7, 0, -31);
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
      this.assets.place(g, 'scribe_desk', -8, 0, -57);
      this.assets.place(g, 'torn_banner', -12.2, 1.8, -59, 1, Math.PI / 2);
      this.assets.place(g, 'fallen_column', 8, 0, -65, 1, 0.43);
      this.collision.add(8, -65, 3, 4.5);
      this.arch(g, 0, end, 8, 7.5, true);
    }
    if (index === 3) {
      for (let z = -85; z > -104; z -= 5) {
        for (const side of [-1, 1]) {
          this.assets.place(g, 'chapel_pew', side * 6, 0, z);
          this.collision.add(side * 6, z, 4, 1);
        }
      }
      this.assets.place(g, 'chapel_altar', 0, 0, -107);
      this.collision.add(0, -107, 4.4, 1.6);
      for (const x of [-1.4, -0.7, 0.7, 1.4]) this.candle(g, x, 1.2, -107);
      this.statue(g, -8.7, -106, 1.3);
      this.statue(g, 8.7, -106, 1.3);
      this.arch(g, 0, end, 9, 8);
      this.assets.place(g, 'stained_window', 0, 5, -114.5, 1.05);
    }
    if (index === 4) {
      this.assets.place(g, 'floor_medallion', 0, 0, -134);
      this.arch(g, 0, -151, 10, 11);
      this.assets.place(g, 'stained_window', 0, 7.7, -151, 1.1);
      this.statue(g, -9, -146, 2);
      this.assets.place(g, 'broken_throne', 9, 0, -146, 1.5, -0.28);
      this.collision.add(9, -146, 3.6, 3.2);
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2,
          x = Math.sin(angle) * 11,
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
    for (let i = 0; i < 42; i++) {
      const x = (this.rng() > 0.5 ? 1 : -1) * (8.5 + this.rng() * 3.6),
        z = start - this.rng() * length;
      this.assets.place(
        g,
        `rubble_${i % 3}`,
        x,
        -0.03,
        z,
        0.4 + this.rng() * 0.55,
        this.rng() * Math.PI * 2,
      );
    }
    for (let i = 0; i < 14; i++) {
      this.assets.place(
        g,
        'ivy',
        -12.25,
        0.2 + this.rng() * 3.1,
        start - this.rng() * length,
        0.65 + this.rng() * 0.7,
        Math.PI / 2,
      );
    }
    this.mergeStatic(g);
  }
  private floor(g: THREE.Group, start: number, end: number) {
    const matrices: THREE.Matrix4[][] = [[], [], []],
      dummy = new THREE.Object3D();
    for (let z = start - 0.75; z > end; z -= 1.52) {
      for (let x = -12.3; x < 13; x += 1.52) {
        dummy.position.set(x + (Math.round(z) % 2) * 0.025, 0, z);
        dummy.rotation.y = (Math.floor(this.rng() * 4) * Math.PI) / 2;
        dummy.updateMatrix();
        matrices[Math.floor(this.rng() * 3)].push(dummy.matrix.clone());
      }
    }
    matrices.forEach((items, i) => this.assets.batch(g, `flagstone_${i}`, items));
    for (const x of [-3.6, 3.6]) {
      const border = this.assets.place(g, 'floor_border', x, 0, (start + end) / 2);
      border.scale.z = (start - end) / 8;
    }
  }
  private pillar(g: THREE.Group, x: number, z: number, height: number) {
    const broken = height < 3;
    const pillar = this.assets.place(g, broken ? 'pillar_broken' : 'pillar', x, 0, z);
    pillar.scale.y = height / (broken ? 2 : 5.8);
    this.collision.add(x, z, 1.65, 1.65);
  }
  private arch(
    g: THREE.Group,
    x: number,
    z: number,
    width: number,
    height: number,
    broken = false,
  ) {
    const portal = this.assets.place(g, broken ? 'portal_broken' : 'portal', x, 0, z);
    portal.scale.set(width / 8, height / 8.35, 1);
    const radius = width / 2;
    for (const side of [-1, 1]) {
      this.collision.add(x + side * (radius + 0.5), z, 1.65, 1.65);
      const wallWidth = 13 - radius - 1.1;
      const wing = this.assets.place(
        g,
        'wall_fragment',
        side * (radius + 1.1 + wallWidth / 2),
        0,
        z,
      );
      wing.scale.x = wallWidth / 5;
      this.collision.add(side * (radius + 1.1 + wallWidth / 2), z, wallWidth, 1.3);
    }
  }
  private statue(g: THREE.Group, x: number, z: number, scale = 1) {
    this.assets.place(g, 'sentinel_statue', x, 0, z, scale);
    this.collision.add(x, z, 1.8 * scale, 1.6 * scale);
  }
  private tree(g: THREE.Group, x: number, z: number, scale: number) {
    this.assets.place(g, 'dead_tree', x, 0, z, scale);
    this.collision.add(x, z, 0.8, 0.8);
  }
  private torch(g: THREE.Group, x: number, y: number, z: number) {
    const stand = this.assets.place(g, 'torch_stand', x, 0, z);
    stand.scale.y = y / 1.8;
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
    const candle = this.assets.place(g, 'candle', x, y, z);
    candle.scale.y = h / 0.49;
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
    const base = this.assets.clone('sanctuary');
    this.shrine.add(base);
    this.crystal = base.getObjectByName('sanctuary_crystal')!;
    if (this.crystal instanceof THREE.Mesh) this.crystal.material = m.eye;
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
    if (this.exitOpened) {
      this.exit.update(dt, time, true);
      if (this.exit.ready) this.exitBlocker.active = false;
    }
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
    this.crystal.rotation.y = time * 0.6;
    this.crystal.position.y = 1.3 + Math.sin(time * 2) * 0.09;
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
  get exitReady() {
    return this.exitOpened && this.exitBlocker.active === false;
  }
  resetExit() {
    this.exitOpened = false;
    this.exit.reset();
    this.exitBlocker.active = true;
  }
  reset() {
    this.resetExit();
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
