import * as THREE from 'three';
import { type Quality } from '../game/config';
import { glowTexture } from './materials';
interface Particle {
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: THREE.Color;
}
export class Effects {
  group = new THREE.Group();
  private particles: Particle[] = [];
  private mesh: THREE.InstancedMesh;
  private next = 0;
  private nextRipple = 0;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private limit = 200;
  private ripples: { mesh: THREE.Mesh; life: number; duration: number; size: number }[] = [];
  private drops: THREE.Points;
  private dropPositions: Float32Array;
  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 4, 3),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
      200,
    );
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.mesh);
    for (let i = 0; i < 200; i++) {
      this.particles.push({
        life: 0,
        maxLife: 1,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0,
        color: new THREE.Color(),
      });
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, new THREE.Color());
    }
    for (let i = 0; i < 38; i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.92, 1, 28),
        new THREE.MeshBasicMaterial({
          color: 0x8cb8c7,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.ripples.push({ mesh, life: 0, duration: 1, size: 1 });
    }
    this.dropPositions = new Float32Array(96 * 3);
    for (let i = 0; i < 96; i++) {
      this.dropPositions[i * 3] = (Math.random() - 0.5) * 28;
      this.dropPositions[i * 3 + 1] = Math.random() * 13;
      this.dropPositions[i * 3 + 2] = (Math.random() - 0.5) * 45;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(this.dropPositions, 3));
    this.drops = new THREE.Points(
      geom,
      new THREE.PointsMaterial({
        color: 0xb2ced8,
        size: 0.055,
        transparent: true,
        opacity: 0.38,
        map: glowTexture(),
        depthWrite: false,
      }),
    );
    this.drops.frustumCulled = false;
    this.group.add(this.drops);
  }
  burst(x: number, y: number, z: number, color: number, count = 12, force = 3) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.next++ % this.limit];
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = (Math.random() - 0.5) * force;
      p.vy = 1 + Math.random() * force;
      p.vz = (Math.random() - 0.5) * force;
      p.life = p.maxLife = 0.25 + Math.random() * 0.45;
      p.size = 0.025 + Math.random() * 0.07;
      p.color.setHex(color);
    }
  }
  ripple(x: number, z: number, size = 1) {
    const r = this.ripples[this.nextRipple++ % this.ripples.length];
    r.life = r.duration = 1.1;
    r.size = size;
    r.mesh.position.set(x, 0.058, z);
    r.mesh.visible = true;
  }
  splash(x: number, z: number, size = 1) {
    this.ripple(x, z, size);
    this.burst(x, 0.08, z, 0x92becb, 5, size * 1.7);
  }
  update(dt: number, time: number, playerZ: number) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life > 0) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 9 * dt;
        this.dummy.position.set(p.x, Math.max(0.04, p.y), p.z);
        this.dummy.scale.setScalar((p.size * p.life) / p.maxLife);
        this.color.copy(p.color).multiplyScalar(Math.min(1, p.life * 5));
        this.mesh.setColorAt(i, this.color);
      } else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (const r of this.ripples) {
      if (r.life <= 0) continue;
      r.life -= dt;
      r.mesh.scale.setScalar((1 - r.life / r.duration) * r.size + 0.08);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (r.life / r.duration) * 0.35,
      );
      if (r.life <= 0) r.mesh.visible = false;
    }
    for (let i = 0; i < 96; i++) {
      this.dropPositions[i * 3 + 1] -= dt * (3 + (i % 3));
      if (this.dropPositions[i * 3 + 1] < 0) {
        this.dropPositions[i * 3 + 1] = 10 + (i % 5);
        if (i % 11 === 0)
          this.ripple(this.dropPositions[i * 3], this.dropPositions[i * 3 + 2] + playerZ, 0.35);
      }
    }
    this.drops.position.z = playerZ;
    this.drops.geometry.attributes.position.needsUpdate = true;
  }
  setQuality(q: Quality) {
    this.limit = q === 'high' ? 200 : q === 'medium' ? 120 : 60;
    this.drops.geometry.setDrawRange(0, q === 'high' ? 96 : q === 'medium' ? 56 : 24);
  }
}
