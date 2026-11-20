import * as THREE from 'three';
import { TUB } from './bathroom.js';

export class BathWaterSystem {
  constructor(scene, rawHdr) {
    this.scene = scene;
    this.rawHdr = rawHdr;

    // Interactive impulse ripples (x, z, startTime, strength)
    this.ripples = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -10, 0));
    this.rippleCursor = 0;

    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildWaterSurface();
    this._buildFaucetStream();
    this._buildMicroFoamClusters();
    this._buildOverflowAndPuddles();
    this._buildSteam();
    this._buildPourStream();
  }

  _basinBoundsAtY(y) {
    const depthT = Math.max(0, Math.min(1, (TUB.rimY - y) / (TUB.rimY - TUB.floorY)));
    const minX = TUB.innerMinX + depthT * 0.035 + 0.004;
    const maxX = TUB.innerMaxX - depthT * 0.145 - 0.004;
    const minZ = TUB.innerMinZ + depthT * 0.025 + 0.004;
    const maxZ = TUB.innerMaxZ - depthT * 0.025 - 0.004;
    return { minX, maxX, minZ, maxZ };
  }

  _buildWaterSurface() {
    const segR = 32;
    const segA = 72;
    const positions = [];
    const uvs = [];
    const indices = [];

    positions.push(0, 0, 0);
    uvs.push(0.5, 0.5);

    for (let ir = 1; ir <= segR; ir++) {
      const r = ir / segR;
      for (let ia = 0; ia < segA; ia++) {
        const a = (ia / segA) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const n = 5.2;
        const bx = Math.pow(Math.abs(ca), 2 / n) * Math.sign(ca);
        const bz = Math.pow(Math.abs(sa), 2 / n) * Math.sign(sa);
        const px = bx * r;
        const pz = bz * r;
        positions.push(px, 0, pz);
        uvs.push(px * 0.5 + 0.5, pz * 0.5 + 0.5);
      }
    }

    for (let ia = 0; ia < segA; ia++) {
      const next = (ia + 1) % segA;
      indices.push(0, 1 + next, 1 + ia);
    }
    for (let ir = 1; ir < segR; ir++) {
      const ring0 = 1 + (ir - 1) * segA;
      const ring1 = 1 + ir * segA;
      for (let ia = 0; ia < segA; ia++) {
        const next = (ia + 1) % segA;
        const a = ring0 + ia;
        const b = ring0 + next;
        const c = ring1 + ia;
        const d = ring1 + next;
        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    this.waterUniforms = {
      uTime: { value: 0 },
      uEnvMap: { value: this.rawHdr },
      uLightDir: { value: new THREE.Vector3(-0.68, 0.68, 0.28).normalize() },
      uBounds: { value: new THREE.Vector4(-0.67, 0.43, -0.44, 0.05) },
      uWaterY: { value: 0.105 },
      uFill: { value: 0.0 },
      uFlow: { value: 0.0 },
      uFoam: { value: 0.0 },
      uTint: { value: 0.0 },
      uVortex: { value: 0.0 },
      uSlosh: { value: 0.0 },
      uDrainXZ: { value: new THREE.Vector2(TUB.drainPos.x, TUB.drainPos.z) },
      uImpactXZ: { value: new THREE.Vector2(TUB.spoutTip.x, TUB.spoutTip.z) },
      uRipples: { value: this.ripples },
    };

    const waterMat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: true,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform vec4 uBounds;
        uniform float uWaterY;
        uniform float uFlow;
        uniform float uFoam;
        uniform float uVortex;
        uniform float uSlosh;
        uniform vec2 uDrainXZ;
        uniform vec2 uImpactXZ;
        uniform vec4 uRipples[6];

        varying vec3 vWorldPos;
        varying vec2 vLocalUV;
        varying float vEdgeDist;
        varying float vVortexMask;

        float waveHeight(vec2 wp, float t) {
          float h = 0.0;
          h += sin(wp.x * 20.0 + t * 2.2 + wp.y * 8.0) * 0.0009;
          h += sin(wp.y * 24.0 - t * 1.9 + wp.x * 10.0) * 0.0008;
          h += sin((wp.x - wp.y) * 34.0 + t * 3.0) * 0.00045;

          if (uFlow > 0.01) {
            float dImp = length(wp - uImpactXZ);
            float impWave = sin(dImp * 58.0 - t * 14.0) * exp(-dImp * 3.4);
            float impWave2 = sin(dImp * 95.0 - t * 20.0) * exp(-dImp * 5.8) * 0.45;
            h += (impWave + impWave2) * 0.0075 * uFlow;
          }

          for (int i = 0; i < 6; i++) {
            vec4 rp = uRipples[i];
            float age = t - rp.z;
            if (age > 0.0 && age < 2.6 && rp.w > 0.001) {
              float d = length(wp - rp.xy);
              float front = age * 0.58;
              float env = exp(-abs(d - front) * 14.0) * exp(-age * 1.45);
              h += sin((d - front) * 44.0) * env * 0.012 * rp.w;
            }
          }

          h += sin(wp.x * 5.2 + t * 3.2) * cos(wp.y * 6.4 - t * 2.7) * 0.005 * uSlosh;

          if (uVortex > 0.01) {
            vec2 dv = wp - uDrainXZ;
            float r = length(dv);
            float funnel = -0.115 * uVortex / (1.0 + pow(r / 0.062, 2.1));
            float ang = atan(dv.y, dv.x);
            float spiral = sin(ang * 5.0 + r * 46.0 - t * 13.5) * exp(-r * 4.2) * 0.0068 * uVortex;
            h += funnel + spiral;
          }
          return h;
        }

        void main() {
          vec2 cxz = vec2((uBounds.x + uBounds.y) * 0.5, (uBounds.z + uBounds.w) * 0.5);
          vec2 hxz = vec2((uBounds.y - uBounds.x) * 0.5, (uBounds.w - uBounds.z) * 0.5);
          vec2 wpXZ = cxz + position.xz * hxz;

          float h = waveHeight(wpXZ, uTime);
          float wy = max(0.104, uWaterY + h);

          vWorldPos = vec3(wpXZ.x, wy, wpXZ.y);
          vLocalUV = uv;
          vEdgeDist = clamp(1.0 - max(abs(position.x), abs(position.z)), 0.0, 1.0);

          float dDrain = length(wpXZ - uDrainXZ);
          vVortexMask = uVortex * exp(-dDrain * 7.2);

          gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uEnvMap;
        uniform vec3 uLightDir;
        uniform float uFill;
        uniform float uFlow;
        uniform float uFoam;
        uniform float uTint;
        uniform float uVortex;
        uniform float uSlosh;
        uniform vec2 uDrainXZ;
        uniform vec2 uImpactXZ;
        uniform vec4 uRipples[6];

        varying vec3 vWorldPos;
        varying vec2 vLocalUV;
        varying float vEdgeDist;
        varying float vVortexMask;

        const float PI = 3.14159265359;

        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.5);
          return fract(p.x * p.y);
        }

        vec2 hash22(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.xx + p3.yz) * p3.zy);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) {
            v += amp * noise(p);
            p = p * 2.03 + vec2(11.7, 5.3);
            amp *= 0.5;
          }
          return v;
        }

        // Real Voronoi micro-bubble cellular foam pattern (returns vec2(distToCenter, cellEdge))
        vec2 voronoiBubbles(vec2 x) {
          vec2 n = floor(x);
          vec2 f = fract(x);
          float md = 8.0;
          float md2 = 8.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash22(n + g);
              vec2 r = g + o - f;
              float d = dot(r, r);
              if (d < md) {
                md2 = md;
                md = d;
              } else if (d < md2) {
                md2 = d;
              }
            }
          }
          return vec2(sqrt(md), sqrt(md2) - sqrt(md));
        }

        float evalHeight(vec2 wp, float t) {
          float h = 0.0;
          h += sin(wp.x * 22.0 + t * 2.2 + wp.y * 9.0) * 0.0012;
          h += sin(wp.y * 27.0 - t * 1.9 + wp.x * 12.0) * 0.0011;
          h += sin((wp.x + wp.y) * 42.0 - t * 3.1) * 0.0006;
          h += (noise(wp * 22.0 + vec2(t * 0.7, -t * 0.5)) - 0.5) * 0.0015;

          if (uFlow > 0.01) {
            float dImp = length(wp - uImpactXZ);
            h += sin(dImp * 62.0 - t * 14.0) * exp(-dImp * 3.2) * 0.0095 * uFlow;
            h += sin(dImp * 108.0 - t * 21.0) * exp(-dImp * 5.2) * 0.0042 * uFlow;
          }

          for (int i = 0; i < 6; i++) {
            vec4 rp = uRipples[i];
            float age = t - rp.z;
            if (age > 0.0 && age < 2.6 && rp.w > 0.001) {
              float d = length(wp - rp.xy);
              float front = age * 0.58;
              float env = exp(-abs(d - front) * 14.0) * exp(-age * 1.45);
              h += sin((d - front) * 44.0) * env * 0.013 * rp.w;
            }
          }

          if (uVortex > 0.01) {
            vec2 dv = wp - uDrainXZ;
            float r = length(dv);
            float funnel = -0.115 * uVortex / (1.0 + pow(r / 0.062, 2.1));
            float ang = atan(dv.y, dv.x);
            float spiral = sin(ang * 5.0 + r * 50.0 - t * 13.5) * exp(-r * 4.0) * 0.0085 * uVortex;
            h += funnel + spiral;
          }
          return h;
        }

        // Combined real Poly Haven modern_bathroom HDRI + exact architectural bathroom wall/window ray reflection!
        vec3 sampleBathroomReflection(vec3 origin, vec3 dir) {
          vec3 d = normalize(dir);
          // 1. Sample Poly Haven HDRI base
          float phi = atan(d.z, d.x) + 1.15;
          float u = phi / (2.0 * PI) + 0.5;
          float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;
          vec3 hdr = texture2D(uEnvMap, vec2(fract(u), clamp(v, 0.01, 0.99))).rgb;

          // 2. Analytical ray hit on back tiled wall (z = -0.62), mirror frame, & left frosted window wall (x = -0.84)
          vec3 refl = hdr * 0.85;
          if (d.z < -0.04) {
            float tBack = (-0.62 - origin.z) / d.z;
            if (tBack > 0.0 && tBack < 3.6) {
              vec3 hit = origin + d * tBack;
              if (hit.y > 0.48 && hit.y < 2.2) {
                vec2 tileUV = vec2(hit.x * 6.8, hit.y * 6.8);
                vec2 gf = abs(fract(tileUV) - 0.5);
                float grout = smoothstep(0.45, 0.495, max(gf.x, gf.y));
                vec3 tileCol = mix(vec3(0.68, 0.66, 0.62), vec3(0.24, 0.23, 0.22), grout);
                // Warm daylight falloff across back wall (brighter toward left window)
                float winGrad = smoothstep(0.95, -0.85, hit.x);
                tileCol *= (0.65 + 0.65 * winGrad);
                // Dark framed mirror reflection above shelf (x: -0.03..0.59, y: 0.92..1.56)
                float inMir = step(-0.04, hit.x) * step(hit.x, 0.60) * step(0.91, hit.y) * step(hit.y, 1.57);
                float inMirInner = step(-0.02, hit.x) * step(hit.x, 0.58) * step(0.93, hit.y) * step(hit.y, 1.55);
                tileCol = mix(tileCol, vec3(0.08, 0.08, 0.09), inMir * (1.0 - inMirInner));
                tileCol = mix(tileCol, hdr * 1.15, inMirInner * 0.85);
                // Shelf dark underside shadow reflection
                float inShelf = step(-0.06, hit.x) * step(hit.x, 0.62) * step(0.82, hit.y) * step(hit.y, 0.86);
                tileCol = mix(tileCol, vec3(0.36, 0.31, 0.26), inShelf);
                refl = mix(refl, tileCol, 0.78);
              }
            }
          }
          if (d.x < -0.06) {
            float tLeft = (-0.84 - origin.x) / d.x;
            if (tLeft > 0.0 && tLeft < 3.6) {
              vec3 hit = origin + d * tLeft;
              float inWin = step(1.02, hit.y) * step(hit.y, 1.92) * step(-0.50, hit.z) * step(hit.z, 0.40);
              if (inWin > 0.5) {
                refl = mix(refl, vec3(2.9, 2.8, 2.6), 0.90);
              }
            }
          }
          return refl;
        }

        void main() {
          vec2 wp = vWorldPos.xz;
          float eps = 0.0036;
          float hC = evalHeight(wp, uTime);
          float hX = evalHeight(wp + vec2(eps, 0.0), uTime);
          float hZ = evalHeight(wp + vec2(0.0, eps), uTime);
          vec3 N = normalize(vec3(hC - hX, eps * 0.92, hC - hZ));

          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 R = reflect(-V, N);
          R.y = max(R.y, 0.02);

          float NdotV = max(dot(N, V), 0.001);
          float fresnel = 0.028 + (1.0 - 0.028) * pow(1.0 - NdotV, 4.2);

          vec3 envRefl = sampleBathroomReflection(vWorldPos, R);

          // Crisp water specular glints from frosted window & ceiling downlight
          vec3 H = normalize(uLightDir + V);
          float specWindow = pow(max(dot(N, H), 0.0), 480.0) * 3.2 + pow(max(dot(N, H), 0.0), 52.0) * 0.26;
          vec3 ceilDir = normalize(vec3(-0.15, 2.4, -0.15) - vWorldPos);
          vec3 H2 = normalize(ceilDir + V);
          float specCeil = pow(max(dot(N, H2), 0.0), 280.0) * 1.6;
          vec3 specCol = vec3(1.0, 0.985, 0.95) * (specWindow + specCeil);

          // Authentic deep bathwater optical absorption (clear fresh aqua-slate depth -> soft warm rose-milk bathwater)
          vec3 clearDeep = vec3(0.42, 0.66, 0.70);
          vec3 bathMilk = vec3(0.86, 0.72, 0.74);
          vec3 bodyColor = mix(clearDeep, bathMilk, uTint * 0.80);

          // Depth & porcelain basin edge shadow (deeper in center, crisp contact meniscus near walls)
          float centerDepth = smoothstep(0.0, 0.28, vEdgeDist);
          bodyColor = mix(bodyColor * 1.15, bodyColor * 0.74, centerDepth * 0.65);
          float meniscus = smoothstep(0.0, 0.06, vEdgeDist);
          bodyColor *= mix(0.66, 1.0, meniscus);

          // Shimmering underwater caustics
          vec2 caustUV = wp * 10.0 + N.xz * 2.8;
          float c1 = noise(caustUV + vec2(uTime * 0.45, -uTime * 0.35));
          float c2 = noise(caustUV * 1.5 - vec2(uTime * 0.32, uTime * 0.48));
          float caustic = pow(clamp(1.0 - abs(c1 - c2) * 3.4, 0.0, 1.0), 2.6) * (1.0 - uTint * 0.55);
          bodyColor += vec3(0.28, 0.34, 0.34) * caustic * (0.35 + 0.65 * uFill);

          // Deep optical vortex cavity darkening
          bodyColor *= mix(1.0, 0.36, vVortexMask * 0.85);

          vec3 waterCol = mix(bodyColor * 0.82, envRefl, clamp(fresnel * 1.65 + 0.22, 0.0, 0.96)) + specCol;

          // =====================================================================
          // REALISTIC CELLULAR MICRO-BUBBLE BATH FOAM (Crisp snowy rafts + clear water windows!)
          // =====================================================================
          vec2 foamPos = wp;
          if (uVortex > 0.01) {
            vec2 dv = wp - uDrainXZ;
            float r = length(dv) + 0.001;
            float twist = uVortex * (2.3 / (r + 0.14)) * 0.65 + uTime * 2.1 * uVortex;
            float ct = cos(twist), st = sin(twist);
            foamPos = uDrainXZ + vec2(ct * dv.x - st * dv.y, st * dv.x + ct * dv.y);
          }

          float drift = uTime * 0.032;
          float raftLarge = fbm(foamPos * 3.6 + vec2(drift, -drift * 0.6));
          float raftDetail = fbm(foamPos * 10.5 - vec2(drift * 1.2, drift * 0.8));
          float raftShape = raftLarge * 0.72 + raftDetail * 0.28;

          // Strong organic concentration around faucet impact so rich snowy foam blooms naturally on the left
          // while keeping gorgeous glassy water reflections visible across the right half until high foam!
          float dImp = length(wp - uImpactXZ);
          float impactBoost = exp(-dImp * 2.4) * (0.38 * uFlow + 0.30 * uFoam);
          float edgeCling = (1.0 - smoothstep(0.0, 0.18, vEdgeDist)) * 0.14 * uFoam;

          float foamDensity = raftShape + impactBoost + edgeCling;
          float thresh = mix(1.02, 0.44, uFoam);
          float coreFoam = smoothstep(thresh + 0.04, thresh + 0.18, foamDensity) * smoothstep(0.02, 0.16, uFoam);
          float laceZone = smoothstep(thresh - 0.11, thresh + 0.06, foamDensity) * smoothstep(0.02, 0.16, uFoam);

          vec2 cellMed = voronoiBubbles(foamPos * 64.0 + vec2(drift * 1.4, 0.0));
          vec2 cellFine = voronoiBubbles(foamPos * 150.0 - vec2(0.0, drift * 1.8));

          float bubbleDome = clamp(1.0 - cellMed.x * 1.28, 0.0, 1.0);
          float bubbleRim = smoothstep(0.15, 0.02, cellMed.y);
          float fineFroth = clamp(1.0 - cellFine.x * 1.32, 0.0, 1.0);

          float laceMask = laceZone * clamp(bubbleRim * 0.82 + bubbleDome * 0.45 + fineFroth * 0.35, 0.0, 1.0);
          float splashRing = exp(-dImp * 9.5) * uFlow * (0.65 + 0.35 * fineFroth);
          float vortexStreaks = vVortexMask * smoothstep(0.40, 0.76, raftDetail) * 0.72;

          float foamCoverage = clamp(max(coreFoam, laceMask * 0.86) + splashRing + vortexStreaks, 0.0, 0.99);

          // Physically shaded snowy-white bath foam with soft micro-bubble relief & sunlight gradient
          float foamBump = coreFoam * (0.45 + 0.35 * bubbleDome + 0.20 * fineFroth);
          vec3 foamLit = mix(vec3(0.82, 0.84, 0.87), vec3(1.04, 1.03, 1.01), clamp(0.58 + foamBump * 0.46, 0.0, 1.0));
          float winSide = smoothstep(0.55, -0.65, wp.x);
          foamLit *= (0.92 + 0.16 * winSide);
          float microSpark = pow(bubbleDome, 5.5) * 0.38 + pow(fineFroth, 6.5) * 0.26;
          vec3 foamCol = foamLit + vec3(1.0, 0.99, 0.97) * microSpark;

          vec3 finalCol = mix(waterCol, foamCol, foamCoverage);

          float baseAlpha = mix(0.46 + uFill * 0.28, 0.84, uTint * 0.78);
          float alpha = clamp(max(baseAlpha, fresnel * 0.95 + foamCoverage * 0.98), 0.28, 0.99);
          alpha *= smoothstep(0.005, 0.035, uFill);

          gl_FragColor = vec4(finalCol, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.waterMesh = new THREE.Mesh(geo, waterMat);
    this.waterMesh.renderOrder = 3;
    this.waterMesh.visible = false;
    this.group.add(this.waterMesh);
  }

  _buildFaucetStream() {
    const geo = new THREE.CylinderGeometry(0.0105, 0.0145, 1.0, 22, 26, true);
    geo.translate(0, -0.5, 0);

    this.streamUniforms = {
      uTime: { value: 0 },
      uFlow: { value: 0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.streamUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uFlow;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 p = position;
          float wob = sin(p.y * 36.0 - uTime * 28.0) * 0.0017 + cos(p.y * 64.0 - uTime * 42.0 + atan(p.z, p.x) * 3.0) * 0.0011;
          float spread = mix(0.72, 1.18, 1.0 - uv.y);
          p.x = p.x * (0.45 + 0.65 * uFlow) + normalize(vec2(p.x, p.z) + 1e-5).x * wob * spread;
          p.z = p.z * (0.45 + 0.65 * uFlow) + normalize(vec2(p.x, p.z) + 1e-5).y * wob * spread;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorldPos = wp.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uFlow;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vWorldPos;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }

        void main() {
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 N = normalize(vNormalW);
          float fres = pow(1.0 - abs(dot(N, V)), 2.0);
          float streak1 = noise(vec2(vUv.x * 16.0, vUv.y * 14.0 + uTime * 12.5));
          float streak2 = noise(vec2(vUv.x * 30.0, vUv.y * 26.0 + uTime * 19.0));
          float foam = smoothstep(0.40, 0.84, streak1 * 0.65 + streak2 * 0.35);

          vec3 col = mix(vec3(0.76, 0.85, 0.88), vec3(1.0, 0.995, 0.985), clamp(fres * 0.85 + foam * 0.6, 0.0, 1.0));
          float alpha = clamp((0.38 + fres * 0.52 + foam * 0.34) * smoothstep(0.0, 0.12, uFlow), 0.0, 0.94);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.streamMesh = new THREE.Mesh(geo, mat);
    this.streamMesh.position.copy(TUB.spoutTip);
    this.streamMesh.visible = false;
    this.streamMesh.renderOrder = 4;
    this.group.add(this.streamMesh);

    // Fine ballistic splash droplets
    const dropCount = 32;
    const dropGeo = new THREE.SphereGeometry(0.0034, 6, 6);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fbfc,
      roughness: 0.04,
      transparent: true,
      opacity: 0.78,
      clearcoat: 1.0,
      depthWrite: false,
    });
    this.splashDrops = new THREE.InstancedMesh(dropGeo, dropMat, dropCount);
    this.splashDrops.renderOrder = 5;
    this.group.add(this.splashDrops);
    this.dropSeeds = Array.from({ length: dropCount }, () => ({
      ang: Math.random() * Math.PI * 2,
      spd: 0.14 + Math.random() * 0.24,
      vy: 0.30 + Math.random() * 0.32,
      phase: Math.random(),
      size: 0.55 + Math.random() * 0.85,
    }));
  }

  // Delicate, soft 3D foam puffs (billowed frothy micro-tufts, ZERO hard giant plastic spheres!)
  _buildMicroFoamClusters() {
    // Soft feathered foamy puff sprite texture (micro-bubbled edge, warm cream top, cool subtle underside)
    const size = 96;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Draw organic cluster of 14 tiny overlapping translucent soap bubbles inside one soft foam tuft!
    const subBubbles = [
      [0.50, 0.50, 0.28, 0.85],
      [0.34, 0.48, 0.20, 0.75],
      [0.66, 0.49, 0.21, 0.75],
      [0.46, 0.34, 0.19, 0.80],
      [0.56, 0.62, 0.18, 0.65],
      [0.36, 0.61, 0.16, 0.60],
      [0.64, 0.36, 0.15, 0.70],
      [0.24, 0.54, 0.12, 0.50],
      [0.76, 0.54, 0.12, 0.50],
      [0.50, 0.24, 0.11, 0.55],
      [0.42, 0.55, 0.14, 0.75],
      [0.58, 0.45, 0.14, 0.78],
    ];
    for (const [bx, by, br, ba] of subBubbles) {
      const gx = bx * size, gy = by * size, gr = br * size;
      const g = ctx.createRadialGradient(gx - gr * 0.25, gy - gr * 0.28, gr * 0.06, gx, gy, gr);
      g.addColorStop(0, `rgba(255, 254, 251, ${ba})`);
      g.addColorStop(0.58, `rgba(246, 245, 242, ${ba * 0.78})`);
      g.addColorStop(0.84, `rgba(222, 226, 230, ${ba * 0.32})`);
      g.addColorStop(1, 'rgba(222, 226, 230, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, gy, gr, 0, Math.PI * 2);
      ctx.fill();
    }
    const foamPuffTex = new THREE.CanvasTexture(c);
    foamPuffTex.colorSpace = THREE.SRGBColorSpace;

    // Instanced camera-tilted soft foam tuft cards sitting gently on the water surface (lightweight, zero dark seams!)
    this.bubbleCount = 180;
    const planeGeo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: foamPuffTex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      color: new THREE.Color(0xfdfbf7),
    });

    this.foamBubbles = new THREE.InstancedMesh(planeGeo, mat, this.bubbleCount);
    this.foamBubbles.renderOrder = 6;
    this.group.add(this.foamBubbles);

    // Organic foam pillow clusters concentrated right around the faucet splash & lush soap islands
    this.bubbles = Array.from({ length: this.bubbleCount }, (_, i) => {
      const isSplashCluster = i < 110;
      const cx = isSplashCluster ? -0.49 : [-0.30, -0.14, 0.04, -0.38][i % 4];
      const cz = isSplashCluster ? -0.20 : [-0.24, -0.15, -0.22, -0.09][i % 4];
      const spreadX = isSplashCluster ? 0.22 : 0.28;
      const spreadZ = isSplashCluster ? 0.20 : 0.22;
      const rad = 0.028 + Math.pow(Math.random(), 2.0) * 0.048;
      return {
        x: THREE.MathUtils.clamp(cx + (Math.random() - 0.5) * spreadX, TUB.innerMinX + 0.05, TUB.innerMaxX - 0.08),
        z: THREE.MathUtils.clamp(cz + (Math.random() - 0.5) * spreadZ, TUB.innerMinZ + 0.04, TUB.innerMaxZ - 0.03),
        vx: 0,
        vz: 0,
        baseR: rad,
        threshold: isSplashCluster ? Math.random() * 0.55 : 0.35 + Math.random() * 0.62,
        wobblePhase: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        lift: (Math.random() * 0.015),
        spilled: false,
        spillY: TUB.rimY,
      };
    });
  }

  _buildOverflowAndPuddles() {
    const segX = 28;
    const positions = [];
    const uvs = [];
    const indices = [];

    const curvePts = [
      [0.055, 0.523],
      [0.095, 0.524],
      [0.135, 0.523],
      [0.156, 0.517],
      [0.163, 0.495],
      [0.164, 0.420],
      [0.164, 0.300],
      [0.164, 0.160],
      [0.164, 0.045],
      [0.162, 0.004],
    ];

    const x0 = -0.58, x1 = 0.34;
    for (let is = 0; is < curvePts.length; is++) {
      const [z, y] = curvePts[is];
      const v = is / (curvePts.length - 1);
      for (let ix = 0; ix <= segX; ix++) {
        const u = ix / segX;
        positions.push(THREE.MathUtils.lerp(x0, x1, u), y, z);
        uvs.push(u, v);
      }
    }
    const stride = segX + 1;
    for (let is = 0; is < curvePts.length - 1; is++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = is * stride + ix;
        const b = a + 1;
        const c = (is + 1) * stride + ix;
        const d = c + 1;
        indices.push(a, c, d);
        indices.push(a, d, b);
      }
    }
    const ovGeo = new THREE.BufferGeometry();
    ovGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    ovGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    ovGeo.setIndex(indices);
    ovGeo.computeVertexNormals();

    this.overflowUniforms = {
      uTime: { value: 0 },
      uAmount: { value: 0 },
    };

    const ovMat = new THREE.ShaderMaterial({
      uniforms: this.overflowUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uAmount;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vWorldPos;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }

        void main() {
          float riv = noise(vec2(vUv.x * 9.5, vUv.y * 4.2 - uTime * 3.6));
          float riv2 = noise(vec2(vUv.x * 22.0 + 3.1, vUv.y * 8.5 - uTime * 6.2));
          float edgeMask = sin(vUv.x * 3.14159);
          float raw = riv * 0.65 + riv2 * 0.35;
          float thresh = 0.56 - uAmount * 0.42;
          float sheet = smoothstep(thresh, thresh + 0.16, raw) * edgeMask;
          // Crisp refraction shadow edge along each cascading rivulet so water stands out vividly on white porcelain!
          float rimShadow = smoothstep(thresh - 0.04, thresh + 0.04, raw) * (1.0 - smoothstep(thresh + 0.04, thresh + 0.14, raw)) * edgeMask;

          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 N = normalize(vNormalW + vec3((riv2 - 0.5) * 0.55, 0.0, 0.0));
          float fres = 0.06 + 0.94 * pow(1.0 - max(dot(N, V), 0.0), 2.8);
          float spec = pow(max(dot(N, normalize(vec3(-0.6, 0.7, 0.4) + V)), 0.0), 48.0);

          vec3 streamCol = mix(vec3(0.54, 0.72, 0.77), vec3(0.96, 0.99, 1.0), clamp(fres * 0.75 + spec * 0.95 + riv2 * 0.25, 0.0, 1.0));
          // Subtle darkened refracted edge border of water streams on white apron
          streamCol = mix(streamCol, vec3(0.42, 0.54, 0.59), rimShadow * 0.65);

          float alpha = clamp((sheet * (0.48 + fres * 0.42 + spec * 0.45) + rimShadow * 0.32) * smoothstep(0.0, 0.12, uAmount), 0.0, 0.92);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(streamCol, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.overflowMesh = new THREE.Mesh(ovGeo, ovMat);
    this.overflowMesh.renderOrder = 4;
    this.overflowMesh.visible = false;
    this.group.add(this.overflowMesh);

    this.puddleUniforms = {
      uTime: { value: 0 },
      uWetness: { value: 0 },
      uEnvMap: { value: this.rawHdr },
    };
    const puddleGeo = new THREE.PlaneGeometry(1.48, 0.84);
    const puddleMat = new THREE.ShaderMaterial({
      uniforms: this.puddleUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uWetness;
        uniform sampler2D uEnvMap;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        const float PI = 3.14159265359;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }

        void main() {
          vec2 p = vec2((vUv.x - 0.48) * 1.4, (1.0 - vUv.y) * 1.35);
          float n = noise(vUv * 5.5) * 0.35 + noise(vUv * 12.0) * 0.15;
          float dist = length(p * vec2(0.85, 1.15)) - n * 0.35;
          float maxRad = 0.08 + uWetness * 0.92;
          float mask = smoothstep(maxRad, maxRad - 0.14, dist) * smoothstep(0.02, 0.12, uWetness);
          if (mask < 0.01) discard;

          float rip = sin(dist * 45.0 - uTime * 5.2) * 0.015 * uWetness;
          vec3 N = normalize(vec3(rip, 1.0, rip * 0.8));
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 R = reflect(-V, N);
          float phi = atan(R.z, R.x) + 1.15;
          vec2 envUV = vec2(fract(phi / (2.0 * PI) + 0.5), clamp(asin(clamp(R.y, -1.0, 1.0)) / PI + 0.5, 0.02, 0.98));
          vec3 env = texture2D(uEnvMap, envUV).rgb * 0.98;

          float fres = 0.05 + 0.95 * pow(1.0 - max(dot(N, V), 0.0), 3.6);
          vec3 darkWet = vec3(0.14, 0.13, 0.12);
          vec3 col = mix(darkWet, env, clamp(fres * 1.35 + 0.18, 0.0, 0.95));
          float edgeRim = smoothstep(0.15, 0.5, mask) * (1.0 - smoothstep(0.5, 0.92, mask)) * 0.32;
          col += vec3(0.95, 0.97, 0.99) * edgeRim;

          float alpha = mask * (0.38 + fres * 0.56);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.puddleMesh = new THREE.Mesh(puddleGeo, puddleMat);
    this.puddleMesh.rotation.x = -Math.PI / 2;
    this.puddleMesh.position.set(-0.08, 0.0028, 0.54);
    this.puddleMesh.renderOrder = 2;
    this.puddleMesh.visible = false;
    this.group.add(this.puddleMesh);
  }

  _buildSteam() {
    // Layered domain-warped GLSL rising steam curtains (real curling hot-bath vapor tendrils, ZERO circular stamps!)
    this.steamUniforms = {
      uTime: { value: 0 },
      uSteam: { value: 0 },
      uPartX: { value: -9.0 },
    };

    const steamMat = new THREE.ShaderMaterial({
      uniforms: this.steamUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uSteam;
        uniform float uPartX;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.04 + vec2(9.2, 4.7);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          if (uSteam < 0.01) discard;
          // Domain-warped rising vertical curling tendrils
          vec2 p = vec2(vUv.x * 3.8 + vWorldPos.z * 2.1, vUv.y * 2.1 - uTime * 0.28);
          float warpX = fbm(p * 1.15 + vec2(0.0, -uTime * 0.14)) - 0.5;
          float warpY = fbm(p * 1.35 + vec2(4.2, -uTime * 0.18)) - 0.5;
          float wisp1 = fbm(p + vec2(warpX * 1.45, warpY * 0.85));
          float wisp2 = fbm(p * 2.2 - vec2(warpY * 1.1, uTime * 0.16));

          // Feathered silhouette: rises smoothly off water surface, fades softly at edges & top
          float envX = sin(vUv.x * 3.14159);
          envX = pow(clamp(envX, 0.0, 1.0), 0.75);
          float envY = smoothstep(0.0, 0.18, vUv.y) * pow(1.0 - vUv.y, 1.35);

          // Finger parting interaction if user swipes through steam
          float fingerGap = smoothstep(0.06, 0.22, abs(vWorldPos.x - uPartX));

          float tendrils = smoothstep(0.36, 0.78, wisp1 * 0.72 + wisp2 * 0.28);
          float alpha = tendrils * envX * envY * fingerGap * uSteam * 0.34;
          if (alpha < 0.004) discard;

          // Warm daylight backlight from left frosted window grazing the steam!
          float sunSide = smoothstep(0.6, -0.75, vWorldPos.x);
          vec3 col = mix(vec3(0.95, 0.96, 0.97), vec3(1.06, 1.04, 1.00), sunSide);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.steamPlanes = [];
    const layers = [
      { z: -0.35, rotY: 0.06, w: 1.02, h: 0.56 },
      { z: -0.22, rotY: -0.04, w: 1.08, h: 0.62 },
      { z: -0.10, rotY: 0.08, w: 1.02, h: 0.54 },
      { z:  0.01, rotY: -0.05, w: 0.92, h: 0.46 },
    ];
    for (const l of layers) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(l.w, l.h, 1, 1), steamMat);
      m.position.set(-0.15, TUB.rimY + l.h * 0.44, l.z);
      m.rotation.y = l.rotY;
      m.renderOrder = 7;
      this.group.add(m);
      this.steamPlanes.push({ mesh: m, h: l.h });
    }
  }

  _buildPourStream() {
    const geo = new THREE.CylinderGeometry(0.0045, 0.007, 1.0, 10, 8);
    geo.translate(0, -0.5, 0);
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf4dce0),
      roughness: 0.08,
      metalness: 0.0,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.85,
    });
    this.pourMesh = new THREE.Mesh(geo, mat);
    this.pourMesh.visible = false;
    this.pourMesh.renderOrder = 5;
    this.group.add(this.pourMesh);

    // Subtle idle invitation droplet forming at chrome faucet spout tip when tub is empty & untouched
    const dripGeo = new THREE.SphereGeometry(0.0055, 10, 10);
    dripGeo.scale(0.85, 1.35, 0.85);
    const dripMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef7f9,
      roughness: 0.02,
      metalness: 0.0,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.86,
    });
    this.idleDrip = new THREE.Mesh(dripGeo, dripMat);
    this.idleDrip.visible = false;
    this.idleDrip.renderOrder = 5;
    this.group.add(this.idleDrip);
  }

  addRipple(worldX, worldZ, strength = 1.0, time = 0) {
    this.ripples[this.rippleCursor].set(worldX, worldZ, time, strength);
    this.rippleCursor = (this.rippleCursor + 1) % this.ripples.length;
  }

  update(dt, time, state) {
    const {
      fill,
      flow,
      foam,
      tint,
      vortex,
      slosh,
      overflowRate,
      floorWetness,
      steamLevel,
      stirPos,
      stirVel,
      pourOrigin,
    } = state;

    const waterY = THREE.MathUtils.lerp(TUB.floorY + 0.006, TUB.rimY - 0.002, Math.min(1.01, fill));
    const bounds = this._basinBoundsAtY(waterY);

    // 1. Water Surface
    this.waterMesh.visible = fill > 0.006;
    this.waterUniforms.uTime.value = time;
    this.waterUniforms.uWaterY.value = waterY;
    this.waterUniforms.uFill.value = Math.min(1, fill);
    this.waterUniforms.uFlow.value = flow;
    this.waterUniforms.uFoam.value = foam;
    this.waterUniforms.uTint.value = tint;
    this.waterUniforms.uVortex.value = vortex;
    this.waterUniforms.uSlosh.value = slosh;
    this.waterUniforms.uBounds.value.set(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ);

    // 2. Falling Faucet Water Stream & Splash Droplets
    const streamH = Math.max(0.04, TUB.spoutTip.y - waterY);
    this.streamMesh.visible = flow > 0.015;
    this.streamMesh.scale.set(1, streamH, 1);
    this.streamUniforms.uTime.value = time;
    this.streamUniforms.uFlow.value = flow;

    const dummy = new THREE.Object3D();
    this.splashDrops.visible = flow > 0.04;
    if (this.splashDrops.visible) {
      for (let i = 0; i < this.dropSeeds.length; i++) {
        const s = this.dropSeeds[i];
        const t = (time * 2.5 + s.phase) % 1.0;
        const r = s.spd * t * (0.4 + 0.6 * flow);
        const y = waterY + (s.vy * t - 0.9 * t * t) * (0.35 + 0.65 * flow);
        if (y < waterY - 0.01) {
          dummy.scale.setScalar(0.0001);
        } else {
          dummy.position.set(
            TUB.spoutTip.x + Math.cos(s.ang + time * 0.7) * r,
            y,
            TUB.spoutTip.z + Math.sin(s.ang + time * 0.7) * r
          );
          dummy.scale.setScalar(s.size * (1 - t * 0.6) * Math.min(1, flow * 1.4));
        }
        dummy.updateMatrix();
        this.splashDrops.setMatrixAt(i, dummy.matrix);
      }
      this.splashDrops.instanceMatrix.needsUpdate = true;
    }

    // 3. Soft Layered Frothy Foam Tufts resting horizontally along the water surface
    const showBubbles = (foam > 0.03 && fill > 0.03) || floorWetness > 0.15;
    this.foamBubbles.visible = showBubbles;
    if (showBubbles) {
      for (let i = 0; i < this.bubbles.length; i++) {
        const b = this.bubbles[i];
        const active = foam > b.threshold && fill > 0.03;
        if (!active && !b.spilled) {
          dummy.scale.setScalar(0.0001);
          dummy.updateMatrix();
          this.foamBubbles.setMatrixAt(i, dummy.matrix);
          continue;
        }

        if (b.spilled) {
          if (floorWetness < 0.05) b.spilled = false;
          b.spillY = Math.max(0.004, b.spillY - dt * 0.08);
          dummy.position.set(b.x, b.spillY, b.z);
          dummy.rotation.set(-Math.PI / 2, 0, b.rotZ);
          dummy.scale.set(b.baseR * 0.9, b.baseR * 0.9, 1);
          dummy.updateMatrix();
          this.foamBubbles.setMatrixAt(i, dummy.matrix);
          continue;
        }

        if (flow > 0.02) {
          const dx = b.x - TUB.spoutTip.x;
          const dz = b.z - TUB.spoutTip.z;
          const d = Math.hypot(dx, dz) + 0.02;
          if (d < 0.30) {
            b.vx += (dx / d) * flow * dt * 0.12;
            b.vz += (dz / d) * flow * dt * 0.12;
          }
        }

        if (stirPos) {
          const dx = b.x - stirPos.x;
          const dz = b.z - stirPos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.20) {
            const w = 1 - d / 0.20;
            b.vx += (stirVel.x * 1.6 + (dx / (d + 0.02)) * 0.18) * w * dt * 4.5;
            b.vz += (stirVel.y * 1.6 + (dz / (d + 0.02)) * 0.18) * w * dt * 4.5;
          }
        }

        if (vortex > 0.02) {
          const dx = b.x - TUB.drainPos.x;
          const dz = b.z - TUB.drainPos.z;
          const r = Math.hypot(dx, dz) + 0.015;
          const pull = vortex * dt * (0.30 / (r + 0.15));
          const spin = vortex * dt * (0.68 / (r + 0.11));
          b.vx += (-dx / r * pull - dz / r * spin);
          b.vz += (-dz / r * pull + dx / r * spin);
          b.rotZ += vortex * dt * 2.2;
        }

        b.vx *= Math.exp(-dt * 2.8);
        b.vz *= Math.exp(-dt * 2.8);
        b.x += b.vx * dt;
        b.z += b.vz * dt;

        if (overflowRate > 0.25 && b.z > bounds.maxZ - 0.03 && Math.random() < dt * 0.65) {
          b.spilled = true;
          b.z = TUB.outerMaxZ + 0.015 + Math.random() * 0.08;
          b.spillY = TUB.rimY - 0.01;
        } else {
          b.x = THREE.MathUtils.clamp(b.x, bounds.minX + 0.04, bounds.maxX - 0.04);
          b.z = THREE.MathUtils.clamp(b.z, bounds.minZ + 0.04, bounds.maxZ - 0.04);
        }

        const dDr = Math.hypot(b.x - TUB.drainPos.x, b.z - TUB.drainPos.z);
        const funnelY = vortex > 0.01 ? -0.082 * vortex / (1 + Math.pow(dDr / 0.056, 2.2)) : 0;
        const bob = Math.sin(time * 2.0 + b.wobblePhase) * 0.002;
        const growth = THREE.MathUtils.clamp((foam - b.threshold) * 3.0, 0.0, 1.0);
        const r = b.baseR * (0.6 + 0.65 * growth);

        dummy.position.set(b.x, Math.max(TUB.floorY + 0.012, waterY + funnelY + 0.003 + b.lift * growth + bob), b.z);
        // Slightly tilted flat foam tuft hugging the water surface
        dummy.rotation.set(-Math.PI / 2 + Math.sin(b.wobblePhase) * 0.08, 0, b.rotZ);
        dummy.scale.set(r, r * 0.88, 1);
        dummy.updateMatrix();
        this.foamBubbles.setMatrixAt(i, dummy.matrix);
      }
      this.foamBubbles.instanceMatrix.needsUpdate = true;
    }

    // 4. Overflow Cascade & Reflective Floor Puddles
    this.overflowMesh.visible = overflowRate > 0.015;
    this.overflowUniforms.uTime.value = time;
    this.overflowUniforms.uAmount.value = overflowRate;

    this.puddleMesh.visible = floorWetness > 0.015;
    this.puddleUniforms.uTime.value = time;
    this.puddleUniforms.uWetness.value = floorWetness;

    // 5. Realistic Light-Catching Rising Steam Curtains
    const steamOn = steamLevel > 0.02;
    this.steamUniforms.uTime.value = time;
    this.steamUniforms.uSteam.value = steamLevel;
    this.steamUniforms.uPartX.value = stirPos ? stirPos.x : -9.0;
    for (const l of this.steamPlanes) {
      l.mesh.visible = steamOn;
      l.mesh.position.y = waterY + l.h * 0.46;
    }

    // 6. Pour Stream
    if (pourOrigin) {
      this.pourMesh.visible = true;
      const h = Math.max(0.05, pourOrigin.y - waterY);
      this.pourMesh.position.copy(pourOrigin);
      this.pourMesh.scale.set(1, h, 1);
    } else {
      this.pourMesh.visible = false;
    }
  }
}
