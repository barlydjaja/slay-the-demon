import { clamp } from './math';
import { WORLD } from './config';
export interface Obstacle {
  x: number;
  z: number;
  width: number;
  depth: number;
  active?: boolean;
}
export interface Position {
  x: number;
  z: number;
}
/** Axis-separated circle/AABB resolution allows sliding along masonry. */
export class CollisionSystem {
  heightAt: (x: number, z: number) => number = () => 0;
  constructor(public bounds: { halfWidth: number; minZ: number; maxZ: number } = WORLD) {}
  obstacles: Obstacle[] = [];
  add(x: number, z: number, width: number, depth: number) {
    const obstacle = { x, z, width, depth, active: true };
    this.obstacles.push(obstacle);
    return obstacle;
  }
  blocked(x: number, z: number, radius: number) {
    if (
      x < -this.bounds.halfWidth + radius ||
      x > this.bounds.halfWidth - radius ||
      z < this.bounds.minZ + radius ||
      z > this.bounds.maxZ - radius
    )
      return true;
    for (const o of this.obstacles) {
      if (
        o.active === false ||
        Math.abs(z - o.z) > o.depth * 0.5 + radius ||
        Math.abs(x - o.x) > o.width * 0.5 + radius
      )
        continue;
      const nearX = clamp(x, o.x - o.width * 0.5, o.x + o.width * 0.5),
        nearZ = clamp(z, o.z - o.depth * 0.5, o.z + o.depth * 0.5);
      if ((x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2) return true;
    }
    return false;
  }
  move(position: Position, dx: number, dz: number, radius: number) {
    // Substeps prevent sprint/lunge tunnelling through thin barriers.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.22));
    for (let i = 0; i < steps; i++) {
      if (!this.blocked(position.x + dx / steps, position.z, radius)) position.x += dx / steps;
      if (!this.blocked(position.x, position.z + dz / steps, radius)) position.z += dz / steps;
    }
    if ('y' in position)
      (position as Position & { y: number }).y = this.heightAt(position.x, position.z);
  }
}
