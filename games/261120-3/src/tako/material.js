// The takoyaki surface material: one MeshPhysicalMaterial program shared by all balls (per-ball instances only differ in uniforms).
// Per-vertex attributes: aTako = (cook, sauce, flat-liquid factor), aObj = object-space direction (texture anchor).
import * as THREE from 'three';
import { BALL_R } from '../config.js';
import { getDetailTexture, getGradTexture } from './textures.js';

const lin = (hex) => {
  const c = new THREE.Color(hex); // sRGB hex -> linear working space
  return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`;
};

// cook gradient (tuned on screenshots)
export const GRAD = {
  raw: '#efdba6', // wet pale cream batter
  set: '#efd18a', // opaque pale yellow
  light: '#dfaa5e', // light golden
  golden: '#c98e48', // golden brown
  deep: '#93552a', // rich brown
};

const HEAD_V = /* glsl */ `
attribute vec3 aTako;
attribute vec3 aObj;
varying vec3 vTako;
varying vec3 vObj;
varying vec3 vObjN;
uniform vec4 uWob;   // x ripple amp, y ripple phase, z quiver amount, w time
uniform vec3 uUp;    // world up expressed in object space
uniform float uTriY;
`;

const NORMAL_V = /* glsl */ `
#include <beginnormal_vertex>
vTako = aTako;
// texture anchor: displayed object-space position (no stretching on the liquid wall); skirt uses aObj
vObj = uTriY > 0.5 ? aObj : position * ${(1 / BALL_R).toFixed(4)};
vec3 takoOff = vec3(0.0);
{
  float f = aTako.z;
  if (f > 0.001) {
    vec3 hp = position - uUp * dot(position, uUp);
    float r = length(hp);
    float ph = r * 3.6 - uWob.y;
    float wv = uWob.x * sin(ph) * (0.35 + 0.65 * r / ${BALL_R.toFixed(2)});
    float edge = smoothstep(${(BALL_R * 0.55).toFixed(2)}, ${(BALL_R * 0.98).toFixed(2)}, r);
    float qv = uWob.z * 0.035 * edge * (sin(uWob.w * 21.0 + dot(aObj, vec3(17.1, 9.3, 13.7))) + 0.6 * sin(uWob.w * 33.0 + dot(aObj, vec3(5.3, 21.7, 8.9))));
    takoOff = uUp * f * (wv + qv);
    float dyr = uWob.x * 3.6 * cos(ph) * f;
    if (r > 1e-3) objectNormal = normalize(objectNormal - (hp / r) * dyr);
  }
}
vObjN = objectNormal;
`;

const BEGIN_V = /* glsl */ `
#include <begin_vertex>
transformed += takoOff;
`;

const HEAD_F = /* glsl */ `
varying vec3 vTako;
varying vec3 vObj;
varying vec3 vObjN;
uniform mat3 normalMatrix;
uniform sampler2D uDetail;
uniform sampler2D uGrad;
uniform vec3 uSeed;
uniform float uCut;        // 1 = bitten: back faces show the cross-section
uniform vec4 uCutPlane;    // view-space plane, normal toward the kept side
uniform float uTriY;       // 1 = flat (skirt) projection

vec3 takoGrad(float c) {
  vec3 a = mix(${lin(GRAD.raw)}, ${lin(GRAD.set)}, smoothstep(0.08, 0.34, c));
  a = mix(a, ${lin(GRAD.light)}, smoothstep(0.34, 0.58, c));
  a = mix(a, ${lin(GRAD.golden)}, smoothstep(0.58, 0.82, c));
  a = mix(a, ${lin(GRAD.deep)}, smoothstep(0.82, 1.02, c));
  return a;
}
vec3 takoGradObj(vec3 p, vec3 w, float flatY, out float hgt, out float mot) {
  vec4 b = texture2D(uGrad, p.xz);
  if (flatY > 0.5) { hgt = b.b; mot = b.a; return vec3(b.r - 0.5, 0.0, b.g - 0.5); }
  vec4 a = texture2D(uGrad, p.yz);
  vec4 c = texture2D(uGrad, p.xy);
  hgt = a.b * w.x + b.b * w.y + c.b * w.z;
  mot = a.a * w.x + b.a * w.y + c.a * w.z;
  return w.x * vec3(0.0, a.r - 0.5, a.g - 0.5) + w.y * vec3(b.r - 0.5, 0.0, b.g - 0.5) + w.z * vec3(c.r - 0.5, c.g - 0.5, 0.0);
}
`;

const COLOR_F = /* glsl */ `
vec3 tp = vObj * 1.3 + uSeed;
vec3 bw = abs(normalize(vObjN));
bw = bw * bw; bw = bw * bw;
bw /= (bw.x + bw.y + bw.z);
vec4 tx = uTriY > 0.5 ? texture2D(uDetail, tp.xz)
  : texture2D(uDetail, tp.yz) * bw.x + texture2D(uDetail, tp.xz) * bw.y + texture2D(uDetail, tp.xy) * bw.z;
vec3 tq = tp * 0.37 + 0.31;
float h2, m2, h1, m1;
vec3 gCoarse = takoGradObj(tq, bw, uTriY, h2, m2);
vec3 gFine = takoGradObj(tp, bw, uTriY, h1, m1);
vec4 tx2 = vec4(h2, m2, 0.0, 0.0);
float cookRaw = vTako.x;
float cooked = smoothstep(0.22, 0.6, cookRaw);
float tc = cookRaw + (tx2.g - 0.5) * 0.14 * cooked + (tx.g - 0.5) * 0.06 * cooked - (tx.r - 0.5) * 0.06 * smoothstep(0.5, 0.9, cookRaw);
vec3 tcol = takoGrad(tc);
// pores darker on the crust, slightly brighter crinkle highlights
tcol *= mix(1.0, 0.86 + 0.26 * tx.r, cooked);
// dark freckles on deeply browned areas
tcol *= 1.0 - 0.42 * smoothstep(0.66, 0.92, tx2.g) * smoothstep(0.7, 1.0, cookRaw);
// raw batter: subtle bubbly variation
tcol *= mix(0.96 + 0.06 * tx.r, 1.0, cooked);
// green onion / red ginger bits mixed into the batter
float fleckVis = mix(0.9, 0.55, cooked);
vec3 negiC = mix(${lin('#6f9c3c')}, ${lin('#4d6a22')}, cooked);
vec3 beniC = mix(${lin('#d8455a')}, ${lin('#a8392f')}, cooked);
tcol = mix(tcol, negiC, tx.b * fleckVis);
tcol = mix(tcol, beniC, tx.a * fleckVis);
float takoSauce = smoothstep(0.12, 0.55, vTako.y + (tx.g - 0.5) * 0.35);
vec3 sauceC = ${lin('#5a2312')} * (0.75 + 0.5 * tx.g) * (0.85 + 0.3 * tx.r);
tcol = mix(tcol, sauceC, takoSauce);
float takoRawness = 1.0 - cooked;
bool takoCutFace = uCut > 0.5 && !gl_FrontFacing;
float takoCutD = 0.0;
if (takoCutFace) {
  // cross-section: distance of this back-shell point behind the cut plane -> radial position on the cut disc
  takoCutD = dot(uCutPlane.xyz, -vViewPosition) + uCutPlane.w;
  float rho = sqrt(max(${(BALL_R * BALL_R).toFixed(3)} - takoCutD * takoCutD, 0.0)) / ${BALL_R.toFixed(2)};
  vec3 cream = ${lin('#f3dc9c')} * (0.92 + 0.12 * tx.g);
  vec3 setB = ${lin('#efe0b6')} * (0.9 + 0.15 * tx.r);
  vec3 crust = ${lin('#8a4b1c')};
  vec3 cc = mix(cream, setB, smoothstep(0.45, 0.78, rho));
  cc = mix(cc, ${lin('#d9a45a')}, smoothstep(0.86, 0.93, rho));
  cc = mix(cc, crust, smoothstep(0.93, 0.975, rho));
  tcol = cc;
  takoSauce = 0.0;
  takoRawness = 1.0 - smoothstep(0.35, 0.7, rho);
}
diffuseColor.rgb = tcol;
`;

const ROUGH_F = /* glsl */ `
float roughnessFactor = mix(0.2, 0.5, cooked) * (0.9 + 0.25 * tx.r);
roughnessFactor = mix(roughnessFactor, 0.2, takoSauce);
if (takoCutFace) roughnessFactor = mix(0.55, 0.3, takoRawness);
`;

const NORMAL_F = /* glsl */ `
#include <normal_fragment_maps>
{
  if (takoCutFace) {
    normal = -uCutPlane.xyz;
  } else {
    float bs = mix(0.3, 3.0, cooked) * (1.0 - 0.65 * takoSauce);
    vec3 gO = (gFine + gCoarse * 0.5) * bs;
    vec3 nO = normalize(vObjN);
    vec3 nP = normalize(nO - (gO - nO * dot(gO, nO)));
    normal = normalize(normalMatrix * nP) * faceDirection;
  }
}
`;

const EMIS_F = /* glsl */ `
#include <emissivemap_fragment>
// fake translucency of raw batter / gooey centre
totalEmissiveRadiance += diffuseColor.rgb * 0.05 * takoRawness;
`;

const LIGHTS_F = /* glsl */ `
#include <lights_physical_fragment>
material.clearcoat = takoCutFace ? 0.0 : clamp(takoSauce * 1.0 + takoRawness * 0.45, 0.0, 1.0);
material.clearcoatRoughness = mix(0.22, 0.07, takoSauce);
`;

export function createTakoMaterial({ skirt = false } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    side: skirt ? THREE.FrontSide : THREE.DoubleSide,
  });
  const u = {
    uDetail: { value: getDetailTexture() },
    uGrad: { value: getGradTexture() },
    uSeed: { value: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10) },
    uWob: { value: new THREE.Vector4(0, 0, 0, 0) },
    uUp: { value: new THREE.Vector3(0, 1, 0) },
    uCut: { value: 0 },
    uCutPlane: { value: new THREE.Vector4(0, 0, 1, 1000) },
    uTriY: { value: skirt ? 1 : 0 },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + HEAD_V)
      .replace('#include <beginnormal_vertex>', NORMAL_V)
      .replace('#include <begin_vertex>', BEGIN_V);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HEAD_F)
      .replace('#include <color_fragment>', COLOR_F)
      .replace('#include <roughnessmap_fragment>', ROUGH_F)
      .replace('#include <normal_fragment_maps>', NORMAL_F)
      .replace('#include <emissivemap_fragment>', EMIS_F)
      .replace('#include <lights_physical_fragment>', LIGHTS_F);
  };
  mat.customProgramCacheKey = () => 'tako-surface-v2';
  return mat;
}
