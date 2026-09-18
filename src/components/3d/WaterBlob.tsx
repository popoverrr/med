/**
 * Капля воды: икосаэдр высокой детализации + MeshTransmissionMaterial (drei) с собственным
 * вершинным шейдером (simplex-шум) — внедряется через onBeforeCompile поверх шейдера drei.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import { Color, type Mesh, type MeshPhysicalMaterial, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { params } from '@/lib/three/params';
import { NOISE, BLOB_NORMAL_CHUNK, BLOB_POSITION_CHUNK } from '@/lib/three/glsl';

const COLOR_BURGUNDY = new Color('#fff4f6');
const COLOR_AQUA = new Color('#f2fbfc');
const ATT_BURGUNDY = new Color('#d98aa0');
const ATT_AQUA = new Color('#a9dbe4');

interface Props { quality: 'high' | 'medium' | 'low' }

export function WaterBlob({ quality }: Props) {
  const mesh = useRef<Mesh>(null);
  const mat = useRef<MeshPhysicalMaterial>(null);
  const detail = quality === 'high' ? 96 : quality === 'medium' ? 64 : 40;
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDistortion: { value: params.distortion },
      uProgress: { value: 0 },
      uClarity: { value: 0 },
    }),
    []
  );
  const tint = useMemo(() => new Color(), []);
  const att = useMemo(() => new Color(), []);

  // Внедряем свой вершинный код поверх шейдера drei (он сам патчит фрагмент через onBeforeCompile)
  useLayoutEffect(() => {
    const m = mat.current;
    if (!m) return;
    const original = m.onBeforeCompile as (s: WebGLProgramParametersWithUniforms, r: WebGLRenderer) => void;
    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => {
      original.call(m, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          `uniform float uTime;\nuniform float uDistortion;\nuniform float uProgress;\nuniform float uClarity;\n${NOISE}\nvoid main() {`
        )
        .replace('#include <beginnormal_vertex>', BLOB_NORMAL_CHUNK)
        .replace('#include <begin_vertex>', BLOB_POSITION_CHUNK);
    };
    m.customProgramCacheKey = () => 'hydromed-blob';
    m.needsUpdate = true;
  }, [uniforms]);

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    uniforms.uTime.value += delta * (0.6 + params.speed * 2);
    uniforms.uDistortion.value = params.distortion;
    uniforms.uClarity.value = params.clarity;
    uniforms.uProgress.value = params.stretch / 2.6;

    // Гашение сцены: капля сжимается и скрывается, фон-полосы остаются
    m.visible = params.opacity > 0.02;
    // Форма: сфера -> вытянутый поток/трубка (неравномерный масштаб), поворот
    const s = params.blobScale * (0.3 + 0.7 * Math.min(1, params.opacity));
    const st = params.stretch;
    m.scale.set(s / (1 + st * 0.28), s * (1 + st), s / (1 + st * 0.28));
    m.rotation.z = params.rotZ;
    m.rotation.y += delta * (0.08 + params.speed * 0.2);
    m.position.set(params.blobX, params.blobY + Math.sin(state.clock.elapsedTime * 0.6) * 0.06, 0);

    const pm = mat.current;
    if (pm) {
      tint.copy(COLOR_BURGUNDY).lerp(COLOR_AQUA, params.colorMix);
      att.copy(ATT_BURGUNDY).lerp(ATT_AQUA, params.colorMix);
      pm.color.copy(tint);
      pm.attenuationColor.copy(att);
      pm.roughness = 0.05 + (1 - params.clarity) * 0.07;
      // На светлом фоне (aqua-состояния) капля прозрачнее: меньше поглощения
      pm.attenuationDistance = 3.5 + params.colorMix * 5;
      pm.thickness = 0.9 - params.colorMix * 0.4;
    }
  });

  return (
    <mesh ref={mesh} position={[params.blobX, params.blobY, 0]} frustumCulled={false}>
      <icosahedronGeometry args={[1, detail]} />
      <MeshTransmissionMaterial
        ref={mat as never}
        samples={quality === 'high' ? 8 : 4}
        resolution={quality === 'high' ? 1024 : 512}
        transmission={1}
        thickness={0.9}
        roughness={0.08}
        ior={1.33}
        chromaticAberration={0.035}
        anisotropy={0.15}
        distortion={0.18}
        distortionScale={0.6}
        temporalDistortion={0.08}
        attenuationDistance={3.5}
        attenuationColor="#d98aa0"
        color="#fff4f6"
        backside={quality !== 'low'}
        backsideThickness={0.4}
        envMapIntensity={1.6}
        clearcoat={0.35}
        clearcoatRoughness={0.12}
      />
    </mesh>
  );
}
