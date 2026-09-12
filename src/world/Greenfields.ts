import * as THREE from 'three';
import { CollisionSystem } from '../game/CollisionSystem';
import { seededRandom } from '../game/math';
import { FieldAssets, type Placement } from './FieldAssets';
import { ELDER_POSITION, FIELD_BOUNDS, FIELD_ENCOUNTERS, VILLAGE } from './GreenfieldsConfig';
const PATH = [
  [35, 0],
  [23, 3],
  [14, 9],
  [1, 5],
  [-8, 11],
  [-17, 16],
  [-35, 16],
];
export function meadowPathX(z: number) {
  for (let i = 0; i < PATH.length - 1; i++) {
    const [za, xa] = PATH[i],
      [zb, xb] = PATH[i + 1];
    if (z <= za && z >= zb) {
      let t = (za - z) / (za - zb);
      t = t * t * (3 - 2 * t);
      return xa + (xb - xa) * t;
    }
  }
  return z > 35 ? 0 : 16;
}
export class Greenfields {
  group = new THREE.Group();
  elder!: THREE.Group;
  private rng = seededRandom(94172);
  private sails?: THREE.Object3D;
  private marker?: THREE.Mesh;
  private people: THREE.Group[] = [];
  private motes?: THREE.Points;
  private constructor(
    private collision: CollisionSystem,
    public assets: FieldAssets,
  ) {
    this.group.name = 'The Greenfields · Blender landscape';
    collision.heightAt = assets.heightAt;
  }
  static async create(
    collision: CollisionSystem,
    report: (progress: number, label: string) => Promise<void>,
    library?: FieldAssets,
  ) {
    await report(31, 'Unpacking the meadow and its little details…');
    const field = new Greenfields(collision, library ?? (await FieldAssets.load()));
    const stages: [number, string, () => void][] = [
      [38, 'Following the hills and winding paths…', () => field.terrain()],
      [43, 'Setting the old stones among the trees…', () => field.landmarks()],
      [49, 'Opening the doors of Firstlight…', () => field.village()],
      [54, 'Growing the woodland at the edges…', () => field.woodland()],
      [60, 'Planting ferns, flowers, and meadow grass…', () => field.vegetation()],
      [65, 'Elder Rowan is waiting in the shade…', () => field.characters()],
    ];
    for (const [progress, label, build] of stages) {
      await report(progress, label);
      build();
    }
    return field;
  }
  private put(name: string, x: number, z: number, scale = 1, yaw = 0) {
    return this.assets.place(this.group, name, { x, z, scale, yaw });
  }
  private terrain() {
    const terrain = this.assets.clone('terrain');
    terrain.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = false;
    });
    this.group.add(terrain);
    this.put('ruined_arch', 0, 42, 1.6);
    this.collision.add(0, 43, 12, 2);
    for (const x of [-4, 4]) this.collision.add(x, 42, 1.5, 2);
    const ridges: Placement[] = [];
    for (let i = 0; i < 10; i++) {
      ridges.push({ x: -46, z: 38 - i * 11, scale: 1.4, yaw: 0.8 });
      ridges.push({ x: 46, z: 38 - i * 11, scale: 1.4, yaw: -0.8 });
    }
    for (let x = -36; x < 40; x += 12) ridges.push({ x, z: -73, scale: 1.6, yaw: 1.7 });
    this.assets.scatter(this.group, 'ridge', ridges);
    for (let z = 28; z > -16; z -= 8)
      this.put('stepping_stones', meadowPathX(z), z, 0.65, Math.PI / 2);
    this.put('signpost', meadowPathX(15) - 2.7, 15);
    this.put('signpost', 12, -9, 0.9);
  }
  private landmarks() {
    // A mossy ruin gives the western encounters a distinct destination.
    this.put('ruined_arch', -24, -30, 1.2, 0.25);
    this.put('shrine', -27, -33, 1.05);
    this.collision.add(-27, -33, 2.1, 2.1);
    for (const x of [-26.2, -21.8]) this.collision.add(x, -30, 1, 1.5);
    for (const [x, z, r] of [
      [-29, -26, 0.3],
      [-23, -34, -0.5],
      [-21, -31, 1.4],
    ])
      this.put('broken_wall', x, z, 1.2, r);
    this.assets.place(this.group, 'pond', { x: -26, z: 18, y: 0.08 });
    this.collision.add(-26, 18, 10.2, 6.1);
    const reeds: Placement[] = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      reeds.push({
        x: -26 + Math.sin(a) * 5.9,
        z: 18 + Math.cos(a) * 3.8,
        scale: 0.8 + this.rng() * 0.45,
        yaw: a,
      });
    }
    this.assets.scatter(this.group, 'reeds', reeds, false);
    const rocks: Placement[] = [];
    for (const [x, z] of [
      [-16, 23],
      [26, 24],
      [-31, 5],
      [-26, -8],
      [-5, -28],
      [31, -41],
      [5, -56],
      [-29, -48],
    ]) {
      rocks.push({ x, z, scale: 0.9 + this.rng() * 0.8, yaw: this.rng() * 6.28 });
      this.collision.add(x, z, 2.1, 1.7);
      for (let j = 0; j < 3; j++)
        rocks.push({
          x: x + (this.rng() - 0.5) * 4,
          z: z + (this.rng() - 0.5) * 3,
          scale: 0.25 + this.rng() * 0.3,
          yaw: this.rng() * 6,
        });
    }
    this.assets.scatter(this.group, 'boulder', rocks);
  }
  private village() {
    for (const [name, x, z, yaw] of [
      ['cottage', 8, -22, Math.PI / 2],
      ['longhouse', 9, -32, 0],
      ['cottage', 21, -33, 0],
      ['longhouse', 27, -23, -Math.PI / 2],
    ] as const) {
      this.put(name, x, z, 1, yaw);
      if (name === 'longhouse') {
        const wingX = x + 3.2 * Math.cos(yaw) - 0.6 * Math.sin(yaw),
          wingZ = z - 3.2 * Math.sin(yaw) - 0.6 * Math.cos(yaw);
        this.collision.add(
          wingX,
          wingZ,
          Math.abs(yaw) > 0.1 ? 2.5 : 1.9,
          Math.abs(yaw) > 0.1 ? 1.9 : 2.5,
        );
      }
      const sideways = Math.abs(yaw) > 0.1;
      this.collision.add(x, z, sideways ? 4.9 : 5.6, sideways ? 5.6 : 4.9);
    }
    const paving: Placement[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      paving.push({
        x: 16 + Math.sin(a) * 2.1,
        z: -23 + Math.cos(a) * 2.1,
        scale: 0.55,
        yaw: a + Math.PI / 2,
      });
    }
    this.assets.scatter(this.group, 'stepping_stones', paving, false);
    this.put('well', 16, -23);
    this.collision.add(16, -23, 2.3, 2.3);
    const mill = this.put('windmill', 29, -36, 0.95);
    this.sails = mill.getObjectByName('windmill_sails');
    this.collision.add(29, -36, 3.7, 3.7);
    for (const x of [12, 20]) {
      this.put('lantern', x, -9);
      this.collision.add(x, -9, 0.25, 0.25);
    }
    const fences: Placement[] = [];
    for (let x = 4; x < 33; x += 3) fences.push({ x, z: -39 });
    this.assets.scatter(this.group, 'fence', fences);
    this.collision.add(18, -39, 31, 0.2);
    this.put('cart', 3, -17, 0.9, -0.4);
    this.collision.add(3, -17, 2.3, 2.3);
    for (const [x, z] of [
      [5, -24],
      [23, -28],
      [12, -34],
    ]) {
      this.put('barrel', x, z);
      this.put('barrel', x + 0.8, z + 0.3, 0.85);
      this.put('crate', x, z + 1.1, 0.9, 0.18);
    }
    for (let row = 0; row < 3; row++)
      for (let j = 0; j < 5; j++) this.put('berry_bush', 3 + row * 0.8, -27 - j * 0.8, 0.48);
  }
  private woodland() {
    const types = ['oak', 'birch', 'pine', 'golden_oak'];
    const lists = types.map(() => [] as Placement[]);
    for (let i = 0; i < 90; i++) {
      const edge = i < 66;
      const x = edge ? (i % 2 ? -1 : 1) * (35 + this.rng() * 8) : (this.rng() - 0.5) * 64;
      const z = -63 + this.rng() * 103;
      if (
        Math.abs(x - meadowPathX(z)) < 5 ||
        Math.hypot(x - 16, z + 23) < 18 ||
        Math.hypot(x + 26, z - 18) < 8 ||
        FIELD_ENCOUNTERS.some((e) => Math.hypot(x - e.x, z - e.z) < 4)
      )
        continue;
      lists[i % 4].push({ x, z, scale: 0.75 + this.rng() * 0.45, yaw: this.rng() * 6.28 });
      if (Math.abs(x) < FIELD_BOUNDS.halfWidth) this.collision.add(x, z, 0.9, 0.9);
    }
    lists[0].push({ x: -7, z: 25, scale: 1.3, yaw: 1 });
    this.collision.add(-7, 25, 1.3, 1.3);
    for (let i = 0; i < types.length; i++) this.assets.scatter(this.group, types[i], lists[i]);
  }
  private vegetation() {
    const types = ['grass_tuft', 'fern', 'wildflowers', 'bluebells', 'berry_bush'];
    const lists = types.map(() => [] as Placement[]);
    for (let i = 0; i < 3500; i++) {
      const x = (this.rng() - 0.5) * 78,
        z = -63 + this.rng() * 104;
      if (
        Math.abs(x - meadowPathX(z)) < 2.45 ||
        Math.hypot(x - 16, z + 23) < 13 ||
        this.collision.blocked(x, z, 0.2)
      )
        continue;
      // Broad clumps separated by open ground preserve paths and combat readability.
      const density = (Math.sin(x * 0.32 + z * 0.16) + Math.cos(z * 0.38 - x * 0.1)) * 0.5;
      if (density < -0.5 && i % 3) continue;
      const type = i % 15 === 0 ? 4 : i % 9 === 0 ? 1 : i % 6 === 0 ? 2 : i % 11 === 0 ? 3 : 0;
      lists[type].push({
        x,
        z,
        scale: (type === 0 ? 0.85 : 0.75) + this.rng() * 0.6,
        yaw: this.rng() * 6.28,
      });
    }
    types.forEach((type, i) => this.assets.scatter(this.group, type, lists[i], i === 4));
    const flowers: Placement[] = [];
    for (let z = -7; z < 26; z += 1.3)
      flowers.push({
        x: meadowPathX(z) + 3.05 + (this.rng() - 0.5) * 0.45,
        z,
        scale: 0.8 + this.rng() * 0.35,
        yaw: (this.rng() - 0.5) * 0.5,
      });
    this.assets.scatter(this.group, 'sunflower', flowers, false);
  }
  private characters() {
    this.elder = this.put('elder', ELDER_POSITION.x, ELDER_POSITION.z, 1.1, 0.25);
    this.collision.add(ELDER_POSITION.x, ELDER_POSITION.z, 0.8, 0.8);
    for (const [name, x, z, yaw] of [
      ['villager', 12, -19, 1.8],
      ['villager', 21, -26, -0.7],
      ['child', 18, -31, 0.8],
    ] as const)
      this.people.push(this.put(name, x, z, 1, yaw));
    this.marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.1),
      new THREE.MeshBasicMaterial({ color: 0xffdda0 }),
    );
    this.marker.position.set(
      ELDER_POSITION.x,
      this.assets.heightAt(ELDER_POSITION.x, ELDER_POSITION.z) + 3.35,
      ELDER_POSITION.z,
    );
    this.group.add(this.marker);
    const positions = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      const x = (this.rng() - 0.5) * 65,
        z = -55 + this.rng() * 90;
      positions.set([x, this.assets.heightAt(x, z) + 1 + this.rng() * 2.3, z], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.motes = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xffe9b0,
        size: 0.06,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.group.add(this.motes);
  }
  update(time: number) {
    if (this.sails) this.sails.rotation.z = -time * 0.2;
    this.elder.rotation.y = 0.28 + Math.sin(time * 0.4) * 0.05;
    if (this.marker) {
      this.marker.position.y =
        this.assets.heightAt(ELDER_POSITION.x, ELDER_POSITION.z) + 3.35 + Math.sin(time * 2) * 0.12;
      this.marker.rotation.y = time * 0.7;
    }
    if (this.motes) {
      this.motes.position.x = Math.sin(time * 0.12) * 0.8;
      this.motes.position.y = Math.sin(time * 0.3) * 0.15;
    }
    this.people.forEach(
      (person, i) => (person.rotation.y = Math.sin(time * 0.15 + i) * 0.6 + i * 1.5),
    );
  }
  setStoryRead(read: boolean) {
    if (this.marker) this.marker.visible = !read;
  }
}
