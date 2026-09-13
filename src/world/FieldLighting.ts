import * as THREE from 'three';
/** Overcast blue-grey woodland, with restrained pools of human warmth inside the walls. */
export class FieldLighting {
  sun = new THREE.DirectionalLight(0xa7bfd0, 1.65);
  lightning = false;
  private mist: THREE.Mesh[] = [];
  constructor(scene: THREE.Scene) {
    scene.background = new THREE.Color(0x202f38);
    scene.fog = new THREE.FogExp2(0x263b44, 0.026);
    scene.add(new THREE.HemisphereLight(0x91aab9, 0x30392f, 1.2));
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
    for (const [x, z, intensity, distance] of [
      [14, -12, 23, 12],
      [16, -23, 32, 17],
      [24, -32, 19, 13],
    ]) {
      const lamp = new THREE.PointLight(0xffbd74, intensity, distance, 2);
      lamp.position.set(x, 3.5, z);
      scene.add(lamp);
    }
    // Soft ground mist is an atmospheric effect, not a physical asset.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(165,190,194,0.2)');
    gradient.addColorStop(1, 'rgba(165,190,194,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const material = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const geometry = new THREE.PlaneGeometry(22, 11);
    for (const [x, z] of [
      [-15, 3],
      [17, 6],
      [-24, -20],
      [7, -43],
      [24, -51],
    ]) {
      const plane = new THREE.Mesh(geometry, material);
      plane.position.set(x, 1.7, z);
      plane.rotation.x = -Math.PI / 2;
      scene.add(plane);
      this.mist.push(plane);
    }
    this.update(0, 0, 0, 35, false, false);
  }
  update(_dt: number, time: number, x: number, z: number, _boss: boolean, _victory: boolean) {
    this.sun.position.set(x - 24, 38, z - 18);
    this.sun.target.position.set(x, 0, z - 5);
    this.mist.forEach((plane, i) => {
      plane.rotation.z = Math.sin(time * 0.035 + i) * 0.12;
    });
  }
}
