/**
 * Сквозная WebGL-сцена главной (ТЗ §4.1, §6): одна сцена, один Canvas, состояние — из sceneStore.
 * Ничего не размонтируется между секциями; переходы — интерполяция параметров в Director.
 */
import { Component, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Color, type DirectionalLight, type SpotLight } from 'three';
import { params } from '@/lib/three/params';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, N8AO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Director } from './Director';
import { WaterBlob } from './WaterBlob';
import { Particles } from './Particles';
import { CausticPlane } from './CausticPlane';
import { Bands } from './Bands';
import { sceneStore } from '@/lib/scene/store';

type Quality = 'high' | 'medium' | 'low';

/** Пост-обработка — отдельная граница ошибок: при сбое сцена работает без эффектов. */
class EffectsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? null : this.props.children; }
}

function Effects({ quality }: { quality: Quality }) {
  const strongDevice = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 0) >= 8;
  return (
    <EffectsBoundary>
      <EffectComposer multisampling={0} enableNormalPass={quality === 'high' && strongDevice}>
        {quality === 'high' && strongDevice ? <N8AO aoRadius={0.6} intensity={0.8} distanceFalloff={0.6} quality="low" halfRes /> : <></>}
        <Bloom luminanceThreshold={0.7} luminanceSmoothing={0.35} intensity={0.75} mipmapBlur radius={0.75} />
        <ChromaticAberration offset={[0.0006, 0.0004]} radialModulation modulationOffset={0.4} blendFunction={BlendFunction.NORMAL} />
        <Vignette eskil={false} offset={0.3} darkness={0.3} />
      </EffectComposer>
    </EffectsBoundary>
  );
}

const KEY_WARM = new Color('#d9788e');
const KEY_COOL = new Color('#a9dde8');
const RIM_WARM = new Color('#8fc2ce');
const RIM_COOL = new Color('#ffffff');

/** Свет: тёплый бургунди-ключ сверху-справа, холодный aqua-контровой, заливка. Цвета следуют colorMix. */
function Lights() {
  const key = useRef<SpotLight>(null);
  const rim = useRef<DirectionalLight>(null);
  useFrame(() => {
    key.current?.color.copy(KEY_WARM).lerp(KEY_COOL, params.colorMix);
    rim.current?.color.copy(RIM_WARM).lerp(RIM_COOL, params.colorMix * 0.6);
  });
  return (
    <>
      <spotLight ref={key} position={[4.5, 5, 4]} angle={0.6} penumbra={1} intensity={60} color="#d9788e" />
      <directionalLight ref={rim} position={[-5, 2.5, -4]} intensity={2.2} color="#8fc2ce" />
      <ambientLight intensity={0.35} color="#f6f1ee" />
    </>
  );
}

export function Scene({ host }: { host: HTMLElement }) {
  const [quality, setQuality] = useState<Quality>('high');
  const [dpr, setDpr] = useState(() => Math.min(1.75, window.devicePixelRatio || 1));

  return (
    <Canvas
      dpr={dpr}
      frameloop="demand"
      camera={{ position: [0, 0, 6.2], fov: 35, near: 0.1, far: 60 }}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      onCreated={({ gl }) => { gl.setClearColor(sceneStore.getState().bg, 1); }}
    >
      <PerformanceMonitor
        ms={250}
        iterations={6}
        bounds={() => [50, 60]}
        flipflops={3}
        onDecline={() => { setDpr((d) => Math.max(1, d - 0.35)); setQuality((q) => (q === 'high' ? 'medium' : q)); sceneStore.getState().setQuality('medium'); }}
        onIncline={() => { setDpr((d) => Math.min(1.75, d + 0.25)); }}
        onFallback={() => { setDpr(1); setQuality('low'); sceneStore.getState().setQuality('low'); }}
      />
      <Director host={host} />
      <Lights />
      {/* Процедурное окружение вместо внешнего HDR: три «софтбокса» — тёплый, холодный, заливка */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} color="#e9a7b6" position={[4, 4, 3]} scale={[4, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={2} color="#a9d6de" position={[-5, 1, -2]} scale={[3, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.2} color="#fffcfa" position={[0, -4, 2]} scale={[6, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} color="#6b1730" position={[0, 0, -6]} scale={[10, 10, 1]} target={[0, 0, 0]} />
      </Environment>
      <Bands />
      <CausticPlane />
      <WaterBlob quality={quality} />
      <Particles quality={quality} />
      {quality !== 'low' && <Effects quality={quality} />}
    </Canvas>
  );
}
