// 젤리 슬라이더 셰이더(WebGL2 · GLSL ES 3.00).
// 뼈대는 TypeGPU 예제 "Jelly Slider"(Copyright (c) 2025 Software Mansion, MIT License —
// github.com/software-mansion/TypeGPU, apps/typegpu-docs/src/examples/rendering/jelly-slider)의 WGSL
// 레이마칭을 옮긴 것이다(판·홈 SDF, 줄 거리장, 굴절·흡수·산란, 가짜 색 그림자, 빛 모임, AO, TAA).
// 영상(sample/design4.mp4)은 그 예제가 따라 만든 원작 쪽이라, 영상을 재서 다음을 고쳤다:
//  · 카메라 높이각 54.9° → 50°(jelly-camera.ts), 판 은은한 반사광·보랏빛(SHEEN_*, PLATE_TINT)
//  · 띠 두께 0.024 → 0.04, 젤리 흡수·산란 곡선(JELLY_*), 겉면 반사 약하게
//  · 숫자: 101장 텍스처 배열 대신 지금 숫자 한 장, 자리 x 0.72 → 0.76·글자 크기는 영상대로
//  · 화면 창(uView)으로 광선을 만든다 — 캔버스 크기와 상관없이 영상과 같은 구도
//  · uLayers: 견본 패널에서 부품(젤리·그림자·빛 모임·반사광·숫자)을 하나씩 끄고 켜 보려고
//  · smoothstep: GLSL은 edge0 > edge1이 정의돼 있지 않아 WGSL과 같은 식(sstep)으로 직접 쓴다

/** 전체 화면 삼각형 하나 — 모든 패스가 같이 쓴다 */
export const FULLSCREEN_VS = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

/**
 * 줄(점 17개 · 이차 베지어 16개)까지의 거리장을 256×128 텍스처에 굽는다.
 * r = 곡선까지 거리, g = 가장 가까운 자리의 진행도(0 = 왼쪽 고정점, 1 = 손잡이), ba = 거리의 기울기(법선).
 */
export const BEZIER_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uPts[17];
uniform vec2 uCtl[16];
uniform vec4 uBBox; // left, right, bottom, top
out vec4 outColor;

float dot2(vec2 v) { return dot(v, v); }

// Inigo Quilez의 이차 베지어 거리(sdBezier) — A, 조절점 B, C
float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
  vec2 a = B - A;
  vec2 b = A - B * 2.0 + C;
  vec2 c = a * 2.0;
  vec2 d = A - pos;
  float kk = 1.0 / max(dot(b, b), 0.0001);
  float kx = kk * dot(a, b);
  float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
  float kz = kk * dot(d, a);
  float res;
  float p = ky - kx * kx;
  float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
  float h = q * q + 4.0 * p * p * p;
  if (h >= 0.0) {
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - q) * 0.5;
    vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
    res = dot2(d + (c + b * t) * t);
  } else {
    float z = sqrt(-p);
    float v = acos(clamp(q / (p * z * 2.0), -1.0, 1.0)) / 3.0;
    float m = cos(v);
    float n = sin(v) * 1.732050808;
    vec3 t = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
    res = min(dot2(d + (c + b * t.x) * t.x), dot2(d + (c + b * t.y) * t.y));
  }
  return sqrt(res);
}

