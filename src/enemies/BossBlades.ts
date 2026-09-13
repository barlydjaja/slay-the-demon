import * as THREE from 'three';
import { distanceToSegmentSquared, REAVE_RELEASE } from './BossAI';
import { PLAYER } from '../game/config';
import type { Player } from '../player/Player';

export const BLADE_RADIUS = 1;
interface Flight {
  points: THREE.Vector3[];
  start: number;
  duration: number;
  blade: THREE.Group;
  warning: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  hit: boolean;
  edge: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
}
/** Every visible flight and its warning use the same sampled world-space path. */
export class BossBlades {
  readonly group = new THREE.Group();
  private flights: Flight[] = [];
  onDamage = (_blocked: boolean) => {};
  constructor(private template: THREE.Group) {
    // Retain the shared mesh in the scene graph so map cleanup can dispose its GPU buffers.
    template.visible = false;
    this.group.add(template);
  }
  get activeCount() {
    return this.flights.length;
  }
  get paths() {
    return this.flights.map((f) => ({ points: f.points, start: f.start, duration: f.duration }));
  }
  private flight(points: THREE.Vector3[], start: number, duration: number) {
    const blade = this.template.clone(true);
    blade.position.y = 1.15;
    blade.rotation.order = 'YXZ';
    blade.traverse((p) => {
      if (!(p instanceof THREE.Mesh)) return;
      p.material = new THREE.MeshStandardMaterial({
        color: 0xa9c1d1,
        emissive: 0x9440a4,
        emissiveIntensity: 1.4,
        metalness: 0.65,
        roughness: 0.3,
      });
      p.castShadow = true;
    });
    const positions: number[] = [],
      colors: number[] = [],
      edges: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1];
      const dx = b.x - a.x,
        dz = b.z - a.z,
        length = Math.hypot(dx, dz) || 1;
      const x = (dz / length) * BLADE_RADIUS,
        z = (-dx / length) * BLADE_RADIUS;
      for (const [u, v] of [
        [-1, -0.88],
        [-0.88, 0.88],
        [0.88, 1],
      ]) {
        for (const [p, k] of [
          [a, u],
          [a, v],
          [b, v],
          [a, u],
          [b, v],
          [b, u],
        ] as const) {
          positions.push(p.x + x * k, 0.085, p.z + z * k);
          colors.push(1, 1, 1, Math.abs(k) === 1 ? 0 : 1);
        }
      }
      if (i % 4 < 3)
        for (const side of [-1, 1])
          edges.push(a.x + x * side, 0.09, a.z + z * side, b.x + x * side, 0.09, b.z + z * side);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geometry.computeVertexNormals();
    geometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2),
    );
    const warning = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0xc078aa,
        vertexColors: true,
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      }),
    );
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
    const edge = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({
        color: 0xcd799e,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        fog: false,
      }),
    );
    blade.visible = false;
    this.group.add(warning, blade, edge);
    this.flights.push({ points, start, duration, blade, warning, edge, hit: false });
  }
  reave(origin: THREE.Vector3, angle: number) {
    this.reset();
    const points: THREE.Vector3[] = [];
    // Outward hook on the left, wide bowed return on the right: backtracking is dangerous.
    for (let i = 0; i <= 80; i++) {
      const t = i / 80,
        forward = Math.sin(Math.PI * t) * 10;
      const side = Math.sin(Math.PI * t * 2) * (t < 0.5 ? 1.65 : 3.8);
      points.push(
        new THREE.Vector3(
          origin.x + Math.sin(angle) * forward + Math.cos(angle) * side,
          0,
          origin.z + Math.cos(angle) * forward - Math.sin(angle) * side,
        ),
      );
    }
    this.flight(points, REAVE_RELEASE, 2.63);
  }
  loom(center: THREE.Vector3) {
    this.reset();
    const cx = THREE.MathUtils.clamp(center.x, -1.5, 1.5),
      cz = THREE.MathUtils.clamp(center.z, -138, -128);
    [0.15, 0.65, 1.2, 1.7].forEach((start, i) => {
      const reverse = i >= 2 ? -1 : 1,
        slope = i % 2 === 0 ? 1 : -1;
      const points = Array.from({ length: 33 }, (_, j) => {
        const t = ((j / 32) * 2 - 1) * reverse;
        return new THREE.Vector3(cx + t * 9, 0, cz + t * 7 * slope);
      });
      this.flight(points, start, 1.35);
    });
  }
  private point(f: Flight, t: number) {
    const n = THREE.MathUtils.clamp((t - f.start) / f.duration, 0, 1) * (f.points.length - 1);
    const i = Math.min(f.points.length - 2, Math.floor(n));
    return f.points[i].clone().lerp(f.points[i + 1], n - i);
  }
  update(before: number, elapsed: number, player: Player, damage: number) {
    for (const f of this.flights) {
      const end = f.start + f.duration;
      f.edge.visible = f.warning.visible = elapsed < end;
      f.warning.material.opacity = elapsed < 0 ? 0.035 + 0.018 * Math.sin(elapsed * 4) ** 2 : 0.025;
      f.blade.visible = elapsed >= f.start && elapsed <= end;
      if (f.blade.visible) {
        f.blade.position.copy(this.point(f, elapsed));
        f.blade.position.y = 1.15;
        f.blade.rotation.set(-Math.PI / 2, (elapsed - f.start) * 11, 0);
      }
      if (f.hit || elapsed < f.start || before > end) continue;
      // Subdivide at authored path samples so even a slow frame cannot cut across a bend.
      const from = Math.max(before, f.start),
        to = Math.min(elapsed, end);
      const steps = Math.max(1, Math.ceil(((to - from) / f.duration) * (f.points.length - 1)));
      let a = this.point(f, from);
      for (let i = 1; i <= steps; i++) {
        const b = this.point(f, from + ((to - from) * i) / steps);
        if (
          distanceToSegmentSquared(player.position.x, player.position.z, a.x, a.z, b.x, b.z) <=
          (BLADE_RADIUS + PLAYER.radius) ** 2
        ) {
          const result = player.takeDamage(damage, a.x, a.z, true);
          if (result !== 'miss') this.onDamage(result === 'blocked');
          f.hit = true;
          break;
        }
        a = b;
      }
    }
  }
  reset() {
    for (const f of this.flights) {
      f.warning.geometry.dispose();
      f.warning.material.dispose();
      f.edge.geometry.dispose();
      f.edge.material.dispose();
      f.blade.traverse((p) => {
        if (p instanceof THREE.Mesh) (p.material as THREE.Material).dispose();
      });
    }
    this.group.clear();
    this.group.add(this.template);
    this.flights = [];
  }
}
