import * as THREE from 'three';
export class RobotModel {
  group = new THREE.Group();
  private pose: THREE.Object3D;
  body: THREE.Object3D;
  head: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  swordArm: THREE.Object3D;
  sword: THREE.Object3D;
  trail: THREE.Mesh;
  constructor(template: THREE.Group) {
    this.pose = this.part(template, 'robot_pose');
    this.group.add(template);
    this.body = this.part(template, 'robot_body');
    this.head = this.part(template, 'robot_head');
    this.leftLeg = this.part(template, 'robot_leg_left');
    this.rightLeg = this.part(template, 'robot_leg_right');
    this.leftArm = this.part(template, 'robot_arm_left');
    this.swordArm = this.part(template, 'robot_arm_right');
    this.sword = this.part(template, 'robot_sword');
    const root = this.pose;
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
  private part(root: THREE.Group, name: string) {
    const part = root.getObjectByName(name);
    if (!part) throw new Error(`Missing Blender robot pivot: ${name}`);
    return part;
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
    this.pose.rotation.z = dead > 0 ? Math.min(Math.PI / 2, dead * 1.8) : 0;
    this.pose.position.y = dead > 0 ? -0.1 : 0;
  }
}
