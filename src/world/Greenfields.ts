import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CollisionSystem } from '../game/CollisionSystem';
import { seededRandom } from '../game/math';
import { box, cylinder, sphere } from './primitives';
import { ELDER_POSITION, FIELD_BOUNDS, FIELD_ENCOUNTERS, VILLAGE } from './GreenfieldsConfig';

const material = (color: number) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
export class Greenfields {
  group = new THREE.Group();
  elder = new THREE.Group();
  private static = new THREE.Group();
  private rng = seededRandom(73291);
  private wood = material(0x715338);
  private bark = material(0x5b4d35);
  private stone = material(0x969981);
  private leaf = material(0x62944c);
  private leafLight = material(0x90af53);
  private gold = material(0xe2b84f);
  private dark = material(0x324b47);
  private cream = material(0xe8d5a4);
  private marker = new THREE.Group();
  private blades = new THREE.Group();
  private villagers: { group: THREE.Group; x: number; z: number; phase: number }[] = [];
  private motes: THREE.Points;
  constructor(private collision: CollisionSystem) {
    this.group.name = 'Chapter II — The Greenfields';
    this.group.add(this.static);
    this.ground();
    this.path();
    this.surroundings();
    this.village();
    this.elder = this.person(0x587e87, true);
    this.elder.position.set(ELDER_POSITION.x, 0, ELDER_POSITION.z);
    this.group.add(this.elder);
    collision.add(ELDER_POSITION.x, ELDER_POSITION.z, 0.8, 0.8);
    this.tree(-7, 25, 1.6);
    this.marker.position.set(ELDER_POSITION.x, 3.35, ELDER_POSITION.z);
    const light = new THREE.MeshBasicMaterial({ color: 0xffe1a1 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 4, 16), light);
    ring.rotation.y = Math.PI / 4;
    this.marker.add(ring);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), light);
    this.marker.add(gem);
    this.group.add(this.marker);
    this.grass();
    const points = new Float32Array(100 * 3);
    for (let i = 0; i < points.length; i += 3) {
      points[i] = (this.rng() - 0.5) * 75;
      points[i + 1] = 0.6 + this.rng() * 4;
      points[i + 2] = -60 + this.rng() * 100;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    this.motes = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xffefb5,
        size: 0.07,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
    this.group.add(this.motes);
    this.batchStatic();
  }
  private ground() {
    const geo = new THREE.PlaneGeometry(210, 210, 70, 70);
    geo.rotateX(-Math.PI / 2);
    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i);
      const shade = Math.sin(x * 0.19 + Math.cos(z * 0.1)) * 0.028 + Math.cos(z * 0.27) * 0.018;
      color.setHSL(0.245 + shade * 0.5, 0.36, 0.38 + shade + this.rng() * 0.025);
      color.toArray(colors, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    );
    mesh.position.set(0, -0.035, -10);
    mesh.receiveShadow = true;
    this.static.add(mesh);
    // Distant layered hills keep the playable meadow flat and collision predictable.
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const hill = sphere(
        this.static,
        material(i % 2 ? 0x63876b : 0x7c9b79),
        Math.sin(a) * 79,
        -4,
        Math.cos(a) * 86 - 12,
        20 + this.rng() * 10,
        9 + this.rng() * 13,
        22,
      );
      hill.castShadow = false;
    }
  }
  private pathX(z: number) {
    return Math.max(0, Math.min(16, (30 - z) * 0.34));
  }
  private path() {
    const pathMaterial = material(0xb9a977);
    for (let z = -32; z < 44; z += 2) {
      const mesh = cylinder(
        this.static,
        pathMaterial,
        this.pathX(z),
        -0.009,
        z,
        2.6,
        2.6,
        0.025,
        12,
      );
      mesh.castShadow = false;
    }
    cylinder(this.static, pathMaterial, VILLAGE.x, 0.005, VILLAGE.z, 9, 9, 0.026, 32).castShadow =
      false;
    // The weathered castle portal sits behind the player, framed by green foothills.
    for (const s of [-1, 1]) {
      box(this.static, this.stone, s * 4.2, 3.3, 42.5, 2, 6.6, 2.4);
      for (let i = 0; i < 4; i++)
        box(this.static, this.dark, s * 4.2, i * 1.5 + 0.3, 41.24, 2.1, 0.14, 0.12);
    }
    box(this.static, this.stone, 0, 6.7, 42.5, 10.5, 1.4, 2.5);
    box(this.static, this.dark, 0, 2.8, 43.4, 6.5, 5.6, 0.3);
    this.collision.add(0, 43, 12, 2);
    for (const s of [-1, 1])
      for (let i = 0; i < 7; i++)
        sphere(
          this.static,
          this.stone,
          s * (7 + i * 4.5),
          0,
          43 + this.rng() * 2,
          3.1,
          2 + this.rng() * 2,
          2.7,
        );
  }
  private tree(x: number, z: number, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    cylinder(group, this.bark, 0, 2.1, 0, 0.23, 0.49, 4.2, 7);
    for (const s of [-1, 1]) {
      const branch = cylinder(group, this.bark, s * 0.5, 3.35, 0, 0.12, 0.24, 1.9, 6);
      branch.rotation.z = -s * 0.65;
      sphere(group, this.leaf, s * 1.2, 4.6, 0.1, 1.95, 1.7, 1.75);
    }
    sphere(group, this.leafLight, -0.35, 5.6, -0.3, 2, 1.5, 1.8);
    sphere(group, this.leaf, 0.25, 4.5, -1.1, 1.6, 1.7, 1.8);
    this.static.add(group);
    if (Math.abs(x) < FIELD_BOUNDS.halfWidth && z > FIELD_BOUNDS.minZ && z < FIELD_BOUNDS.maxZ)
      this.collision.add(x, z, 0.85 * scale, 0.85 * scale);
  }
  private surroundings() {
    for (let i = 0; i < 90; i++) {
      const side = i % 2 ? -1 : 1;
      const x = side * (37 + this.rng() * 17),
        z = -70 + this.rng() * 115;
      this.tree(x, z, 0.8 + this.rng() * 0.5);
    }
    for (let i = 0; i < 22; i++)
      this.tree(-38 + i * 3.7, -64 - this.rng() * 9, 1 + this.rng() * 0.35);
    for (const [x, z] of [
      [-28, 18],
      [26, 24],
      [-30, -13],
      [-3, -31],
      [33, -34],
      [-26, -54],
    ])
      this.tree(x, z, 1.05);
    for (let i = 0; i < 55; i++) {
      const x = (this.rng() - 0.5) * 74,
        z = -59 + this.rng() * 93;
      if (
        Math.abs(x - this.pathX(z)) < 5 ||
        Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 18 ||
        FIELD_ENCOUNTERS.some((e) => Math.hypot(x - e.x, z - e.z) < 3)
      )
        continue;
      const size = 0.35 + this.rng() * 0.75;
      const rock = sphere(this.static, this.stone, x, size * 0.35, z, size, size * 0.8, size * 0.8);
      rock.rotation.y = this.rng() * 6;
      if (size > 0.65) this.collision.add(x, z, size * 1.3, size * 1.3);
    }
  }
  private roof(parent: THREE.Group, width: number, depth: number, base: number, color: number) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(0, width * 0.38);
    shape.lineTo(width / 2, 0);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    const mesh = new THREE.Mesh(geometry, material(color));
    mesh.position.set(0, base, -depth / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    for (const s of [-1, 1]) {
      const trim = box(
        parent,
        this.wood,
        (s * width) / 4,
        base + width * 0.19,
        depth / 2 + 0.03,
        width * 0.63,
        0.12,
        0.13,
      );
      trim.rotation.z = -s * Math.atan(0.76);
    }
  }
  private cottage(x: number, z: number, color: number, rotation = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotation;
    box(g, this.stone, 0, 0.2, 0, 5.2, 0.4, 4.7);
    box(g, this.cream, 0, 1.7, 0, 4.8, 3, 4.3);
    this.roof(g, 6, 5.4, 3.2, color);
    for (const s of [-1, 1]) {
      box(g, this.wood, s * 2.36, 1.8, 2.19, 0.15, 2.9, 0.14);
      box(g, this.dark, s * 1.4, 2.05, 2.2, 0.85, 0.9, 0.08);
      box(g, this.gold, s * 1.4, 2.05, 2.25, 0.58, 0.62, 0.02);
      box(g, this.wood, s * 1.4, 2.05, 2.29, 0.06, 0.76, 0.035);
      box(g, this.wood, s * 1.4, 2.05, 2.29, 0.75, 0.06, 0.035);
      box(g, this.wood, s * 1.4, 1.4, 2.36, 1.1, 0.24, 0.4);
      for (let i = 0; i < 3; i++)
        sphere(g, this.leafLight, s * 1.4 + (i - 1) * 0.3, 1.56, 2.36, 0.2);
    }
    box(g, this.wood, 0, 1.2, 2.22, 1.05, 2, 0.12);
    sphere(g, this.gold, 0.3, 1.1, 2.32, 0.055);
    box(g, this.stone, 0, 0.25, 2.65, 1.7, 0.3, 0.8);
    box(g, this.stone, -1.5, 4.3, -0.9, 0.66, 2.3, 0.75);
    for (let i = 0; i < 3; i++)
      cylinder(g, this.wood, 3 + i * 0.3, 0.4, -1 + i * 0.6, 0.37, 0.36, 0.8, 10);
    this.static.add(g);
    const sideways = Math.abs(Math.sin(rotation)) > 0.5;
    this.collision.add(x, z, sideways ? 4.7 : 5.2, sideways ? 5.2 : 4.7);
  }
  private village() {
    this.cottage(8, -22, 0xa05c42, Math.PI / 2);
    this.cottage(9, -32, 0x607e77);
    this.cottage(21, -33, 0xa97949);
    this.cottage(27, -23, 0x965c4c, -Math.PI / 2);
    // Well: an open stone ring, timber winch, bucket and little tiled roof.
    const well = new THREE.Group();
    well.position.set(16, 0, -23);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const block = box(well, this.stone, Math.sin(a), 0.45, Math.cos(a), 0.58, 0.9, 0.42);
      block.rotation.y = a;
    }
    cylinder(well, material(0x6aafb3), 0, 0.2, 0, 0.8, 0.8, 0.03, 16);
    for (const s of [-1, 1]) box(well, this.wood, s * 1.15, 1.5, 0, 0.17, 3, 0.19);
    this.roof(well, 3.2, 2.6, 2.8, 0x6b837b);
    const axle = cylinder(well, this.wood, 0, 1.8, 0, 0.1, 0.1, 2.6);
    axle.rotation.z = Math.PI / 2;
    cylinder(well, this.wood, 0.15, 1.2, 0, 0.018, 0.018, 1.1, 4);
    cylinder(well, this.wood, 0.15, 0.72, 0, 0.22, 0.16, 0.3, 8);
    this.static.add(well);
    this.collision.add(16, -23, 2.3, 2.3);
    // Windmill on the village hill, with four independently rotating sails.
    const mill = new THREE.Group();
    mill.position.set(29, 0, -36);
    cylinder(mill, this.cream, 0, 3, 0, 1.2, 2, 6, 10);
    cylinder(mill, material(0x6b7e70), 0, 6.5, 0, 0, 1.7, 1.8, 10);
    this.blades.position.set(0, 4.9, 1.7);
    for (let i = 0; i < 4; i++) {
      const sail = new THREE.Group();
      sail.rotation.z = (i * Math.PI) / 2;
      box(sail, this.wood, 0, 1.65, 0, 0.11, 3.5, 0.13);
      box(sail, this.cream, 0.35, 2.1, 0.02, 0.8, 2.2, 0.06);
      for (let j = 0; j < 5; j++)
        box(sail, this.wood, 0.35, 1.12 + j * 0.48, 0.07, 0.85, 0.04, 0.05);
      this.blades.add(sail);
    }
    sphere(this.blades, this.wood, 0, 0, 0.15, 0.25);
    mill.add(this.blades);
    this.group.add(mill);
    this.collision.add(29, -36, 3.8, 3.8);
    // Lanterns mark the safe approach; no extra shadow-casting point lights.
    const lantern = new THREE.MeshStandardMaterial({
      color: 0xffda84,
      emissive: 0xffb24c,
      emissiveIntensity: 0.7,
    });
    for (const x of [12, 20]) {
      box(this.static, this.wood, x, 1.4, -9, 0.18, 2.8, 0.18);
      box(this.static, this.dark, x, 2.9, -9, 0.6, 0.15, 0.6);
      box(this.static, lantern, x, 2.55, -9, 0.35, 0.5, 0.35);
      this.collision.add(x, -9, 0.25, 0.25);
    }
    for (let i = 0; i < 10; i++) {
      const x = 4.5 + i * 3.1;
      box(this.static, this.wood, x, 0.7, -39, 0.15, 1.4, 0.15);
      if (i < 9) box(this.static, this.wood, x + 1.55, 0.9, -39, 3.1, 0.1, 0.1);
    }
    this.collision.add(18.5, -39, 28.5, 0.2);
    // A small tended vegetable plot beside the houses.
    box(this.static, material(0x66533b), 3.8, 0.01, -29, 3.2, 0.04, 5.3);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 6; col++)
        sphere(this.static, this.leafLight, 2.8 + row, 0.2, -31.2 + col * 0.8, 0.25, 0.2, 0.3);
    for (const [x, z, color] of [
      [12, -19, 0xb77b4c],
      [21, -26, 0x647b97],
      [18, -31, 0x9f7079],
    ]) {
      const g = this.person(color, false);
      g.position.set(x, 0, z);
      this.group.add(g);
      this.villagers.push({ group: g, x, z, phase: this.rng() * 6 });
    }
  }
  private person(color: number, elder: boolean) {
    const g = new THREE.Group(),
      skin = material(0xc7a27c),
      hair = material(elder ? 0xe6e3cd : 0x564237),
      coat = material(color);
    cylinder(g, coat, 0, 0.8, 0, 0.31, 0.48, 1.3, 8);
    sphere(g, skin, 0, 1.73, 0.015, 0.32, 0.39, 0.3);
    sphere(g, hair, 0, 1.96, -0.065, 0.34, 0.19, 0.29);
    for (const s of [-1, 1]) {
      box(g, this.wood, s * 0.2, 0.12, 0.13, 0.22, 0.2, 0.4, true);
      cylinder(g, coat, s * 0.43, 1.02, 0.03, 0.16, 0.12, 0.72, 7);
      sphere(g, skin, s * 0.44, 0.65, 0.08, 0.115);
      sphere(g, this.dark, s * 0.12, 1.78, 0.297, 0.033, 0.028, 0.021);
      box(g, hair, s * 0.12, 1.87, 0.28, 0.16, 0.035, 0.04);
    }
    sphere(g, skin, 0, 1.69, 0.32, 0.07, 0.08, 0.09);
    if (elder) {
      cylinder(g, hair, 0, 1.38, 0.22, 0.26, 0.065, 0.62, 7);
      sphere(g, hair, -0.27, 1.73, -0.08, 0.11, 0.3, 0.22);
      sphere(g, hair, 0.27, 1.73, -0.08, 0.11, 0.3, 0.22);
      cylinder(g, this.wood, 0.61, 1.17, 0.2, 0.045, 0.055, 2.34, 7);
      sphere(g, this.gold, 0.61, 2.4, 0.2, 0.12, 0.15, 0.12);
      box(g, this.cream, -0.15, 1.03, 0.32, 0.17, 0.8, 0.1);
    }
    // People move as whole silhouettes; merge their static parts by material.
    g.updateMatrixWorld(true);
    const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
    g.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      if (!parts.has(object.material)) parts.set(object.material, []);
      let geo = object.geometry.clone();
      if (geo.index) {
        const old = geo;
        geo = geo.toNonIndexed();
        old.dispose();
      }
      geo.deleteAttribute('uv');
      geo.applyMatrix4(object.matrixWorld);
      parts.get(object.material)!.push(geo);
    });
    g.clear();
    for (const [mat, geometries] of parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries, false)!, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      for (const geo of geometries) geo.dispose();
    }
    return g;
  }
  private grass() {
    const blade = new THREE.BufferGeometry();
    blade.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [-0.11, 0, 0, 0.11, 0, 0, 0.035, 0.6, 0.035, 0, 0, -0.11, 0, 0, 0.11, 0.04, 0.45, 0.02],
        3,
      ),
    );
    blade.computeVertexNormals();
    const instances = new THREE.InstancedMesh(
      blade,
      new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 1 }),
      5200,
    );
    const dummy = new THREE.Object3D(),
      color = new THREE.Color();
    let count = 0;
    for (let i = 0; i < 8500 && count < 5200; i++) {
      const x = (this.rng() - 0.5) * 80,
        z = -65 + this.rng() * 107;
      if (
        Math.abs(x - this.pathX(z)) < 3 ||
        Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 13 ||
        this.collision.blocked(x, z, 0.1)
      )
        continue;
      dummy.position.set(x, 0, z);
      dummy.rotation.y = this.rng() * 6.28;
      dummy.scale.setScalar(0.5 + this.rng() * 0.65);
      dummy.updateMatrix();
      instances.setMatrixAt(count, dummy.matrix);
      color.setHSL(0.21 + this.rng() * 0.07, 0.4, 0.35 + this.rng() * 0.13);
      instances.setColorAt(count, color);
      count++;
    }
    instances.count = count;
    instances.receiveShadow = true;
    instances.computeBoundingSphere();
    this.group.add(instances);
    const petals = [material(0xf3d671), material(0xd7dfd2), material(0xc18cab)];
    for (let i = 0; i < 330; i++) {
      const z = -56 + this.rng() * 93,
        x = (this.rng() - 0.5) * 69;
      if (
        Math.abs(x - this.pathX(z)) < 3 ||
        Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 14 ||
        this.collision.blocked(x, z, 0.3)
      )
        continue;
      cylinder(this.static, this.leaf, x, 0.2, z, 0.016, 0.02, 0.4, 4).castShadow = false;
      sphere(this.static, petals[i % 3], x, 0.42, z, 0.13, 0.07, 0.13).castShadow = false;
    }
    for (let z = -6; z < 22; z += 2.3) {
      const x = this.pathX(z) + 3.3;
      cylinder(this.static, this.leaf, x, 0.55, z, 0.035, 0.05, 1.1, 5);
      const flower = sphere(this.static, this.gold, x, 1.12, z, 0.32, 0.29, 0.07);
      flower.rotation.y = 0.3;
      sphere(this.static, this.wood, x, 1.12, z + 0.065, 0.14, 0.14, 0.055);
    }
  }
  private batchStatic() {
    // Spatial cells + shared materials: grass is instanced, scenery submits only nearby cells.
    this.static.updateMatrixWorld(true);
    const batches = new Map<
      string,
      { material: THREE.Material; geometries: THREE.BufferGeometry[] }
    >();
    const originals = new Set<THREE.BufferGeometry>();
    this.static.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      const position = object.getWorldPosition(new THREE.Vector3());
      const key = `${object.material.uuid}:${Math.floor(position.x / 24)}:${Math.floor(position.z / 24)}`;
      if (!batches.has(key)) batches.set(key, { material: object.material, geometries: [] });
      // Normalize indexed/non-indexed geometries and attributes for batching.
      let geo = object.geometry.clone();
      if (geo.index) {
        const old = geo;
        geo = geo.toNonIndexed();
        old.dispose();
      }
      geo.deleteAttribute('uv');
      geo.applyMatrix4(object.matrixWorld);
      batches.get(key)!.geometries.push(geo);
      originals.add(object.geometry);
    });
    this.static.clear();
    for (const batch of batches.values()) {
      const geometry = mergeGeometries(batch.geometries, false);
      for (const geo of batch.geometries) geo.dispose();
      if (!geometry) throw new Error('Could not build meadow scenery');
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, batch.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.static.add(mesh);
    }
    // Primitive cache retains reusable geometry; unique ground/roof copies can be released.
    for (const geometry of originals) geometry.dispose();
  }
  update(time: number) {
    this.blades.rotation.z = -time * 0.23;
    this.elder.rotation.y = 0.28 + Math.sin(time * 0.4) * 0.07;
    this.elder.position.y = Math.sin(time * 1.5) * 0.012;
    this.marker.position.y = 3.35 + Math.sin(time * 2) * 0.12;
    this.marker.rotation.y = time * 0.7;
    this.motes.position.x = Math.sin(time * 0.1) * 1.3;
    this.motes.position.y = Math.sin(time * 0.25) * 0.25;
    for (const v of this.villagers) {
      v.group.rotation.y = Math.sin(time * 0.15 + v.phase) * 0.65 + v.phase;
      v.group.position.y = Math.sin(time * 1.8 + v.phase) * 0.014;
    }
  }
  setStoryRead(read: boolean) {
    this.marker.visible = !read;
  }
}
