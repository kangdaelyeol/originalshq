// 젤리 슬라이더 셰이더(WebGL2 · GLSL ES 3.00).
// 뼈대는 TypeGPU 예제 "Jelly Slider"(Copyright (c) 2025 Software Mansion, MIT License —
// github.com/software-mansion/TypeGPU, apps/typegpu-docs/src/examples/rendering/jelly-slider)의 WGSL
// 레이마칭을 옮긴 것이다(판·홈 SDF, 줄 거리장, 가짜 색 그림자, AO, TAA). 영상(sample/design4.mp4)은
// 그 예제가 따라 만든 원작 쪽이라, 영상을 재서 다음을 바꿨다:
//  · 카메라 높이각 54.9° → 50°(jelly-camera.ts), 판 은은한 반사광·보랏빛(SHEEN_*, PLATE_TINT)·왼쪽 아래 어둠
//  · 띠 두께 0.024 → 0.04, 폭 0.17 → 0.125(둥근 끝 D도 같이)
//  · 젤리 재질(uMatA~J, 값은 jelly-renderer.ts JELLY_MATERIAL): 젤리를 뺀 장면을 먼저 밉맵 텍스처(uBg)로
//    그려 두고, 젤리 너머(굴절)·겉면에 비친 판과 홈(반사)을 화면에서 읽는다 — 원본처럼 광선마다 장면을
//    다시 행진하면 젖빛 흐림을 낼 수 없고 반사는 높이에 비례한 회색이라 혹 위가 하얗게 덮였다.
//    젤리 속을 실제로 지난 거리로 흡수, 나갈 때 한 번 더 꺾는 얇은 판 굴절, 고정점에서의 거리로 정하는 색,
//    뿌연 우윳빛, 뒤에서 드는 빛 번짐(F53 노란 속), 둥근 끝의 빛나는 테, 가장자리 선, 날카로운 반짝임,
//    고정점 가까이는 보이지 않게
//  · 빛 모임: 젤리가 조금만 떠도 그 아래 홈 바닥이 하얗게 밝다(더하는 빛)
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

