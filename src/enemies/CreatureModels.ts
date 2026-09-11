import * as THREE from 'three';
import { materials as m } from '../world/materials';
import { box, cylinder, sphere, rod, segment } from '../world/primitives';
const a = new THREE.Vector3(),
  b = new THREE.Vector3(),
  c = new THREE.Vector3();
export class SpiderModel {
  group = new THREE.Group();
  body = new THREE.Group();
  legs: { upper: THREE.Mesh; lower: THREE.Mesh; side: number; index: number }[] = [];
  constructor(public boss = false) {
    this.group.add(this.body);
    sphere(
      this.body,
      boss ? m.cloth : m.iron,
      0,
      boss ? 1.45 : 0.48,
      -0.28,
      boss ? 1.7 : 0.55,
      boss ? 0.88 : 0.35,
      boss ? 2.2 : 0.72,
    );
    sphere(
      this.body,
      m.black,
      0,
      boss ? 1.6 : 0.46,
      boss ? 1.1 : 0.45,
      boss ? 1.1 : 0.4,
      boss ? 0.75 : 0.3,
      boss ? 1 : 0.38,
    );
    if (!boss)
      for (const x of [-0.19, 0, 0.19])
        sphere(this.body, m.redEye, x, 0.56, 0.75, 0.063, 0.045, 0.035);
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++)
        this.legs.push({
          upper: rod(this.group, m.iron),
          lower: rod(this.group, m.black),
          side,
          index: i,
        });
    if (boss) this.buildReaper();
  }
  torso = new THREE.Group();
  scythe = new THREE.Group();
  private buildReaper() {
    this.body.add(this.torso);
    this.torso.position.set(0, 1.5, 0.8);
    cylinder(this.torso, m.cloth, 0, 1, 0, 0.59, 1.05, 2, 9);
    sphere(this.torso, m.cloth, -0.72, 1.72, 0, 0.56, 0.34, 0.48);
    sphere(this.torso, m.cloth, 0.72, 1.72, 0, 0.56, 0.34, 0.48);
    for (const side of [-1, 1]) {
      const arm = box(this.torso, m.cloth, side * 1.04, 1.04, 0.08, 0.37, 1.62, 0.39, true);
      arm.rotation.z = side * 0.33;
      sphere(this.torso, m.bone, side * 1.3, 0.28, 0.16, 0.17, 0.3, 0.14);
      for (let i = 0; i < 3; i++)
        box(
          this.torso,
          m.iron,
          side * (0.18 + i * 0.17),
          0.84 - i * 0.08,
          0.53,
          0.12,
          1.45,
          0.08,
        ).rotation.z = side * -0.1;
    }
    const hood = sphere(this.torso, m.cloth, 0, 2.53, 0, 0.89, 1.11, 0.81);
    hood.rotation.x = -0.1;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.67, 1.22, 7), m.cloth);
    peak.position.set(0, 3.1, -0.14);
    peak.rotation.x = -0.22;
    this.torso.add(peak);
    sphere(this.torso, m.black, 0, 2.43, 0.58, 0.65, 0.77, 0.29);
    sphere(this.torso, m.bone, 0, 2.38, 0.75, 0.36, 0.52, 0.16);
    box(this.torso, m.black, 0, 2.47, 0.899, 0.59, 0.17, 0.02, true);
    for (const x of [-0.17, 0.17])
      box(this.torso, m.redEye, x, 2.46, 0.922, 0.1, 0.06, 0.025, true);
    sphere(this.torso, m.bone, 0, 2.28, 0.93, 0.065, 0.12, 0.07);
    box(this.torso, m.black, 0, 2.11, 0.89, 0.13, 0.035, 0.02);
    this.scythe.position.set(1.4, 0.25, 0.2);
    this.torso.add(this.scythe);
    cylinder(this.scythe, m.wood, 0, 1.6, 0, 0.065, 0.085, 5.5, 8);
    cylinder(this.scythe, m.gold, 0, 2.9, 0, 0.11, 0.11, 0.27);
    const shape = new THREE.Shape();
    shape.moveTo(0.04, 4.15);
    shape.bezierCurveTo(-1.2, 4.55, -3.7, 3.7, -4.2, 2.2);
    shape.bezierCurveTo(-2.8, 3.15, -1.4, 3.54, 0.04, 3.63);
    shape.closePath();
    const blade = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.09,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.04,
        bevelSegments: 1,
        curveSegments: 14,
      }),
      m.iron,
    );
    blade.castShadow = true;
    this.scythe.add(blade);
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 3.64, 0.12),
      new THREE.Vector3(-1.4, 3.54, 0.12),
      new THREE.Vector3(-2.8, 3.15, 0.12),
      new THREE.Vector3(-4.2, 2.2, 0.12),
    );
    this.scythe.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.026, 4, false), m.redEye));
    for (let i = 0; i < 4; i++)
      box(
        this.scythe,
        m.gold,
        -0.3 - i * 0.29,
        3.88 - i * 0.015,
        0.15,
        0.06,
        0.13,
        0.02,
      ).rotation.z = 0.35;
  }
  animate(time: number, moving: boolean, windup = 0, attack = 0, death = 0) {
    const size = this.boss ? 3.3 : 1,
      step = moving ? (this.boss ? 0.26 : 0.18) : 0.035;
    this.body.position.y = Math.sin(time * 3) * 0.035;
    for (const leg of this.legs) {
      const phase = time * (this.boss ? 6 : 13) + leg.index * 1.6 + leg.side;
      const forward = (leg.index - 1.5) * 0.5;
      a.set(leg.side * size * 0.27, size * 0.36, forward * size * 0.68);
      b.set(
        leg.side * size * (0.85 + Math.sin(leg.index) * 0.16),
        size * 0.58,
        forward * size * 1.25 + Math.sin(phase) * step,
      );
      c.set(
        leg.side * size * (1.1 + Math.sin(leg.index) * 0.12),
        0.08 + Math.max(0, Math.cos(phase)) * step,
        forward * size * 1.65 + Math.sin(phase) * step,
      );
      if (death > 0) {
        b.y *= Math.max(0.05, 1 - death);
        c.x *= Math.max(0.5, 1 - death * 0.3);
      }
      segment(leg.upper, a, b, this.boss ? 0.18 : 0.08);
      segment(leg.lower, b, c, this.boss ? 0.115 : 0.055);
    }
    this.torso.rotation.x = windup * -0.23 + attack * 0.3;
    this.scythe.rotation.z = windup * 0.85 - attack * 2.4;
    this.scythe.rotation.y = attack * 2.8;
    if (death > 0) {
      this.body.position.y = -Math.min(1.1, death);
      this.torso.rotation.z = Math.min(1.4, death);
    }
  }
}
export class ArmorModel {
  group = new THREE.Group();
  body = new THREE.Group();
  arms = new THREE.Group();
  legs: THREE.Group[] = [];
  constructor() {
    this.group.add(this.body);
    this.body.position.y = 0.95;
    box(this.body, m.iron, 0, 0.4, 0, 0.85, 1, 0.52, true);
    cylinder(this.body, m.gold, 0, 0.15, 0.28, 0.18, 0.18, 0.04, 6).rotation.x = Math.PI / 2;
    cylinder(this.body, m.iron, 0, 1.2, 0, 0.39, 0.31, 0.67, 8);
    box(this.body, m.black, 0, 1.24, 0.32, 0.62, 0.16, 0.04);
    box(this.body, m.redEye, 0, 1.24, 0.349, 0.4, 0.035, 0.02);
    box(this.body, m.iron, 0, 1.08, 0.38, 0.1, 0.35, 0.13);
    for (const side of [-1, 1]) {
      sphere(this.body, m.iron, side * 0.56, 0.78, 0, 0.31, 0.25, 0.3);
      const arm = box(this.arms, m.iron, side * 0.58, 0.2, 0.03, 0.25, 0.8, 0.29, true);
      arm.rotation.z = side * 0.1;
      const leg = new THREE.Group();
      leg.position.set(side * 0.24, 0.02, 0);
      this.body.add(leg);
      box(leg, m.iron, 0, -0.4, 0, 0.29, 0.7, 0.34, true);
      box(leg, m.darkStone, 0, -0.8, 0.13, 0.32, 0.22, 0.56, true);
      this.legs.push(leg);
    }
    this.body.add(this.arms);
    const sword = box(this.arms, m.lightStone, 0.62, 0.01, 0.68, 0.13, 0.08, 1.55);
    sword.rotation.x = -0.2;
    box(this.arms, m.gold, 0.62, 0.02, 0.14, 0.4, 0.12, 0.12);
    const cape = box(this.body, m.cloth, 0, 0.15, -0.36, 0.72, 1.45, 0.06);
    cape.rotation.x = 0.13;
  }
  animate(t: number, moving: boolean, windup = 0, attack = 0, death = 0) {
    this.legs[0].rotation.x = moving ? Math.sin(t * 8) * 0.4 : 0;
    this.legs[1].rotation.x = -this.legs[0].rotation.x;
    this.arms.rotation.x = -windup * 1.7 + attack * 1.9;
    this.group.rotation.z = death ? Math.min(1.57, death * 2) : 0;
  }
}
