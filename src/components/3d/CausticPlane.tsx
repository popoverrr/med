/**
 * Плоскость позади капли: каустика (в hero) → мягкий градиентный туман (финал).
 * Капля преломляет этот узор — эффект «свет сквозь воду» без тяжёлого Caustics из drei.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, ShaderMaterial, type Mesh } from 'three';
import { params } from '@/lib/three/params';
import { CAUSTICS_VERT, CAUSTICS_FRAG } from '@/lib/three/glsl';

export function CausticPlane() {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: CAUSTICS_VERT,
        fragmentShader: CAUSTICS_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uProgress: { value: 0 },
          uFog: { value: 0 },
          uColorA: { value: new Color('#4fc3d6') },
          uColorB: { value: new Color('#8fd6e2') },
          uColorMix: { value: 0 },
          uOpacity: { value: 0.5 },
          uFocus: { value: [0.68, 0.52] },
        },
      }),
    []
  );

  useFrame((_, delta) => {
    const u = material.uniforms;
    u.uTime!.value += delta * (0.5 + params.speed);
    u.uFog!.value = params.fog;
    u.uColorMix!.value = params.colorMix;
    u.uOpacity!.value = 0.2 * (0.7 + params.clarity * 0.3) * Math.min(1, params.opacity + 0.2);
    const f = u.uFocus!.value as number[];
    // Фокус каустики следует за каплей (плоскость шириной 14 на z = -3)
    f[0] = 0.5 + params.blobX / 14;
    f[1] = 0.5 + params.blobY / 9;
    if (mesh.current) mesh.current.position.z = -3;
  });

  return (
    <mesh ref={mesh} position={[0, 0, -3]} material={material} frustumCulled={false}>
      <planeGeometry args={[14, 9, 1, 1]} />
    </mesh>
  );
}