// Inigo Quilez의 이차 베지어 거리(sdBezier) — A, 조절점 B, C. x = 거리, y = 가장 가까운 점의 곡선 매개변수
// (원본은 진행도를 구간 현(A→C)에 내린 그림자로 셈해, 가까운 구간이 바뀌는 자리에서 값이 튀었다 —
// 진행도로 정하는 색·사라짐이 계단처럼 보였다)
vec2 sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
  vec2 a = B - A;
  vec2 b = A - B * 2.0 + C;
  vec2 c = a * 2.0;
  vec2 d = A - pos;
  float kk = 1.0 / max(dot(b, b), 0.0001);
  float kx = kk * dot(a, b);
  float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
  float kz = kk * dot(d, a);
  float res;
  float tt;
  float p = ky - kx * kx;
  float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
  float h = q * q + 4.0 * p * p * p;
  if (h >= 0.0) {
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - q) * 0.5;
    vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    tt = clamp(uv.x + uv.y - kx, 0.0, 1.0);
    res = dot2(d + (c + b * tt) * tt);
  } else {
    float z = sqrt(-p);
    float v = acos(clamp(q / (p * z * 2.0), -1.0, 1.0)) / 3.0;
    float m = cos(v);
    float n = sin(v) * 1.732050808;
    vec3 t = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
    float r1 = dot2(d + (c + b * t.x) * t.x);
    float r2 = dot2(d + (c + b * t.y) * t.y);
    res = min(r1, r2);
    tt = r1 < r2 ? t.x : t.y;
  }
  return vec2(sqrt(res), tt);
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
    vec2 hit = sdBezier(sp, A, C, B);
    if (hit.x < minDist) {
      minDist = hit.x;
      closestSeg = i;
      closestT = hit.y;
    }
    xp = min(xp, sdBezier(sp + vec2(eps, 0.0), A, C, B).x);
    xm = min(xm, sdBezier(sp - vec2(eps, 0.0), A, C, B).x);
    yp = min(yp, sdBezier(sp + vec2(0.0, eps), A, C, B).x);
    ym = min(ym, sdBezier(sp - vec2(0.0, eps), A, C, B).x);
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
uniform float uAnchorX;    // 줄 고정점 x
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
// 젤리 재질(영상에 맞춘 값은 jelly-renderer.ts JELLY_MATERIAL):
//  uMatA = 흡수 계수 RGB(젤리 속 거리 1당)
//  uMatB = 빛 번짐(산란) 세기, 꺾는 굴절률(0이면 1.42)
//  uMatC = 빛 모임 세기, 빛 모임이 시작·다 차는 뜬 높이, 고정점 쪽 최소 색
//  uMatD = 색이 짙어지기 시작·다 짙어지는 거리(고정점에서 줄을 따라), 뒤에서 든 빛이 젤리 속을 지나는 길이
//          — 영상은 줄이 늘고 줄어도
//          색이 바뀌는 자리가 고정점에서 거의 같은 거리(주황 0.8~1.0, 짙은 빨강 1.15~1.25)다
uniform vec4 uMatA;
uniform vec4 uMatB;
uniform vec4 uMatC;
uniform vec4 uMatD;
uniform vec4 uMatE;        // 빛 번짐이 켜지기 시작·다 켜지는 높이(젤리 겉면 y), 빛 번짐이 시작·다 차는 거리(고정점에서)
uniform vec4 uMatF;        // 뿌연 정도(0 맑음 ~ 1 우윳빛), 뿌연 빛의 밝기
uniform vec4 uMatG;        // 날카로운 반짝임 세기·지수, 가장자리 빛 세기·지수
uniform vec4 uMatH;        // 옅은 쪽 바탕 흡수 RGB(살구·분홍 빛), 겉면 반사 세기
uniform vec4 uMatI;        // 위로 튄 반사가 비치는 촬영장 빛: 수평 쪽 밝기, 위쪽 밝기, (z 안 씀), 짙은 쪽 반사 비율
uniform vec4 uMatJ;        // 빛 번짐 색을 정하는 흡수 RGB(몸통 흡수보다 노랗게), 빛 번짐이 사라지는 높이
uniform sampler2D uBg;     // 젤리를 뺀 장면(선형 색, 밉맵) — 젤리 너머를 흐림 정도만큼 읽는다
uniform float uFrost;      // 젖빛 — 젤리 너머를 읽는 밉맵 단계
uniform vec3 uKeyDir;      // 날카로운 반짝임을 만드는 촬영장 등 방향(젤리에서 등 쪽)
uniform vec2 uOutline;     // 가장자리 선 — 세기, 폭(겉면과 시선이 이루는 코사인)
uniform float uRopeLen;
const int AO_STEPS = 3;
const float AO_RADIUS = 0.1;
const float AO_INTENSITY = 0.5;
const float AO_BIAS = SURF_DIST * 5.0;
// 띠 두께의 반 — 원본 0.024보다 두껍게: 영상에서 끝까지 끈 젤리(F53)가 홈 깊이를 다 채우고 테두리 위로 보인다
const float LINE_RADIUS = 0.04;
// 띠 폭의 반(둥글린 0.04 빼고) — 원본 0.17. 영상에서 끝까지 끈 띠(F50~F56)가 홈보다 좁아 앞쪽 바닥이
// 보이고, 위·아래 가장자리 사이가 66~70px라 전체 반폭 0.165로 맞췄다. 둥근 끝(D)도 같이 작아진다.
const float LINE_HALF_THICK = 0.125;
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
    // 홈 바닥: 먼 쪽 벽 그늘 — 원본보다 좁고 옅게(영상 빈 바닥: 벽 바로 앞 128, 가운데 160)
    float cutout = rectangleCutoutDist(p.xz) + 0.02;
    float edgeDarkening = sat(1.0 - cutout * 45.0);
    float lightGradient = sat(-p.z * 2.2 * lightDir.z + 1.0);
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
  // 영상의 젤리 그림자 줄기는 원본보다 옅다(판 아래쪽 비교: 영상이 5~20 밝음)
  float influence = sat((1.0 - lightDir.y) * 2.0) * uvEdgeFeather * 0.75;
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

  // 빛 모임 — 젤리가 바닥에서 떠 있는 곳 아래 홈 바닥이 하얗게 밝아진다(영상: 들린 띠 아래 230~240,
  // 다른 홈 바닥은 160 안팎). 원본은 높이 솟은 혹 아래만, 끝까지 끌면 사라졌는데 영상은 조금만 떠도
  // 밝다 — 이 밝은 바닥이 주황 젤리를 지나 보여서 들린 띠 가운데가 노랗게 빛난다.
  float highlights = 0.0;
  if (uLayers.z > 0.5 && p.y < -0.045 && abs(p.z) < 0.2) {
    vec2 fuv = vec2((p.x - uBBox.x) / (uBBox.y - uBBox.x), (uBBox.w + 0.06) / (uBBox.w - uBBox.z));
    float d = textureLod(uBezier, clamp(fuv, 0.0, 1.0), 0.0).x;
    float lift = sstep(uMatC.y, uMatC.z, d);
    // 손잡이(D) 아래는 밝히지 않는다 — 영상의 둥근 끝은 홈 바닥 위에서 짙은 빨강이다
    float under = sstep(uAnchorX + 0.02, uAnchorX + 0.12, p.x) * sstep(endCapX + 0.04, endCapX - 0.06, p.x);
    float fadeZ = 1.0 - pow(abs(p.z) / 0.2, 8.0);
    highlights = uMatC.x * lift * under * fadeZ;
  }

  vec3 n = normalMain(p);
  vec3 toCap = p - vec3(endCapX, 0.0, 0.0);
  float sqDist = dot(toCap, toCap);
  // 젤리 반사광 — 손잡이 둘레 바닥·홈 벽이 주황으로 물든다
  vec3 bounce = uLayers.w * uJellyColor * ((1.0 / (sqDist * 15.0 + 1.0)) * 0.4);
  vec3 sideBounce = uLayers.w * uJellyColor * ((1.0 / (sqDist * 40.0 + 1.0)) * 0.3) * abs(n.z);

  vec3 lit = lighting(p, n, ro);
  vec3 bg = lit * calcAO(p, n) + bounce + sideBounce;
  // 판 왼쪽 아래 모서리가 영상에서 더 어둡다(모서리 127 · 우리 163 → 선형 0.77배) — 판 위
  // (-1.4, 1.2) 둘레 반지름 0.4의 부드러운 어둠으로 맞췄다(가로로 넓은 무대에서도 판을 따라간다)
  vec2 corner = (p.xz - vec2(-1.4, 1.2)) / 0.4;
  bg *= 1.0 - 0.5 * exp(-dot(corner, corner));
  // 빛 모임은 더하는 빛(곱하면 먼 벽 그늘 쪽 바닥이 계속 어둡다) — 영상의 젤리 아래 바닥은 흰빛(229,227,232)
  return mix(bg, sat(bg * 0.5), text) + highlights * vec3(0.95, 0.94, 0.97);
}

