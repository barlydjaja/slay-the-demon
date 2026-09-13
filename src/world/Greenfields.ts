import * as THREE from 'three';
import { FirstlightAssets } from './FirstlightAssets';
import {
  FIRSTLIGHT_PARTS,
  MARA_POSITION,
  RESTORED_CHILD_POSITION,
  type FirstlightPart,
  type FirstlightQuest,
} from '../progression/FirstlightQuest';
import { CollisionSystem, type Obstacle } from '../game/CollisionSystem';
import { seededRandom } from '../game/math';
import { FieldAssets, type Placement } from './FieldAssets';
import {
  ELDER_POSITION,
  FIELD_BOUNDS,
  FIELD_ENCOUNTERS,
  VILLAGE,
  VILLAGE_WALLS,
} from './GreenfieldsConfig';
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
  private restored = false;
  private sailSpeed = 0;
  private lastUpdate = -1;
  private restoredProps = new THREE.Group();
  private restoredObstacles: Obstacle[] = [];
  private questMarker = new THREE.Group();
  private pickups = new Map<FirstlightPart, THREE.Group>();
  private marker?: THREE.Mesh;
  private people: THREE.Group[] = [];
  private motes?: THREE.Points;
  private constructor(
    private collision: CollisionSystem,
    public assets: FieldAssets,
    private components: FirstlightAssets,
  ) {
    this.group.name = 'The Greenfields · Blender landscape';
    collision.heightAt = assets.heightAt;
  }
  static async create(
    collision: CollisionSystem,
    report: (progress: number, label: string) => Promise<void>,
    library?: FieldAssets,
    componentLibrary?: FirstlightAssets,
  ) {
    await report(31, 'Unpacking the meadow and its little details…');
    const [assets, components] = await Promise.all([
      library ?? FieldAssets.load(),
      componentLibrary ?? FirstlightAssets.load(),
    ]);
    const field = new Greenfields(collision, assets, components);
    const stages: [number, string, () => void][] = [
      [38, 'Following the hills and winding paths…', () => field.terrain()],
      [43, 'Setting the old stones among the trees…', () => field.landmarks()],
      [49, 'Opening the doors of Firstlight…', () => field.village()],
      [54, 'Growing the woodland at the edges…', () => field.woodland()],
      [60, 'Planting ferns, flowers, and meadow grass…', () => field.vegetation()],
      [65, 'Elder Rowan is waiting in the shade…', () => field.characters()],
      [69, 'Remembering the voices of Firstlight…', () => field.firstlight()],
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
    this.fortifications();
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
  private fortifications() {
    const w = VILLAGE_WALLS;
    const segment = (x: number, z: number, length: number, yaw = 0) => {
      // Scaling only the length retains the authored wall height and foundation depth.
      const root = this.put('village_wall', x, z, 1, yaw);
      root.scale.x = length / 4;
      this.collision.add(x, z, yaw ? 1.4 : length, yaw ? length : 1.4);
    };
    for (let z = -40; z <= -12; z += 4) {
      segment(w.west, z, 4, Math.PI / 2);
      segment(w.east, z, 4, Math.PI / 2);
    }
    for (let x = 2; x < 34; x += 4) segment(x, w.north, 4);
    segment(33, w.north, 2);
    // South wall ends meet the gate piers. The eight-metre opening follows the path.
    segment(5, w.south, 10);
    for (let x = 20; x <= 32; x += 4) segment(x, w.south, 4);
    this.put('village_gate', w.gateX, w.south);
    this.collision.add(10.25, -11.6, 0.45, 3.6);
    this.collision.add(17.75, -11.6, 0.45, 3.6);
    for (const x of [w.west, w.east])
      for (const z of [w.north, w.south]) {
        this.put('village_tower', x, z);
        this.collision.add(x, z, 2.8, 2.8);
      }
    // Warm gate lanterns make the only entrance readable through the mist.
    for (const x of [10, 18]) this.put('lantern', x, -8.8);
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
        (x > -3 && x < 37 && z > -45 && z < -7) ||
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
        color: 0x9ebfc6,
        size: 0.06,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    this.group.add(this.motes);
  }
  private firstlight() {
    this.put('cart', -18, 16.7, 0.7, 0.6);
    this.collision.add(-18, 16.7, 1.6, 1.5);
    const ringGeometry = new THREE.RingGeometry(0.6, 0.66, 40);
    const glow = new THREE.MeshBasicMaterial({
      color: 0xffd484,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const id of Object.keys(FIRSTLIGHT_PARTS) as FirstlightPart[]) {
      const part = FIRSTLIGHT_PARTS[id],
        group = new THREE.Group();
      group.name = `Recoverable ${part.name}`;
      group.position.set(part.x, this.assets.heightAt(part.x, part.z), part.z);
      const mesh = this.components.clone(id);
      mesh.name = 'floating-component';
      group.add(mesh);
      const ring = new THREE.Mesh(ringGeometry, glow);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      group.add(ring);
      this.group.add(group);
      this.pickups.set(id, group);
    }
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13),
      new THREE.MeshBasicMaterial({ color: 0xffd484 }),
    );
    this.questMarker.add(marker);
    this.questMarker.position.set(
      MARA_POSITION.x,
      this.assets.heightAt(MARA_POSITION.x, MARA_POSITION.z) + 2.6,
      MARA_POSITION.z,
    );
    this.group.add(this.questMarker);
    this.restoredProps.name = 'Firstlight restored · supplies flowers and lanterns';
    this.group.add(this.restoredProps);
    this.restoredProps.visible = false;
    for (const p of [
      { x: 25, z: -34 },
      { x: 25.7, z: -34.3 },
    ])
      this.assets.place(this.restoredProps, 'crate', { ...p, scale: 0.65 });
    this.assets.place(this.restoredProps, 'barrel', { x: 26, z: -35.4, scale: 0.7 });
    for (const [x, z, width, depth] of [
      [25.35, -34.15, 1.2, 0.8],
      [26, -35.4, 0.65, 0.65],
      [13, -17, 0.2, 0.2],
      [20, -17, 0.2, 0.2],
    ]) {
      const obstacle = this.collision.add(x, z, width, depth);
      obstacle.active = false;
      this.restoredObstacles.push(obstacle);
    }
    const blooms: Placement[] = [];
    for (const [x, z] of [
      [11, -15],
      [13, -14],
      [20, -16],
      [23, -18],
    ])
      for (let i = 0; i < 5; i++)
        blooms.push({
          x: x + Math.sin(i * 2.4) * 0.7,
          z: z + Math.cos(i * 2.4) * 0.5,
          scale: 0.85,
          yaw: i,
        });
    this.assets.scatter(this.restoredProps, 'wildflowers', blooms, false);
    for (const x of [13, 20]) {
      this.assets.place(this.restoredProps, 'lantern', { x, z: -17, scale: 0.85 });
      const light = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.085),
        new THREE.MeshBasicMaterial({ color: 0xffd18a, toneMapped: false }),
      );
      light.position.set(x, this.assets.heightAt(x, -17) + 1.65, -17);
      this.restoredProps.add(light);
    }
  }
  syncFirstlight(quest: FirstlightQuest) {
    this.restored = quest.restored;
    this.restoredProps.visible = quest.restored;
    for (const obstacle of this.restoredObstacles) obstacle.active = quest.restored;
    this.questMarker.visible = !quest.restored;
    for (const [id, pickup] of this.pickups) pickup.visible = !quest.has(id);
    if (quest.restored && this.people[2]) {
      const p = RESTORED_CHILD_POSITION;
      this.people[2].position.set(p.x, this.assets.heightAt(p.x, p.z), p.z);
    }
  }
  update(time: number, player?: THREE.Vector3) {
    const dt = this.lastUpdate < 0 ? 0 : Math.min(0.1, Math.max(0, time - this.lastUpdate));
    this.lastUpdate = time;
    this.sailSpeed += ((this.restored ? 0.25 : 0) - this.sailSpeed) * Math.min(1, dt * 0.8);
    if (this.sails) this.sails.rotation.z -= dt * this.sailSpeed;
    for (const [id, pickup] of this.pickups) {
      if (!pickup.visible) continue;
      const part = pickup.children[0];
      part.position.y = 0.4 + Math.sin(time * 1.8 + (id === 'winding' ? 1 : 0)) * 0.08;
      part.rotation.y = time * 0.45;
    }
    this.questMarker.rotation.y = time * 0.7;
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
    if (player)
      for (const person of this.people) {
        if (person.position.distanceToSquared(player) < 25)
          person.rotation.y = Math.atan2(
            player.x - person.position.x,
            player.z - person.position.z,
          );
      }
  }
  setStoryRead(read: boolean) {
    if (this.marker) this.marker.visible = !read;
  }
}
