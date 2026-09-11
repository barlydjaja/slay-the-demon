import * as THREE from 'three';
import { damp } from './math';
export class CameraController {
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 150);
  private target = new THREE.Vector3();
  private offset = new THREE.Vector3(14.5, 20.5, 23);
  private desired = new THREE.Vector3();
  private look = new THREE.Vector3();
  private zoom = 1;
  shake = 0;
  constructor() {
    this.target.set(-5.5, 0, 4);
    this.camera.position.copy(this.target).add(this.offset);
    this.camera.lookAt(this.target);
  }
  update(dt: number, time: number, player: THREE.Vector3, menu: boolean, boss: boolean) {
    this.desired.copy(player);
    this.desired.y = player.y + 0.55;
    if (menu) {
      this.desired.x -= 6.7;
      this.desired.z -= 4;
      this.desired.y = player.y + 0.8;
    } else this.desired.z -= 2.2;
    this.target.lerp(this.desired, 1 - Math.exp(-dt * (menu ? 2.3 : 5)));
    this.zoom = damp(this.zoom, boss ? 1.23 : menu ? 1.05 : 1, 2, dt);
    this.camera.position.copy(this.offset).multiplyScalar(this.zoom).add(this.target);
    if (menu) {
      this.camera.position.x += Math.sin(time * 0.12) * 0.6;
      this.camera.position.y += Math.sin(time * 0.1) * 0.2;
    }
    this.shake = Math.max(0, this.shake - dt * 2);
    if (this.shake > 0) {
      this.camera.position.x += Math.sin(time * 91) * this.shake * 0.2;
      this.camera.position.y += Math.cos(time * 72) * this.shake * 0.13;
    }
    this.look.copy(this.target);
    this.camera.lookAt(this.look);
  }
  snap(player: THREE.Vector3) {
    this.target.copy(player);
    this.target.z -= 2.2;
  }
  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
