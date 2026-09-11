import * as THREE from 'three';
import { materials as m } from '../world/materials';
import { box, cylinder, sphere } from '../world/primitives';
export class RobotModel {
  group = new THREE.Group();
  body = new THREE.Group();
  head = new THREE.Group();
  leftLeg = new THREE.Group();
  rightLeg = new THREE.Group();
  leftArm = new THREE.Group();
  swordArm = new THREE.Group();
  sword = new THREE.Group();
  trail: THREE.Mesh;
  constructor() {
    const root = this.group;
    root.add(this.body);
    this.body.position.y = 0.88;
    box(this.body, m.blue, 0, 0.12, 0, 0.93, 0.88, 0.63, true);
    box(this.body, m.blueEdge, 0, 0.45, 0, 0.82, 0.12, 0.65, true);
    box(this.body, m.iron, 0, -0.31, 0, 0.8, 0.13, 0.62, true);
    box(this.body, m.black, 0, 0.08, 0.329, 0.43, 0.38, 0.03, true);
    cylinder(this.body, m.gold, 0, 0.08, 0.36, 0.13, 0.13, 0.04, 12).rotation.x = Math.PI / 2;
    sphere(this.body, m.eye, 0, 0.08, 0.388, 0.058, 0.058, 0.018);
    for (const x of [-0.32, 0.32])
      for (const y of [-0.16, 0.35]) sphere(this.body, m.iron, x, y, 0.33, 0.032);
    box(this.body, m.rust, -0.33, 0.2, 0.323, 0.08, 0.23, 0.012).rotation.z = -0.5;
    box(this.body, m.rust, 0.24, -0.17, 0.329, 0.16, 0.045, 0.012).rotation.z = 0.2;
    box(this.body, m.iron, 0, 0.18, -0.4, 0.58, 0.57, 0.25, true);
    for (let i = 0; i < 3; i++)
      box(this.body, m.gold, -0.16 + i * 0.16, 0.2, -0.535, 0.06, 0.29, 0.03);
    this.head.position.y = 0.98;
    this.body.add(this.head);
    cylinder(this.body, m.iron, 0, 0.62, 0, 0.18, 0.18, 0.22);
    box(this.head, m.blue, 0, 0, 0, 1.37, 0.88, 0.84, true);
    box(this.head, m.blueEdge, 0, 0.37, -0.01, 1.24, 0.11, 0.79, true);
    box(this.head, m.iron, 0, -0.28, 0.405, 1.14, 0.21, 0.08, true);
    box(this.head, m.black, 0, 0.03, 0.429, 1.11, 0.45, 0.09, true);
    for (const x of [-0.28, 0.28]) {
      box(this.head, m.eye, x, 0.055, 0.489, 0.13, 0.19, 0.025, true);
      cylinder(this.head, m.iron, x < 0 ? -0.72 : 0.72, -0.05, 0, 0.18, 0.18, 0.14, 12).rotation.z =
        Math.PI / 2;
    }
    box(this.head, m.blueEdge, -0.32, 0.28, 0.44, 0.23, 0.035, 0.017).rotation.z = -0.15;
    box(this.head, m.rust, 0.49, 0.29, 0.442, 0.08, 0.12, 0.018);
    cylinder(this.head, m.iron, 0.34, 0.55, -0.15, 0.025, 0.025, 0.36);
    sphere(this.head, m.gold, 0.34, 0.75, -0.15, 0.065);
    for (const [limb, x] of [
      [this.leftLeg, -0.28],
      [this.rightLeg, 0.28],
    ] as const) {
      limb.position.set(x, 0.62, 0);
      root.add(limb);
      sphere(limb, m.iron, 0, -0.1, 0, 0.17);
      box(limb, m.blue, 0, -0.25, 0, 0.3, 0.3, 0.31, true);
      box(limb, m.blueEdge, 0, -0.44, 0.1, 0.37, 0.21, 0.5, true);
      box(limb, m.iron, 0, -0.535, 0.1, 0.38, 0.06, 0.51, true);
    }
    for (const [arm, x] of [
      [this.leftArm, -0.63],
      [this.swordArm, 0.63],
    ] as const) {
      arm.position.set(x, 0.4, 0);
      this.body.add(arm);
      sphere(arm, m.iron, 0, -0.05, 0, 0.16);
      box(arm, m.blue, 0, -0.22, 0, 0.29, 0.42, 0.35, true);
      sphere(arm, m.iron, 0, -0.48, 0.04, 0.16);
    }
    this.swordArm.add(this.sword);
    this.sword.position.set(0, -0.48, 0.1);
    this.sword.rotation.x = Math.PI / 2;
    cylinder(this.sword, m.iron, 0, 0.05, 0, 0.05, 0.05, 0.35);
    box(this.sword, m.gold, 0, 0.24, 0, 0.43, 0.1, 0.13, true);
    box(this.sword, m.blueEdge, 0, 0.73, 0, 0.17, 0.9, 0.06);
    box(this.sword, m.eye, -0.065, 0.74, 0.015, 0.025, 0.88, 0.038);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.25, 4), m.blueEdge);
    tip.position.y = 1.28;
    tip.rotation.y = Math.PI / 4;
    this.sword.add(tip);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0xb4e9f5,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.trail = new THREE.Mesh(new THREE.RingGeometry(0.7, 2.15, 32, 1, -0.9, 1.8), trailMat);
    this.trail.rotation.x = -Math.PI / 2;
    this.trail.position.y = 0.9;
    root.add(this.trail);
  }
  animate(
    time: number,
    moving: boolean,
    sprinting: boolean,
    attack: number,
    blocking: boolean,
    hit: number,
    dead: number,
  ) {
    const cycle = time * (sprinting ? 19 : 13),
      swing = moving ? Math.sin(cycle) * 0.65 : 0;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.body.position.y =
      0.88 + (moving ? Math.abs(Math.sin(cycle)) * 0.09 : Math.sin(time * 2) * 0.018);
    this.body.rotation.x = sprinting ? 0.13 : 0;
    this.head.rotation.y = moving ? 0 : Math.sin(time * 0.6) * 0.09;
    this.head.rotation.z = Math.sin(time * 1.3) * 0.025;
    this.leftArm.rotation.x = -swing * 0.6;
    this.swordArm.rotation.set(swing * 0.25, 0, -0.08);
    const mat = this.trail.material as THREE.MeshBasicMaterial;
    mat.opacity = 0;
    if (attack > 0) {
      const phase = 1 - attack / 0.48;
      this.swordArm.rotation.x = -0.65;
      this.swordArm.rotation.y = -1.4 + Math.sin(Math.min(1, phase / 0.7) * Math.PI) * 3.1;
      this.swordArm.rotation.z = -0.4 - Math.sin(phase * Math.PI) * 0.65;
      if (phase > 0.2 && phase < 0.72) {
        mat.opacity = Math.sin(((phase - 0.2) / 0.52) * Math.PI) * 0.48;
        this.trail.rotation.z = -phase * 3;
      }
    } else if (blocking) {
      this.swordArm.rotation.set(-1.2, -0.8, -0.5);
      this.leftArm.rotation.x = -0.6;
      this.body.rotation.x = -0.1;
    }
    if (hit > 0) {
      this.body.rotation.x = -Math.sin(hit * 20) * 0.18;
      this.head.rotation.x = 0.12;
    } else this.head.rotation.x = 0;
    this.group.rotation.z = dead > 0 ? Math.min(Math.PI / 2, dead * 1.8) : 0;
    this.group.position.y = dead > 0 ? -0.1 : 0;
  }
}
