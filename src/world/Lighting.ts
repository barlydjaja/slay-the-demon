import * as THREE from 'three';
import { Torch } from './Castle';
import { makeEnvironment } from './materials';
import { damp } from '../game/math';
export class Lighting {
  sun = new THREE.DirectionalLight(0xc0dbe6, 3.2);
  ambient = new THREE.HemisphereLight(0xa8c5d6, 0x18202a, 1.6);
  private lights: THREE.PointLight[] = [];
  private rim = new THREE.PointLight(0x9c9ed0, 12, 17, 2);
  private nextLightning = 14;
  private flash = 0;
  lightning = false;
  bossPhase = 1;
  bossPosition = new THREE.Vector3(0, 0, -130);
  private bossKey = new THREE.SpotLight(0xb8cbdc, 0, 26, 0.8, 0.85, 1.5);
  private nearest: { i: number; d: number }[] = [];
  private selectionTimer = 0;
  constructor(
    private scene: THREE.Scene,
    private torches: Torch[],
  ) {
    scene.background = new THREE.Color(0x101d27);
    scene.fog = new THREE.FogExp2(0x152732, 0.026);
    scene.environment = makeEnvironment();
    scene.environmentIntensity = 0.65;
    scene.add(this.ambient);
    this.sun.position.set(-12, 27, -20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -23,
      right: 23,
      top: 25,
      bottom: -25,
      near: 0.5,
      far: 80,
    });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.055;
    this.sun.shadow.radius = 3;
    scene.add(this.sun, this.sun.target);
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffb660, 35, 12, 2);
      this.lights.push(light);
      scene.add(light);
    }
    this.nearest = torches.map((_, i) => ({ i, d: 0 }));
    this.rim.position.set(0, 6, -139);
    scene.add(this.rim, this.bossKey, this.bossKey.target);
  }
  update(dt: number, time: number, x: number, z: number, boss: boolean, victory: boolean) {
    const unbound = boss && this.bossPhase === 2;
    this.nextLightning -= dt;
    this.lightning = false;
    if (this.nextLightning <= 0) {
      this.flash = 0.55;
      this.nextLightning = (boss ? 10 : 18) + Math.random() * 13;
      this.lightning = true;
    }
    this.flash = Math.max(0, this.flash - dt);
    const pulse =
      this.flash > 0.38
        ? Math.sin(this.flash * 65) ** 2 * 0.85
        : this.flash > 0.15
          ? 0
          : this.flash * 1.8;
    this.sun.intensity = damp(
      this.sun.intensity,
      (victory ? 2.9 : unbound ? 1.9 : boss ? 2.6 : 3.2) + pulse * 4,
      25,
      dt,
    );
    this.ambient.intensity = damp(
      this.ambient.intensity,
      victory ? 1.3 : unbound ? 1.05 : boss ? 1.15 : 1.6,
      1.4,
      dt,
    );
    (this.scene.fog as THREE.FogExp2).density = damp(
      (this.scene.fog as THREE.FogExp2).density,
      victory ? 0.019 : unbound ? 0.03 : boss ? 0.03 : 0.026,
      1,
      dt,
    );
    this.sun.position.set(x - 12, 27, z - 20);
    this.sun.target.position.set(x, 0, z - 5);
    // Four lights follow the most relevant sconces; the rest use emissive glow.
    this.selectionTimer -= dt;
    if (this.selectionTimer <= 0) {
      this.selectionTimer = 0.3;
      for (const entry of this.nearest) {
        const p = this.torches[entry.i].position;
        entry.d = (p.x - x) ** 2 + (p.z - z) ** 2;
      }
      this.nearest.sort((a, b) => a.d - b.d);
    }
    this.lights.forEach((light, i) => {
      const t = this.torches[this.nearest[i].i];
      light.position.copy(t.position);
      light.intensity = 30 + Math.sin(time * 9 + t.phase) * 4;
    });
    this.bossKey.position.set(this.bossPosition.x - 4, 9, this.bossPosition.z + 7);
    this.bossKey.target.position.copy(this.bossPosition).y = 3.5;
    this.bossKey.intensity = damp(this.bossKey.intensity, boss ? (unbound ? 210 : 155) : 0, 2, dt);
    this.rim.position.set(this.bossPosition.x + 1, 6, this.bossPosition.z - 5);
    this.rim.color.lerp(new THREE.Color(unbound ? 0xd74a83 : 0x9c9ed0), Math.min(1, dt * 1.5));
    this.rim.intensity = unbound ? 40 + Math.sin(time * 1.8) * 5 : boss ? 22 : 11;
    (this.scene.fog as THREE.FogExp2).color.lerp(
      new THREE.Color(unbound ? 0x231e30 : 0x152732),
      Math.min(1, dt),
    );
  }
}
