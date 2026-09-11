import * as THREE from 'three';
export class FieldLighting {
  sun = new THREE.DirectionalLight(0xffe3ab, 3.1);
  lightning = false;
  constructor(scene: THREE.Scene) {
    scene.background = new THREE.Color(0xb3d2cb);
    scene.fog = new THREE.Fog(0xb3d2cb, 48, 118);
    scene.add(new THREE.HemisphereLight(0xc6e5ef, 0x768b4c, 2.15));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -25,
      right: 25,
      top: 30,
      bottom: -30,
      near: 1,
      far: 100,
    });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);
    this.update(0, 0, 0, 35, false, false);
  }
  update(_dt: number, _time: number, x: number, z: number, _boss: boolean, _victory: boolean) {
    this.sun.position.set(x - 24, 38, z - 18);
    this.sun.target.position.set(x, 0, z - 5);
  }
}
