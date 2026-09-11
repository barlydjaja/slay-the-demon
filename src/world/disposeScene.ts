import * as THREE from 'three';
/** Release the outgoing map before allocating the next one, including shared resources once. */
export function disposeScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material)
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        materials.add(material);
    const light = object as THREE.Light & { shadow?: THREE.LightShadow };
    light.shadow?.dispose();
    if ((object as THREE.InstancedMesh).isInstancedMesh) (object as THREE.InstancedMesh).dispose();
  });
  for (const material of materials) {
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture) textures.add(value);
    if (material instanceof THREE.ShaderMaterial)
      for (const uniform of Object.values(material.uniforms))
        if (uniform.value instanceof THREE.Texture) textures.add(uniform.value);
    material.dispose();
  }
  if (scene.environment) textures.add(scene.environment);
  if (scene.background instanceof THREE.Texture) textures.add(scene.background);
  for (const texture of textures) texture.dispose();
  for (const geometry of geometries) geometry.dispose();
  scene.clear();
  scene.environment = null;
  scene.background = null;
}
