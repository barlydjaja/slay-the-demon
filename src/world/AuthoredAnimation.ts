import * as THREE from 'three';

/** Deterministically sample Blender clips against gameplay time, including paused inspections. */
export class AuthoredAnimation {
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current?: THREE.AnimationAction;
  constructor(root: THREE.Object3D) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of root.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
  }
  sample(name: string, seconds: number, loop = false) {
    const action = this.actions.get(name);
    if (!action) throw new Error(`Missing Blender animation: ${name}`);
    if (action !== this.current) {
      this.current?.stop();
      action.reset().setLoop(THREE.LoopOnce, 1).play();
      action.paused = true;
      this.current = action;
    }
    const duration = action.getClip().duration;
    action.time = loop
      ? Math.max(0, seconds) % duration
      : THREE.MathUtils.clamp(seconds, 0, duration);
    this.mixer.update(0);
  }
  reset() {
    this.mixer.stopAllAction();
    this.current = undefined;
  }
}
