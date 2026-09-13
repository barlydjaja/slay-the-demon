import * as THREE from 'three';
import { CastleAssets } from './CastleAssets';
import { AuthoredAnimation } from './AuthoredAnimation';

/** Blender gate, chains, counterweights and vault; cool light casts the moving ironwork onto the floor. */
export class CastleExit {
  readonly group: THREE.Group;
  private animation: AuthoredAnimation;
  private elapsed = 0;
  private rays: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private light = new THREE.SpotLight(0xb7d5ea, 0, 34, 0.54, 0.75, 1.4);
  private lift: THREE.Object3D;
  constructor(assets: CastleAssets) {
    this.group = assets.clone('exit_threshold');
    this.group.position.z = -150;
    this.animation = new AuthoredAnimation(this.group);
    this.lift = this.group.getObjectByName('threshold_lift')!;
    this.group.traverse((part) => {
      if (!(part instanceof THREE.Mesh) || !part.name.startsWith('threshold_ray_')) return;
      part.castShadow = part.receiveShadow = false;
      part.material = new THREE.MeshBasicMaterial({
        color: 0xbad5e2,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      part.renderOrder = 2;
      this.rays.push(part as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>);
    });
    this.light.position.set(-1.4, 6.5, -7);
    this.light.target.position.set(1.8, 0, 9);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.bias = -0.0003;
    this.light.shadow.normalBias = 0.025;
    this.light.shadow.camera.near = 0.5;
    this.group.add(this.light, this.light.target);
    this.reset();
  }
  get ready() {
    return this.lift.position.y > 4;
  }
  update(dt: number, time: number, opened: boolean) {
    if (!opened) return;
    this.elapsed = Math.min(4.4, this.elapsed + dt);
    this.animation.sample('threshold_open', this.elapsed);
    const reveal = THREE.MathUtils.smoothstep(this.elapsed, 0.35, 3.8);
    this.light.intensity = 320 * reveal;
    this.rays.forEach((ray, i) => {
      ray.material.opacity = reveal * (0.7 + Math.sin(time * 0.65 + i * 1.1) * 0.13);
    });
  }
  reset() {
    this.elapsed = 0;
    this.animation.sample('threshold_open', 0);
    this.light.intensity = 0;
    this.rays.forEach((ray) => {
      ray.material.opacity = 0;
    });
  }
}
