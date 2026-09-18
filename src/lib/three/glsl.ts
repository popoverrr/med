/** Сборка GLSL из файлов src/shaders/*.glsl (импорт как строки через ?raw). */
import noise from '@/shaders/noise.glsl?raw';
import blobVert from '@/shaders/blob.vert.glsl?raw';
import particlesVert from '@/shaders/particles.vert.glsl?raw';
import particlesFrag from '@/shaders/particles.frag.glsl?raw';
import causticsVert from '@/shaders/caustics.vert.glsl?raw';
import causticsFrag from '@/shaders/caustics.frag.glsl?raw';
import bandsVert from '@/shaders/bands.vert.glsl?raw';
import bandsFrag from '@/shaders/bands.frag.glsl?raw';

export const NOISE = noise;

const [blobNormal, blobPosition] = blobVert.split('// @@SPLIT@@');
export const BLOB_NORMAL_CHUNK = blobNormal ?? '';
export const BLOB_POSITION_CHUNK = blobPosition ?? '';

export const PARTICLES_VERT = `${noise}\n${particlesVert}`;
export const PARTICLES_FRAG = particlesFrag;
export const CAUSTICS_VERT = causticsVert;
export const CAUSTICS_FRAG = `${noise}\n${causticsFrag}`;
export const BANDS_VERT = bandsVert;
export const BANDS_FRAG = bandsFrag;
