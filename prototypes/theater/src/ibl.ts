// سماء صحراوية محسوبة (شمس + أفق + ارتداد أرض) تُستخدم إضاءة للمجسمات.
// بدونها خامات PBR المعدنية تطلع سودا، وهذا اللي خلّى النسخة السابقة تطفّي المعدن.
import { Scene, RawCubeTexture, Constants, HDRFiltering, CubeMapToSphericalPolynomialTools } from '@babylonjs/core';
import '@babylonjs/core/Materials/Textures/baseTexture.polynomial';

const SIZE = 32;
type V3 = [number, number, number];

function nrm(x: number, y: number, z: number): V3 {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}
// ترتيب الأوجه مثل WebGL: +X −X +Y −Y +Z −Z. y=0 أسفل الوجه (invertY = false).
function faceDir(face: number, s: number, t: number): V3 {
  switch (face) {
    case 0: return nrm(1, -t, -s);
    case 1: return nrm(-1, -t, s);
    case 2: return nrm(s, 1, t);
    case 3: return nrm(s, -1, -t);
    case 4: return nrm(s, -t, 1);
    default: return nrm(-s, -t, -1);
  }
}
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export async function installDesertIBL(scene: Scene, sunDir: V3): Promise<boolean> {
  const engine = scene.getEngine();
  if (!engine.getCaps().textureFloat) return false;
  try {
    const sun = nrm(sunDir[0], sunDir[1], sunDir[2]);
    const faces: Float32Array[] = [];
    for (let face = 0; face < 6; face++) {
      const data = new Float32Array(SIZE * SIZE * 4);
      for (let y = 0; y < SIZE; y++) {
        const t = 2 * ((y + 0.5) / SIZE) - 1;
        for (let x = 0; x < SIZE; x++) {
          const s = 2 * ((x + 0.5) / SIZE) - 1;
          const d = faceDir(face, s, t);
          const up = d[1];
          let r: number, g: number, b: number;
          if (up >= 0) {
            const k = sm(0, 0.62, up);
            r = mix(0.98, 0.16, k); g = mix(0.74, 0.36, k); b = mix(0.46, 0.78, k);
            const band = Math.exp(-up * up * 22);
            r += band * 0.55; g += band * 0.28; b += band * 0.06;
          } else {
            const k = Math.min(1, -up);
            r = mix(0.4, 0.14, k); g = mix(0.3, 0.1, k); b = mix(0.2, 0.07, k);
          }
          const nd = d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2];
          const ang = Math.acos(Math.min(1, Math.max(-1, nd)));
          const disk = ang < 0.045 ? 26 : 0;
          const glow = Math.exp(-ang * ang * 90) * 3.4;
          r += disk + glow; g += (disk + glow) * 0.9; b += (disk + glow) * 0.62;
          const i = (y * SIZE + x) * 4;
          data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 1;
        }
      }
      faces.push(data);
    }
    const cube = new RawCubeTexture(scene, faces, SIZE, Constants.TEXTUREFORMAT_RGBA, Constants.TEXTURETYPE_FLOAT, false, false, Constants.TEXTURE_LINEAR_LINEAR);
    cube.gammaSpace = false;
    cube.coordinatesMode = Constants.TEXTURE_CUBIC_MODE;
    const poly = CubeMapToSphericalPolynomialTools.ConvertCubeMapToSphericalPolynomial({
      size: SIZE, right: faces[0], left: faces[1], up: faces[2], down: faces[3], front: faces[4], back: faces[5],
      format: Constants.TEXTUREFORMAT_RGBA, type: Constants.TEXTURETYPE_FLOAT, gammaSpace: false,
    });
    cube.sphericalPolynomial = poly;
    const filtering = new HDRFiltering(engine, { quality: Constants.TEXTURE_FILTERING_QUALITY_HIGH });
    await filtering.prefilter(cube);
    scene.environmentTexture = cube;
    scene.environmentIntensity = 0.9;
    return true;
  } catch (e) {
    console.warn('IBL', e);
    return false;
  }
}
