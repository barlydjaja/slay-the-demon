import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { WebGPURenderer } from 'three/webgpu';
import type { Quality } from '../game/config';

const WATER_HEIGHT = 0.041;
const EDGE_FADE_WIDTH = 0.24;

/** Disjoint puddle polygons share one mirror plane and one reflection pass.
 * An interior ring supplies a shoreline fade without covering any dry stone. */
export function buildPuddleReflectionGeometry(puddles: readonly THREE.Mesh[]) {
  const positions: number[] = [];
  const fades: number[] = [];
  const indices: number[] = [];
  const point = new THREE.Vector3();
  const center = new THREE.Vector3();

  for (const puddle of puddles) {
    const geometry = puddle.geometry as THREE.ShapeGeometry;
    const shape = geometry.parameters.shapes as THREE.Shape;
    const outline = shape.extractPoints(1).shape;
    if (outline.length > 1 && outline[0].distanceToSquared(outline.at(-1)!) < 1e-10) outline.pop();
    puddle.updateWorldMatrix(true, false);
    center.set(0, 0, 0).applyMatrix4(puddle.matrixWorld);
    const base = positions.length / 3;
    positions.push(center.x, -center.z, 0);
    fades.push(1);
    for (const vertex of outline) {
      point.set(vertex.x, vertex.y, 0).applyMatrix4(puddle.matrixWorld);
      const dx = point.x - center.x;
      const dz = point.z - center.z;
      const inset = Math.max(0.35, 1 - EDGE_FADE_WIDTH / Math.max(0.001, Math.hypot(dx, dz)));
      positions.push(center.x + dx * inset, -(center.z + dz * inset), 0);
      positions.push(point.x, -point.z, 0);
      fades.push(1, 0);
    }
    for (let i = 0; i < outline.length; i++) {
      const inner = base + 1 + i * 2;
      const next = base + 1 + ((i + 1) % outline.length) * 2;
      indices.push(base, inner, next, inner, inner + 1, next + 1, inner, next + 1, next);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('waterFade', new THREE.Float32BufferAttribute(fades, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const mirrorShader = {
  name: 'SoftPuddleReflection',
  uniforms: {
    tDiffuse: { value: null },
    color: { value: new THREE.Color(0xffffff) },
    textureMatrix: { value: new THREE.Matrix4() },
    waterTime: { value: 0 },
    texel: { value: new THREE.Vector2(1 / 768, 1 / 512) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    attribute float waterFade;
    varying vec4 mirrorUv;
    varying vec3 worldPosition;
    varying float edgeFade;
    void main() {
      mirrorUv = textureMatrix * vec4(position, 1.0);
      worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      edgeFade = waterFade;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float waterTime;
    uniform vec2 texel;
    varying vec4 mirrorUv;
    varying vec3 worldPosition;
    varying float edgeFade;
    void main() {
      vec2 wave = vec2(
        sin(worldPosition.z * 3.1 + waterTime * 1.4),
        cos(worldPosition.x * 2.7 - waterTime * 1.1)
      ) * texel * 0.22;
      vec2 sampleUv = mirrorUv.xy / mirrorUv.w + wave;
      vec2 blur = texel * 1.4;
      vec3 reflected = texture2D(tDiffuse, sampleUv).rgb * 0.4;
      reflected += texture2D(tDiffuse, sampleUv + vec2(blur.x, 0.0)).rgb * 0.15;
      reflected += texture2D(tDiffuse, sampleUv - vec2(blur.x, 0.0)).rgb * 0.15;
      reflected += texture2D(tDiffuse, sampleUv + vec2(0.0, blur.y)).rgb * 0.15;
      reflected += texture2D(tDiffuse, sampleUv - vec2(0.0, blur.y)).rgb * 0.15;
      float grazing = pow(1.0 - abs(normalize(cameraPosition - worldPosition).y), 5.0);
      float strength = (0.20 + grazing * 0.48) * smoothstep(0.0, 1.0, edgeFade);
      gl_FragColor = vec4(reflected * vec3(0.72, 0.87, 0.95), strength);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export class WaterReflection {
  readonly surface: THREE.Mesh;
  private quality: Quality = 'high';
  private time = { value: 0 };
  private texel = { value: new THREE.Vector2() };
  private size = new THREE.Vector2();
  private configureTarget: (width: number, height: number, scale: number) => void;

  private constructor(
    surface: THREE.Mesh,
    configure: (width: number, height: number, scale: number) => void,
  ) {
    this.surface = surface;
    this.configureTarget = configure;
    surface.name = 'Shared puddle reflection';
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = WATER_HEIGHT;
    // Draw after the original PBR water, with normal depth testing so the
    // robot and architecture always occlude the reflected image.
    surface.renderOrder = 1;
    surface.material = surface.material as THREE.Material;
    surface.material.transparent = true;
    surface.material.depthWrite = false;
    surface.material.depthTest = true;
  }

  static async create(renderer: THREE.WebGLRenderer | WebGPURenderer, water: THREE.Mesh[]) {
    const geometry = buildPuddleReflectionGeometry(water);
    if (renderer instanceof THREE.WebGLRenderer) {
      const surface = new Reflector(geometry, {
        textureWidth: 768,
        textureHeight: 512,
        multisample: 0,
        clipBias: 0.001,
        shader: mirrorShader,
      });
      const effect = new WaterReflection(surface, (w, h) =>
        surface.getRenderTarget().setSize(w, h),
      );
      const material = surface.material as THREE.ShaderMaterial;
      effect.time = material.uniforms.waterTime;
      effect.texel = material.uniforms.texel;
      return effect;
    }

    // The node reflector handles WebGPU and the WebGPURenderer's WebGL
    // backend, including their different render-target UV conventions.
    const { MeshBasicNodeMaterial } = await import('three/webgpu');
    const { reflector, uniform, screenUV, positionWorld, cameraPosition, attribute, vec2, vec3 } =
      await import('three/tsl');
    const material = new MeshBasicNodeMaterial({ fog: false });
    const surface = new THREE.Mesh(geometry, material);
    const mirror = reflector({ resolutionScale: 0.35, bounces: false, samples: 0 });
    surface.add(mirror.target);
    const effect = new WaterReflection(surface, (_w, _h, scale) => {
      mirror.reflector.resolutionScale = scale;
    });
    const time = uniform(0);
    const texel = uniform(new THREE.Vector2());
    effect.time = time;
    effect.texel = texel;
    const wave = vec2(
      positionWorld.z.mul(3.1).add(time.mul(1.4)).sin(),
      positionWorld.x.mul(2.7).sub(time.mul(1.1)).cos(),
    )
      .mul(texel)
      .mul(0.22);
    const sampleUv = screenUV.flipX().add(wave);
    const blur = texel.mul(1.4);
    const reflected = mirror
      .sample(sampleUv)
      .rgb.mul(0.4)
      .add(mirror.sample(sampleUv.add(vec2(blur.x, 0))).rgb.mul(0.15))
      .add(mirror.sample(sampleUv.sub(vec2(blur.x, 0))).rgb.mul(0.15))
      .add(mirror.sample(sampleUv.add(vec2(0, blur.y))).rgb.mul(0.15))
      .add(mirror.sample(sampleUv.sub(vec2(0, blur.y))).rgb.mul(0.15));
    const grazing = cameraPosition.sub(positionWorld).normalize().y.abs().oneMinus().pow(5);
    material.colorNode = reflected.mul(vec3(0.72, 0.87, 0.95));
    material.opacityNode = attribute('waterFade', 'float')
      .smoothstep(0, 1)
      .mul(grazing.mul(0.48).add(0.2));
    return effect;
  }

  setQuality(quality: Quality) {
    this.quality = quality;
    this.surface.visible = quality !== 'low';
  }

  update(time: number, renderer: THREE.WebGLRenderer | WebGPURenderer) {
    this.time.value = time;
    if (!this.surface.visible) return;
    renderer.getDrawingBufferSize(this.size);
    const limit = this.quality === 'high' ? 768 : 384;
    const scale = Math.min(0.5, limit / Math.max(this.size.x, this.size.y));
    const width = Math.max(1, Math.round(this.size.x * scale));
    const height = Math.max(1, Math.round(this.size.y * scale));
    this.texel.value.set(1 / width, 1 / height);
    this.configureTarget(width, height, scale);
  }
}
