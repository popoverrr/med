/**
 * Частицы воды: Points с собственным шейдером, три целевые формы (внутри капли / облако / колонна),
 * движение по curl-noise. Количество зависит от уровня качества.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, ShaderMaterial, type Points } from 'three';
import { params } from '@/lib/three/params';
import { PARTICLES_VERT, PARTICLES_FRAG } from '@/lib/three/glsl';
import { TIER, type Quality } from '@/lib/scene/tiers';

interface Props { quality: Quality }

function seeded(seed: number) {
  // Детерминированный генератор (mulberry32) — формы одинаковы между перезагрузками
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Particles({ quality }: Props) {
  const ref = useRef<Points>(null);
  const count = TIER[quality].particles;

  const { origin, cloud, column, seed } = useMemo(() => {
    const rnd = seeded(20250415);
    const origin = new Float32Array(count * 3);
    const cloud = new Float32Array(count * 3);
    const column = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Внутри капли — маленькая сфера
      const r0 = Math.cbrt(rnd()) * 0.35;
      const th0 = rnd() * Math.PI * 2;
      const ph0 = Math.acos(2 * rnd() - 1);
      origin[i * 3] = r0 * Math.sin(ph0) * Math.cos(th0);
      origin[i * 3 + 1] = r0 * Math.sin(ph0) * Math.sin(th0);
      origin[i * 3 + 2] = r0 * Math.cos(ph0);
      // Облако — сплюснутый эллипсоид вокруг капли
      const r1 = 0.9 + Math.pow(rnd(), 0.6) * 1.7;
      const th1 = rnd() * Math.PI * 2;
      const ph1 = Math.acos(2 * rnd() - 1);
      cloud[i * 3] = r1 * Math.sin(ph1) * Math.cos(th1) * 1.25;
      cloud[i * 3 + 1] = r1 * Math.sin(ph1) * Math.sin(th1) * 0.75;
      cloud[i * 3 + 2] = r1 * Math.cos(ph1) * 0.8;
      // Колонна — цилиндр (оболочка + внутренние «кольца» фильтра)
      const ring = rnd() < 0.3;
      const rc = ring ? 0.32 + rnd() * 0.08 : 0.55 + rnd() * 0.06;
      const th2 = rnd() * Math.PI * 2;
      const y2 = ring ? Math.round((rnd() - 0.5) * 6) * 0.42 : (rnd() - 0.5) * 3.2;
      column[i * 3] = rc * Math.cos(th2);
      column[i * 3 + 1] = y2;
      column[i * 3 + 2] = rc * Math.sin(th2);
      seed[i] = rnd();
    }
    return { origin, cloud, column, seed };
  }, [count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: PARTICLES_VERT,
        fragmentShader: PARTICLES_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSpread: { value: 0 },
          uColumn: { value: 0 },
          uNoise: { value: 0.3 },
          uPixelRatio: { value: 1 },
          uSize: { value: quality === 'low' ? 6 : 5 },
          uCenter: { value: [1.35, 0, 0] },
          uColorA: { value: new Color('#4fc3d6') },
          uColorB: { value: new Color('#8fd6e2') },
          uColorMix: { value: 0 },
          uOpacity: { value: 0.8 },
        },
      }),
    [quality]
  );

  useFrame((state, delta) => {
    const u = material.uniforms;
    u.uTime!.value += delta;
    u.uSpread!.value = params.spread;
    u.uColumn!.value = params.column;
    u.uNoise!.value = params.noise;
    u.uColorMix!.value = params.colorMix;
    u.uOpacity!.value = 0.85 * Math.min(1, params.opacity);
    u.uPixelRatio!.value = state.gl.getPixelRatio();
    const c = u.uCenter!.value as number[];
    c[0] = params.blobX;
    c[1] = params.blobY;
    if (ref.current) ref.current.visible = params.spread > 0.01;
  });

  return (
    <points ref={ref} material={material} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[origin, 3]} />
        <bufferAttribute attach="attributes-aOrigin" args={[origin, 3]} />
        <bufferAttribute attach="attributes-aCloud" args={[cloud, 3]} />
        <bufferAttribute attach="attributes-aColumn" args={[column, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seed, 1]} />
      </bufferGeometry>
    </points>
  );
}