void main() {
  vec2 uv = gl_FragCoord.xy / vec2(256.0, 128.0);
  vec2 sp = vec2(uBBox.x + uv.x * (uBBox.y - uBBox.x), uBBox.w - uv.y * (uBBox.w - uBBox.z));
  float minDist = 1e10;
  int closestSeg = 0;
  float closestT = 0.0;
  const float eps = 0.03;
  float xp = 1e10, xm = 1e10, yp = 1e10, ym = 1e10;
  for (int i = 0; i < 16; i++) {
    vec2 A = uPts[i];
    vec2 B = uPts[i + 1];
    vec2 C = uCtl[i];
    float dist = sdBezier(sp, A, C, B);
    if (dist < minDist) {
      minDist = dist;
      closestSeg = i;
      vec2 AB = B - A;
      float len = length(AB);
      closestT = len > 0.0 ? clamp(dot(sp - A, AB) / (len * len), 0.0, 1.0) : 0.0;
    }
    xp = min(xp, sdBezier(sp + vec2(eps, 0.0), A, C, B));
    xm = min(xm, sdBezier(sp - vec2(eps, 0.0), A, C, B));
    yp = min(yp, sdBezier(sp + vec2(0.0, eps), A, C, B));
    ym = min(ym, sdBezier(sp - vec2(0.0, eps), A, C, B));
  }
  float progress = (float(closestSeg) + closestT) / 16.0;
  outColor = vec4(minDist, progress, (xp - xm) / (2.0 * eps), (yp - ym) / (2.0 * eps));
}
`

/** 장면 레이마칭 — 바닥판·홈·젤리·그림자·빛 모임·숫자. a에는 숫자 자리(TAA를 덜 섞을 곳)를 적는다. */
export const SCENE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uBezier;
uniform sampler2D uDigits;
uniform vec4 uEndCap;      // 끝에서 두 번째 점 xy, 마지막 점 xy
uniform vec4 uBBox;        // 줄 거리장 범위: left, right, bottom, top
uniform vec3 uJellyColor;
uniform vec3 uLightDir;    // 빛이 나아가는 방향(정규화)
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform float uTanHalf;    // tan(시야각/2)
uniform vec4 uView;        // 화면 창: 왼쪽, 아래, 오른쪽, 위(tan 단위)
uniform vec2 uJitter;      // TAA 흔들기(tan 단위)
uniform vec2 uResolution;
uniform vec4 uLayers;      // x 젤리, y 젤리 그림자, z 빛 모임(홈 바닥), w 젤리 반사광
uniform float uDigitsOn;
out vec4 outColor;

const int MAX_STEPS = 64;
const float MAX_DIST = 10.0;
const float SURF_DIST = 0.001;
const float AMBIENT = 0.36;           // AMBIENT_COLOR 0.6 × AMBIENT_INTENSITY 0.6
const float SPECULAR_POWER = 10.0;
const float SPECULAR_INTENSITY = 0.6;
const float JELLY_IOR = 1.42;
// 영상에 맞춘 젤리 재질: 흡수는 진행도^2.2 × 0.16(원본 ^2 × 0.08), 산란은 세기 1.5 · 진행도^2.5
// (원본 3 · ^3), 겉면 반사는 약하게 — 솟은 혹(진행도 0.3~0.5)은 옅은 살구색, 손잡이 쪽은 짙은 주황
const vec2 JELLY_ABSORB = vec2(2.2, 0.16);
const float JELLY_SCATTER_POW = 2.5;
const vec2 JELLY_REFLECT = vec2(0.5, 0.12);
const int AO_STEPS = 3;
const float AO_RADIUS = 0.1;
const float AO_INTENSITY = 0.5;
const float AO_BIAS = SURF_DIST * 5.0;
// 띠 두께의 반 — 원본 0.024보다 두껍게: 영상에서 끝까지 끈 젤리(F53)가 홈 깊이를 다 채우고 테두리 위로 보인다
const float LINE_RADIUS = 0.04;
const float LINE_HALF_THICK = 0.17;
const float GROUND_THICKNESS = 0.03;
const float GROUND_ROUNDNESS = 0.02;
const vec3 LIGHT_COLOR = vec3(1.0);
// 영상 판 밝기 맞춤(판 357곳을 재서 원본 조명식에 맞춘 값): 은은한 반사광은 거의 수평으로 뒤에서
// 오는 빛(높이 10°, 오른쪽으로 12°)의 넓은 하이라이트(10제곱)이고, 1에서 자르지 않는다. 판은 살짝
// 보랏빛 회색(초록 -1.5%, 파랑 +3%). 빛·그림자 방향은 원본 조명(uLightDir) 그대로.
const vec3 SHEEN_DIR = vec3(0.205, -0.174, 0.963);
const float SHEEN_GAIN = 1.117;
const float DIFFUSE_GAIN = 0.669;
const vec3 PLATE_TINT = vec3(1.0, 0.985, 1.03);

float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat(vec3 x) { return clamp(x, 0.0, 1.0); }
// WGSL smoothstep — edge0 > edge1이면 뒤집힌 곡선
float sstep(float e0, float e1, float x) {
  float t = sat((x - e0) / (e1 - e0));
  return t * t * (3.0 - 2.0 * t);
}

float sdRoundedBox2d(vec2 p, vec2 size, float r) {
  vec2 d = abs(p) - size + vec2(r);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
float opExtrudeY(vec3 p, float dd, float h) {
  vec2 w = vec2(dd, abs(p.y) - h);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}
float opExtrudeZ(vec3 p, float dd, float h) {
  vec2 w = vec2(dd, abs(p.z) - h);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}
float sdPie(vec2 p, vec2 sc, float r) {
  p.x = abs(p.x);
  float l = length(p) - r;
  float m = length(p - sc * clamp(dot(p, sc), 0.0, r));
  return max(l, m * sign(sc.y * p.x - sc.x * p.y));
}

// ── 바닥판(가운데에 둥근 홈이 뚫린 두께 0.06 판 + 홈 바닥) ──────────────────
float rectangleCutoutDist(vec2 p) {
  return sdRoundedBox2d(p, vec2(1.0 + GROUND_ROUNDNESS, 0.2 + GROUND_ROUNDNESS), 0.2 + GROUND_ROUNDNESS);
}
float mainSceneDist(vec3 p) {
  return min(p.y + 0.06, opExtrudeY(p, -rectangleCutoutDist(p.xz), GROUND_THICKNESS - GROUND_ROUNDNESS) - GROUND_ROUNDNESS);
}

// ── 젤리(줄을 z로 늘인 납작한 띠 + D 모양 끝) ───────────────────────────────
vec4 polyline(vec2 p) {
  vec2 uv = vec2((p.x - uBBox.x) / (uBBox.y - uBBox.x), (uBBox.w - p.y) / (uBBox.w - uBBox.z));
  return textureLod(uBezier, clamp(uv, 0.0, 1.0), 0.0);
}
float cap3D(vec3 p) {
  vec2 a = uEndCap.xy;
  vec2 b = uEndCap.zw;
  float ang = atan(b.y - a.y, b.x - a.x);
  float c = cos(ang);
  float s = sin(ang);
  vec3 q = p - vec3(a, 0.0);
  q = vec3(mat2(c, -s, s, c) * q.xy, q.z);
  return opExtrudeY(q, sdPie(q.zx, vec2(1.0, 0.0), LINE_HALF_THICK), 0.001) - LINE_RADIUS;
}
vec2 sliderSdf(vec3 p) {
  vec4 poly = polyline(p.xy);
  float d = poly.y > 0.94 ? cap3D(p) : opExtrudeZ(p, poly.x, LINE_HALF_THICK) - LINE_RADIUS;
  return vec2(d, poly.y);
}
float sliderApproxDist(vec3 p) {
  if (p.x < uBBox.x || p.x > uBBox.y || p.y < uBBox.z || p.y > uBBox.w) return 1e9;
  return opExtrudeZ(p, polyline(p.xy).x, LINE_HALF_THICK) - LINE_RADIUS;
}
float sceneDistForAO(vec3 p) {
  float m = mainSceneDist(p);
  return uLayers.x > 0.5 ? min(m, sliderApproxDist(p)) : m;
}

vec3 normalCap(vec3 p) {
  const vec3 k = vec3(1.0, -1.0, 0.0);
  const float e = 0.01;
  return normalize(
    k.xyy * cap3D(p + k.xyy * e) + k.yyx * cap3D(p + k.yyx * e) +
    k.yxy * cap3D(p + k.yxy * e) + k.xxx * cap3D(p + k.xxx * e)
  );
}
vec3 normalMain(vec3 p) {
  if (abs(p.z) > 0.22 || abs(p.x) > 1.02) return vec3(0.0, 1.0, 0.0);
  const vec3 k = vec3(1.0, -1.0, 0.0);
  const float e = 0.0001;
  return normalize(
    k.xyy * mainSceneDist(p + k.xyy * e) + k.yyx * mainSceneDist(p + k.yyx * e) +
    k.yxy * mainSceneDist(p + k.yxy * e) + k.xxx * mainSceneDist(p + k.xxx * e)
  );
}
// 띠의 법선 — 가운데는 곡선의 법선, z 가장자리로 갈수록 옆(±z)을 섞어 둥글게 보이게
vec3 sliderNormal(vec3 p, float t) {
  vec4 poly = polyline(p.xy);
  const float threshold = LINE_HALF_THICK * 0.85;
  float zDistance = max(0.0, (abs(p.z) - threshold) * LINE_HALF_THICK / (LINE_HALF_THICK - threshold));
  float edgeDistance = LINE_RADIUS - poly.x;
  const float edgeContrib = 0.9;
  const float zContrib = 0.1;
  vec3 zAxis = vec3(0.0, 0.0, sign(p.z));
  float edgeBlend = edgeContrib * LINE_RADIUS + zContrib * LINE_HALF_THICK;
  float blendFactor = sstep(edgeBlend, 0.0, zDistance * zContrib + edgeDistance * edgeContrib);
  vec3 n = normalize(mix(zAxis, vec3(poly.zw, 0.0), blendFactor * 0.5 + 0.5));
  if (t > 0.94) n = normalize(mix(n, normalCap(p), (t - 0.94) / 0.02));
  return n;
}

// ── 빛 ──────────────────────────────────────────────────────────────────────
// 가짜 그림자: 홈 바닥은 벽 그늘, 판 위는 줄 거리장을 빛 방향으로 눕혀 찍은 색 그림자
vec3 fakeShadow(vec3 p, vec3 lightDir) {
  if (p.y < -GROUND_THICKNESS) {
    float cutout = rectangleCutoutDist(p.xz) + 0.02;
    float edgeDarkening = sat(1.0 - cutout * 30.0);
    float lightGradient = sat(-p.z * 4.0 * lightDir.z + 1.0);
    return vec3(1.0) * edgeDarkening * (lightGradient * 0.5);
  }
  if (uLayers.y < 0.5) return vec3(1.0);
  vec2 uv = vec2(
    (p.x - p.z * lightDir.x * sign(lightDir.z)) * 0.5 + 0.5,
    1.0 - (-p.z / lightDir.z) * 0.5 - 0.2
  );
  vec4 data = textureLod(uBezier, uv, 0.0);
  // 줄이 뭉쳐 있을 때 진행도가 갑자기 바뀌지 않게 x 위치로 부드럽게 넘긴다(원본 주석 그대로)
  float jellySaturation = mix(0.0, data.y, sat(p.x * 1.5 + 1.1));
  vec3 shadowColor = mix(vec3(0.0), uJellyColor, jellySaturation);
  float contrast = 20.0 * sat(uv.y) * (0.8 + uEndCap.x * 0.2);
  float uvEdgeFeather = sat(uv.x * 10.0) * sat((1.0 - uv.x) * 10.0) * sat((1.0 - uv.y) * 10.0) * sat(uv.y);
  float influence = sat((1.0 - lightDir.y) * 2.0) * uvEdgeFeather;
  return mix(vec3(1.0), mix(shadowColor, vec3(1.0), sat(data.x * contrast - 0.3)), influence);
}

float calcAO(vec3 p, vec3 n) {
  float total = 0.0;
  float weight = 1.0;
  const float stepDist = AO_RADIUS / float(AO_STEPS);
  for (int i = 1; i <= AO_STEPS; i++) {
    float h = stepDist * float(i);
    float d = sceneDistForAO(p + n * h) - AO_BIAS;
    total += max(0.0, h - d) * weight;
    weight *= 0.5;
    if (total > AO_RADIUS / AO_INTENSITY) break;
  }
  return sat(1.0 - AO_INTENSITY * total / AO_RADIUS);
}

vec3 lighting(vec3 p, vec3 n, vec3 ro) {
  vec3 lightDir = -uLightDir;
  vec3 shadow = fakeShadow(p, lightDir);
  float diffuse = max(dot(n, lightDir), 0.0);
  vec3 viewDir = normalize(ro - p);
  float sheen = pow(max(dot(viewDir, reflect(normalize(SHEEN_DIR), n)), 0.0), SPECULAR_POWER);
  vec3 base = vec3(0.9);
  vec3 directional = base * LIGHT_COLOR * diffuse * DIFFUSE_GAIN / 0.9 * shadow;
  vec3 ambient = base * AMBIENT;
  return (directional + ambient + LIGHT_COLOR * (sheen * SHEEN_GAIN) * shadow) * PLATE_TINT;
}

// 홈 바닥에 새긴 숫자(가로 0.38 × 세로 0.33, 가운데 x = 0.76 — 원본 0.72보다 영상 쪽이 오른쪽)
float digitsAt(vec3 p) {
  if (uDigitsOn < 0.5) return 0.0;
  vec2 local = vec2(p.x - 0.76, p.z);
  if (abs(local.x) > 0.19 || abs(local.y) > 0.165) return 0.0;
  return textureLod(uDigits, vec2((local.x + 0.19) / 0.38, (local.y + 0.165) / 0.33), 0.0).r;
}

vec3 background(vec3 ro, vec3 rd, float dist) {
  vec3 p = ro + rd * dist;
  float text = digitsAt(p);
  float endCapX = uEndCap.x;

  // 빛 모임 — 젤리가 높이 솟은 자리 아래 홈 바닥이 밝아진다
  float highlights = 0.0;
  float offsetX = -uLightDir.x * 0.2;
  float offsetZ = 0.05 + uLightDir.z * 0.2;
  if (uLayers.z > 0.5 && abs(p.x + offsetX) < 1.0 && abs(p.z + offsetZ) < 0.2) {
    float uvX = (p.x + offsetX + 2.0) * 0.5;
    float uvZ = ((p.z + offsetZ + 0.4) / 0.2) * 0.5;
    vec2 cuv = vec2(uvX - 0.5, uvZ - 0.5);
    float edge = abs(cuv.y - 0.5) * 2.0;
    vec2 fuv = vec2(cuv.x, 1.0 - edge * edge * 0.3);
    float density = max(0.0, (textureLod(uBezier, fuv, 0.0).x - 0.25) * 8.0);
    float fadeX = sstep(0.0, -0.2, p.x - endCapX);
    float fadeZ = 1.0 - edge * edge * edge;
    float fadeStretch = sat(1.0 - (endCapX + 1.0) * 0.5);
    float edgeFade = sat(fadeX) * sat(fadeZ) * fadeStretch;
    highlights = density * density * density * edgeFade * 3.0 * (1.0 + uLightDir.z) / 1.5;
  }

  vec3 n = normalMain(p);
  vec3 toCap = p - vec3(endCapX, 0.0, 0.0);
  float sqDist = dot(toCap, toCap);
  // 젤리 반사광 — 손잡이 둘레 바닥·홈 벽이 주황으로 물든다
  vec3 bounce = uLayers.w * uJellyColor * ((1.0 / (sqDist * 15.0 + 1.0)) * 0.4);
  vec3 sideBounce = uLayers.w * uJellyColor * ((1.0 / (sqDist * 40.0 + 1.0)) * 0.3) * abs(n.z);

  vec3 lit = lighting(p, n, ro);
  vec3 bg = lit * calcAO(p, n) + bounce + sideBounce;
  return mix(bg, sat(bg * 0.5), text) * (1.0 + highlights);
}

vec3 marchNoJelly(vec3 ro, vec3 rd) {
  float dist = 0.0;
  for (int i = 0; i < 6; i++) {
    float h = mainSceneDist(ro + rd * dist);
    dist += h;
    if (dist > MAX_DIST || h < SURF_DIST * 10.0) break;
  }
  return dist < MAX_DIST ? background(ro, rd, dist) : vec3(0.0);
}

float fresnelSchlick(float cosTheta, float ior1, float ior2) {
  // pow(음수, 2)는 GLSL에서 정의되지 않아 곱으로 쓴다
  float r = (ior1 - ior2) / (ior1 + ior2);
  float r0 = r * r;
  return r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
}

vec3 rayMarch(vec3 ro, vec3 rd) {
  float bgDist = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    float h = mainSceneDist(ro + rd * bgDist);
    bgDist += h;
    if (h < SURF_DIST) break;
  }
  vec3 bg = background(ro, rd, bgDist);
  if (uLayers.x < 0.5) return bg;

  vec3 bmin = vec3(uBBox.x, uBBox.z, -0.25);
  vec3 bmax = vec3(uBBox.y, uBBox.w, 0.25);
  vec3 inv = 1.0 / rd;
  vec3 t1 = (bmin - ro) * inv;
  vec3 t2 = (bmax - ro) * inv;
  vec3 tn = min(t1, t2);
  vec3 tf = max(t1, t2);
  float tMin = max(max(tn.x, tn.y), tn.z);
  float tMax = min(min(tf.x, tf.y), tf.z);
  if (!(tMax >= tMin && tMax >= 0.0)) return bg;

  float dist = max(0.0, tMin);
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * dist;
    float m = mainSceneDist(p);
    vec2 s = sliderSdf(p);
    bool isSlider = s.x < m;
    float d = isSlider ? s.x : m;
    dist += d;
    if (d < SURF_DIST) {
      if (!isSlider) break;
      vec3 hp = ro + rd * dist;
      float t = s.y;
      vec3 N = t < 0.96 ? sliderNormal(hp, t) : normalCap(hp);
      float cosi = sat(dot(-rd, N));
      float F = fresnelSchlick(cosi, 1.0, JELLY_IOR);
      // 겉면 반사 — 원본(높이 + 0.2)은 솟은 혹 위가 하얗게 번쩍여서 영상보다 절반쯤 약하게
      vec3 reflection = sat(vec3(hp.y * JELLY_REFLECT.x + JELLY_REFLECT.y));
      const float eta = 1.0 / JELLY_IOR;
      float k = 1.0 - eta * eta * (1.0 - cosi * cosi);
      vec3 refracted = vec3(0.0);
      if (k > 0.0) {
        vec3 refrDir = normalize(rd * eta + N * (eta * cosi - sqrt(k)));
        vec3 exitPos = hp + refrDir * (SURF_DIST * 4.0);
        vec3 env = marchNoJelly(exitPos, refrDir);
        vec3 absorb = (1.0 - uJellyColor) * 20.0;
        vec3 T = exp(-(absorb * pow(t, JELLY_ABSORB.x)) * JELLY_ABSORB.y);
        // 뒤에서 낮게 드는 빛이 젤리를 지나며 주황으로 번진다 — 홈 안(벽 그늘)은 절반 남짓만
        float forward = max(0.0, dot(-normalize(SHEEN_DIR), refrDir));
        float lit = mix(0.55, 1.0, sstep(-0.03, 0.09, hp.y));
        vec3 scatter = uJellyColor * 1.5 * (1.5 * forward * pow(t, JELLY_SCATTER_POW) * lit);
        refracted = env * T + scatter;
      }
      return mix(refracted, reflection, F);
    }
    if (dist > bgDist) break;
  }
  return bg;
}

// 숫자 자리 — TAA가 지난 프레임을 덜 섞어(0.7) 바뀌는 숫자가 덜 번지게(원본 taa.ts의 글자 구역)
float textRegion(vec3 ro, vec3 rd) {
  float t = (0.0 - ro.y) / rd.y;
  vec3 p = ro + rd * t;
  return sstep(0.23, 0.19, abs(p.x - 0.76)) * sstep(0.2, 0.165, abs(p.z));
}

void main() {
  vec2 f = gl_FragCoord.xy / uResolution;
  vec2 s = mix(uView.xy, uView.zw, f) - uJitter;
  vec3 rd = normalize(uCamForward + uCamRight * (s.x * uTanHalf) + uCamUp * (s.y * uTanHalf));
  vec3 color = rayMarch(uCamPos, rd);
  // 쌍곡탄젠트 톤매핑(원본 그대로)
  outColor = vec4(tanh(color * 1.3), textRegion(uCamPos, rd));
}
`

/** TAA — 지난 결과를 둘레 3×3 범위로 자른 뒤 90%(숫자 자리 70%) 섞는다 */
export const TAA_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uHistory;
uniform float uHasHistory;
out vec4 outColor;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  ivec2 dim = textureSize(uCurrent, 0);
  vec4 cur = texelFetch(uCurrent, c, 0);
  if (uHasHistory < 0.5) {
    outColor = vec4(cur.rgb, 1.0);
    return;
  }
  vec3 hist = texelFetch(uHistory, c, 0).rgb;
  vec3 mn = vec3(9999.0);
  vec3 mx = vec3(-9999.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec3 n = texelFetch(uCurrent, clamp(c + ivec2(x, y), ivec2(0), dim - 1), 0).rgb;
      mn = min(mn, n);
      mx = max(mx, n);
    }
  }
  float blend = mix(0.9, 0.7, cur.a);
  outColor = vec4(mix(cur.rgb, clamp(hist, mn, mx), blend), 1.0);
}
`

/** 결과를 캔버스 크기로 늘려 그린다(선형 보간) */
export const BLIT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uSize;
out vec4 outColor;
void main() {
  outColor = vec4(texture(uTex, gl_FragCoord.xy / uSize).rgb, 1.0);
}
`
