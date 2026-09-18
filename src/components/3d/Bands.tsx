/**
 * Фон сцены: цветовые «полосы» секций (data-bg), движущиеся вместе со страницей, с мягкими кромками.
 * Секции при активной сцене прозрачны — этот слой обеспечивает им фон и контраст текста, а капля
 * рендерится поверх него. Границы секций берутся из стора (пересчёт на ScrollTrigger.refresh).
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, ShaderMaterial } from 'three';
import { sceneStore } from '@/lib/scene/store';
import { BANDS_VERT, BANDS_FRAG } from '@/lib/three/glsl';

const MAX = 16;

export function Bands() {
  const material = useMemo(() => {
    const colors: Color[] = [];
    for (let i = 0; i < MAX; i++) colors.push(new Color('#350a16'));
    return new ShaderMaterial({
      vertexShader: BANDS_VERT,
      fragmentShader: BANDS_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTops: { value: new Float32Array(MAX) },
        uColors: { value: colors },
        uCount: { value: 0 },
        uHeight: { value: 900 },
        uFeather: { value: 96 },
        uBase: { value: new Color('#350a16') },
      },
    });
  }, []);

  useFrame((state) => {
    const { bands } = sceneStore.getState();
    const u = material.uniforms;
    const tops = u.uTops!.value as Float32Array;
    const colors = u.uColors!.value as Color[];
    const scroll = window.scrollY;
    const n = Math.min(MAX, bands.length);
    for (let i = 0; i < n; i++) {
      tops[i] = bands[i]!.top - scroll;
      colors[i]!.set(bands[i]!.color);
    }
    u.uCount!.value = n;
    u.uHeight!.value = state.size.height;
    (u.uBase!.value as Color).set(sceneStore.getState().bg);
  });

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2, 1, 1]} />
    </mesh>
  );
}
