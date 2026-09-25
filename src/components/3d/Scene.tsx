/**
 * Сквозная WebGL-сцена главной (ТЗ §4.1, §6): одна сцена, один Canvas, состояние — из sceneStore.
 * Ничего не размонтируется между секциями; переходы — интерполяция параметров в Director.
 *
 * Адаптивное качество (работает на любых устройствах): уровни basic / low / medium / high.
 * QualityMonitor меряет fps и переключает уровень; если даже basic не держит — onFallback (CSS-постер).
 */
import { Component, useCallback, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, N8AO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Color, type DirectionalLight, type SpotLight } from 'three';
import { Director } from './Director';
import { WaterBlob } from './WaterBlob';
import { Particles } from './Particles';
import { CausticPlane } from './CausticPlane';
import { Bands } from './Bands';
import { QualityMonitor } from './QualityMonitor';
import { params, CAMERA_FOV } from '@/lib/three/params';
import { sceneStore } from '@/lib/scene/store';
import { TIER, dprCap, type Quality } from '@/lib/scene/tiers';

/** Пост-обработка — отдельная граница ошибок: при сбое сцена работает без эффектов. */
class EffectsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? null : this.props.children; }
}

function Effects({ quality }: { quality: Quality }) {
  const strongDevice = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 0) >= 8;
  const ao = quality === 'high' && strongDevice;
  return (
    <EffectsBoundary>
      <EffectComposer multisampling={0} enableNormalPass={ao}>
        {ao ? <N8AO aoRadius={0.6} intensity={0.8} distanceFalloff={0.6} quality="low" halfRes /> : <></>}
        <Bloom luminanceThreshold={0.7} luminanceSmoothing={0.35} intensity={quality === 'high' ? 0.75 : 0.5} mipmapBlur radius={0.75} />
        {quality === 'high' ? <ChromaticAberration offset={[0.0006, 0.0004]} radialModulation modulationOffset={0.4} blendFunction={BlendFunction.NORMAL} /> : <></>}
        <Vignette eskil={false} offset={0.3} darkness={0.3} />
      </EffectComposer>
    </EffectsBoundary>
  );
}

// Свет только холодный: белый ключ с аква-подтоном + яркий контровой — «блик на воде»
const KEY_DEEP = new Color('#bdeef6');
const KEY_CLEAR = new Color('#f2fdff');
const RIM_DEEP = new Color('#8fd6e2');
const RIM_CLEAR = new Color('#ffffff');

/** Свет: мягкий аква-ключ сверху-справа, холодный aqua-контровой, заливка. Цвета следуют colorMix. */
function Lights() {
  const key = useRef<SpotLight>(null);
  const rim = useRef<DirectionalLight>(null);
  useFrame(() => {
    key.current?.color.copy(KEY_DEEP).lerp(KEY_CLEAR, params.colorMix);
    rim.current?.color.copy(RIM_DEEP).lerp(RIM_CLEAR, params.colorMix * 0.6);
  });
  return (
    <>
      <spotLight ref={key} position={[4.5, 5, 4]} angle={0.6} penumbra={1} intensity={55} color="#bdeef6" />
      <directionalLight ref={rim} position={[-5, 2.5, -4]} intensity={2.6} color="#8fd6e2" />
      <ambientLight intensity={0.35} color="#eef5f6" />
    </>
  );
}

interface SceneProps {
  host: HTMLElement;
  initialQuality: Quality;
  /** false — уровень зафиксирован (QA: ?force3d / ?quality=) */
  monitor: boolean;
  onFallback: () => void;
}

export function Scene({ host, initialQuality, monitor, onFallback }: SceneProps) {
  const [quality, setQuality] = useState<Quality>(initialQuality);
  const tier = TIER[quality];
  const dpr = Math.min(tier.dpr, dprCap(), typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  const change = useCallback((next: Quality) => {
    sceneStore.getState().setQuality(next);
    setQuality(next);
  }, []);

  return (
    <Canvas
      dpr={dpr}
      frameloop="demand"
      camera={{ position: [0, 0, 6.2], fov: CAMERA_FOV, near: 0.1, far: 60 }}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      onCreated={({ gl }) => { gl.setClearColor(sceneStore.getState().bg, 1); }}
    >
      {monitor && <QualityMonitor quality={quality} onChange={change} onFallback={onFallback} />}
      <Director host={host} />
      <Lights />
      {/* Процедурное окружение вместо внешнего HDR: софтбоксы — белое «окно», аква-контровой, глубокий задник */}
      <Environment resolution={tier.effects ? 256 : 128} frames={1}>
        {/* Только прямоугольные софтбоксы сверху и сбоку: кольцо/полоса снизу отражались в капле «ядром»/«улыбкой» — капля читалась как клетка */}
        <Lightformer form="rect" intensity={6} color="#f4fdff" position={[3.5, 4.5, 3]} scale={[2.2, 1.2, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.6} color="#8fd6e2" position={[-5, 1, -2]} scale={[2, 7, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.5} color="#1b8499" position={[0, 0, -6]} scale={[12, 12, 1]} target={[0, 0, 0]} />
      </Environment>
      <Bands />
      {tier.caustics && <CausticPlane />}
      <WaterBlob quality={quality} />
      <Particles quality={quality} />
      {tier.effects && <Effects quality={quality} />}
    </Canvas>
  );
}