// 젤리 너머 — 그 방향으로 가 닿는 점(판·홈)을 찾아 화면에 투영하고, 젤리를 뺀 장면(uBg)을 밉맵 단계
// lod만큼 흐리게 읽는다(젖빛 유리). 원본은 6걸음만 가서 높이 솟은 혹 너머 바닥에 닿지 못해 32걸음까지.
// 장면 밖으로 빠진 빛(위로 튄 것)은 검정 대신 밝은 촬영장 빛.
vec3 envAt(vec3 ro, vec3 rd, float lod) {
  float dist = 0.0;
  for (int i = 0; i < 32; i++) {
    float h = mainSceneDist(ro + rd * dist);
    dist += h;
    if (dist > MAX_DIST || h < SURF_DIST * 10.0) break;
  }
  if (!(dist < MAX_DIST && rd.y < 0.2)) return vec3(0.8, 0.79, 0.81);
  vec3 v = ro + rd * dist - uCamPos;
  float z = dot(v, uCamForward);
  vec2 sp = vec2(dot(v, uCamRight), dot(v, uCamUp)) / (z * uTanHalf) + uJitter;
  vec2 uv = (sp - uView.xy) / (uView.zw - uView.xy);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return background(ro, rd, dist);
  return textureLod(uBg, uv, lod).rgb;
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
  // 젤리 뒤 장면은 앞 패스(배경)가 이미 그렸다 — 같은 픽셀을 그대로 읽는다
  vec3 bg = texelFetch(uBg, ivec2(gl_FragCoord.xy), 0).rgb;
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
      // 반사(프레넬)는 젤리 굴절률 1.42 그대로, 꺾임은 uMatB.y로 — 영상의 옅은 쪽은 뒤가 부드럽게 비치는
      // 맑은 유리라 1.42로 다 꺾으면 두꺼운 수정처럼 무늬가 생긴다
      float ior = uMatB.y > 0.5 ? uMatB.y : JELLY_IOR;
      float F = fresnelSchlick(cosi, 1.0, JELLY_IOR);
      // 겉면 반사 — 반사된 방향으로 실제 장면(판·홈)을, 위로 튄 것은 밝은 촬영장 빛을 본다. 젤리 가장자리처럼
      // 면이 비스듬히 돌아가는 곳만 프레넬로 밝아져 영상의 가는 반짝임 줄이 된다(원본의 높이에 비례한
      // 회색 반사는 혹 위 전체를 하얗게 덮어서 버렸다).
      // 위·아래 사이는 부드럽게 섞는다(가르면 면이 기울다 넘어가는 자리에 하얀 세로 띠가 선다)
      vec3 reflDir = reflect(rd, N);
      float skyW = sstep(-0.3, 0.05, reflDir.y);
      vec3 reflection = vec3(mix(uMatI.x, uMatI.y, sstep(-0.1, 0.7, reflDir.y)));
      if (skyW < 1.0) reflection = mix(envAt(hp + reflDir * (SURF_DIST * 4.0), reflDir, 0.0), reflection, skyW);
      float eta = 1.0 / ior;
      float k = 1.0 - eta * eta * (1.0 - cosi * cosi);
      vec3 refracted = vec3(0.0);
      float g = mix(uMatC.w, 1.0, sstep(uMatD.x, uMatD.y, t * uRopeLen));
      vec3 glowTint = exp(-uMatJ.rgb * uMatD.z * g);
      if (k > 0.0) {
        vec3 refrDir = normalize(rd * eta + N * (eta * cosi - sqrt(k)));
        // 젤리 속을 지나는 거리 — 안에서 거리장만큼씩 나아가 밖으로 나올 때까지(원본은 늘 0.08로 셈).
        // 비스듬히 선 다리·내려오는 쪽은 길게 지나 짙어지고, 위를 향한 면은 짧게 지나 옅다.
        vec3 q = hp + refrDir * (SURF_DIST * 4.0);
        float path = 0.0;
        for (int j = 0; j < 14; j++) {
          float dIn = sliderSdf(q).x;
          if (dIn > 0.0) break;
          float stepLen = max(-dIn, 0.004);
          q += refrDir * stepLen;
          path += stepLen;
        }
        // 나가는 면에서 다시 꺾인다(원본은 들어갈 때만 꺾어 한 면짜리 렌즈처럼 크게 휘었다) — 얇은 띠라
        // 평평한 곳은 거의 곧게 지나 뒤가 그대로 비치고, 굽은 곳만 렌즈처럼 일그러진다. 나가는 면의 법선은
        // 들어올 때와 같은 매끈한 법선(줄 거리장 기울기)으로 — 거리장 칸(0.009)보다 좁은 차분은 칸마다
        // 꺾여 세로 줄무늬가 생겼다. 전반사면 안쪽 방향 그대로.
        vec3 nOut = sliderNormal(q, sliderSdf(q).y);
        vec3 outDir = refract(refrDir, -nOut, ior);
        if (dot(outDir, outDir) < 0.5) outDir = refrDir;
        // 젖빛 — 젤리 너머는 흐리게 읽는다(uFrost 밉맵 단계). 영상의 옅은 쪽은 뒤가 비치되 매끈하다 —
        // 그대로 읽으면 굽은 다리 속에 홈 끝·테두리가 렌즈 무늬로 선다.
        vec3 env = envAt(q + outDir * (SURF_DIST * 4.0), outDir, uFrost);
        vec3 T = exp(-(uMatA.rgb * g + uMatH.rgb) * path);
        // 뒤에서 낮게 드는 빛이 젤리를 지나 나온다 — 흰빛이 젤리 속(길이 uMatD.z)에서 같은 흡수를 받아
        // 덜 짙은 곳은 노랗게, 짙은 곳은 빨갛게. 홈 테두리 위로 뜬 곳만(홈 안은 벽 그늘이라 짙은 빨강 그대로)
        float forward = max(0.0, dot(-normalize(SHEEN_DIR), refrDir));
        // 홈 테두리 위로 뜬 곳에서 노랗게·주황으로(영상 F48~F57 띠의 마루, F66 혹의 어깨) — 높이 솟은 혹
        // 꼭대기(uMatJ.w 위)는 옅은 살구빛 그대로
        float lit = sstep(uMatE.x, uMatE.y, hp.y) * (1.0 - sstep(uMatJ.w, uMatJ.w + 0.12, hp.y));
        float glow = sstep(uMatE.z, uMatE.w, t * uRopeLen);
        vec3 scatter = vec3(uMatB.x * forward * lit * glow) * glowTint;
        // 젤리 속에서 퍼진 빛(뿌연 정도)
        vec3 milk = vec3(uMatF.y) * T;
        refracted = mix(env * T, milk, uMatF.x) + scatter;
      }
      // 가장자리 빛 — 둥근 끝(D)·띠 가장자리로 굴절해 들어온 빛이 젤리 색으로 테를 두른다
      float colored = sstep(uMatD.x, uMatD.y, t * uRopeLen);
      refracted += uMatG.z * pow(1.0 - cosi, uMatG.w) * colored * glowTint;
      // 짙은 쪽은 반사를 덜 — 둥근 끝 가장자리가 어두운 홈을 비춰 검은 테가 서지 않게(영상은 빛나는 테)
      float colorAmount = sstep(uMatD.x, uMatD.y, t * uRopeLen);
      vec3 jelly = mix(refracted, reflection, sat(F * uMatH.w * mix(1.0, uMatI.w, colorAmount)));
      // 가장자리 선 — 시선이 겉면을 스치는 테두리는 둘레의 어두운 것을 꺾어 비춰 가늘고 짙은 선이 된다
      // (영상의 혹·띠 윤곽이 또렷한 까닭 — 뿌연 젤리만으로는 윤곽이 바탕에 녹는다)
      jelly *= 1.0 - uOutline.x * (1.0 - sstep(0.0, uOutline.y, cosi));
      // 날카로운 반짝임 — 뒤 위쪽 빛이 매끈한 겉면에 맺히는 작은 점·선(지수가 커서 넓게 번지지 않는다)
      jelly += vec3(uMatG.x * pow(max(dot(reflDir, uKeyDir), 0.0), uMatG.y));
      // 고정점 가까이(줄을 따라 0.3까지)는 영상에서 젤리가 보이지 않는다 — 홈 끝이 깨끗한 어둠이다.
      // 그 자리는 젤리가 없는 것처럼 뒤를 곧게 보여 주고, 0.08~0.3 사이에서 젤리로 넘어간다.
      float vis = sstep(0.08, 0.3, t * uRopeLen);
      if (vis < 1.0) jelly = mix(bg, jelly, vis);
      return jelly;
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
#ifdef BG_PASS
  // 배경 패스 — 젤리 없이 판·홈만, 톤매핑 전 선형 색으로(본 패스가 젤리 너머를 흐려 읽는다)
  float dist = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    float h = mainSceneDist(uCamPos + rd * dist);
    dist += h;
    if (h < SURF_DIST) break;
  }
  outColor = vec4(background(uCamPos, rd, dist), textRegion(uCamPos, rd));
#else
  vec3 color = rayMarch(uCamPos, rd);
  // 쌍곡탄젠트 톤매핑(원본 그대로)
  outColor = vec4(tanh(color * 1.3), textRegion(uCamPos, rd));
#endif
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
