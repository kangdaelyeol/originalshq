import { useEffect, useMemo, useState, type RefObject } from 'react';
import { StyleSheet } from 'react-native';
import {
  BackdropBlur,
  BlurMask,
  Canvas,
  Circle,
  DashPathEffect,
  FractalNoise,
  Group,
  LinearGradient,
  Path,
  Picture,
  RadialGradient,
  Rect,
  RoundedRect,
  Skia,
  vec,
  type SkPath,
  type SkPicture,
} from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { cardPath, PIECE, PIECE_PATH, X_BOX, X_POLYGONS } from './shape';
import { alpha, C, mixHex, VEIL } from './theme';
import type { Choreography } from './use-login-choreography';

// 로그인 화면의 그림 층 — 웹 login-page·login-card·_login.scss를 Skia 한 판에 그린다. 바탕·오로라·막·입자·카드
// 유리(배경 흐림)·외곽선·흐르는 빛·모서리 조각·링·로고. 유리가 뒤의 입자를 흐리게 보려면 같은 판에 있어야 해서
// 카드 겉모습까지 여기서 그리고, 글자·입력칸(폼)은 RN 화면이 같은 자리 위에 얹는다.
//
// ⚠️ 배경 흐림(BackdropBlur)을 감싼 Group에는 opacity를 걸지 않는다 — 새 층이 생겨 그 안의 흐림이 뒤를 못 본다
// (웹 login-card.tsx 주석과 같은 이유). 나타나기·사라지기는 흐림 반경과 칠 불투명도로 대신한다.

export interface CardFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LoginSceneProps {
  width: number;
  height: number;
  /**
   * 입자 엔진이 매 프레임 새 그림을 넘길 곳 — 그림 상태는 이 판 안의 작은 부품(ParticlePicture)만 갖는다. 로그인
   * 화면 전체가 1초에 60번 다시 그려지면 입력칸이 포커스를 잃어 키보드가 바로 내려간다.
   */
  pictureSink: RefObject<((picture: SkPicture) => void) | null>;
  card: CardFrame | null;
  /** 키보드에 가리지 않게 화면(폼)을 올린 만큼 — 카드도 같이 올린다. */
  lift: SharedValue<number>;
  /** false면 카드를 숨긴다(입자 인트로 중) — true가 되는 순간 떠오른다. */
  revealed: boolean;
  choreo: Choreography;
  /** 카드 떠오르기(0 → 1) — 폼(RN)도 같은 값을 쓴다. */
  reveal: SharedValue<number>;
  reducedMotion: boolean;
}

/** CSS linear-gradient(각도)의 시작·끝점 — 상자 w×h 기준. */
function cssLinear(deg: number, w: number, h: number) {
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  return {
    start: vec(w / 2 - (dx * len) / 2, h / 2 - (dy * len) / 2),
    end: vec(w / 2 + (dx * len) / 2, h / 2 + (dy * len) / 2),
  };
}

const pathOf = (d: string): SkPath => Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();

const X_PATH = pathOf(X_POLYGONS.map(poly => `M${poly.map(([x, y]) => `${x} ${y}`).join(' L')} Z`).join(' '));
const PIECE_SK = { tl: pathOf(PIECE_PATH.tl), br: pathOf(PIECE_PATH.br) };
const CORNER_GLASS = cssLinear(135, PIECE, PIECE);

export function LoginScene({
  width,
  height,
  pictureSink,
  card,
  lift,
  revealed,
  choreo,
  reveal,
  reducedMotion,
}: LoginSceneProps) {
  // 오로라 — 16초에 걸쳐 살짝 옮겨 가며 커지고 돈다(왕복).
  const aura = useSharedValue(0);
  const veil = useSharedValue<number>(VEIL.intro);
  // 카드 겹마다 나타나는 때 — 유리 0.5초, 외곽선 0.2초 뒤 0.7초, 조각 0.35초 뒤 0.6초.
  const glassIn = useSharedValue(0);
  const rimIn = useSharedValue(0);
  const cornerIn = useSharedValue(0);
  const beam = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    aura.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.ease) }), -1, true);
    beam.value = withRepeat(withTiming(1, { duration: 6500, easing: Easing.linear }), -1, false);
  }, [aura, beam, reducedMotion]);

  useEffect(() => {
    if (!revealed) return;
    const d = (ms: number) => (reducedMotion ? 0 : ms);
    veil.value = withTiming(VEIL.rest, { duration: d(1200) });
    glassIn.value = withTiming(1, { duration: d(500) });
    rimIn.value = withDelay(d(200), withTiming(1, { duration: d(700) }));
    cornerIn.value = withDelay(d(350), withTiming(1, { duration: d(600) }));
  }, [revealed, reducedMotion, veil, glassIn, rimIn, cornerIn]);

  const auraTransform = useDerivedValue(() => {
    const t = aura.value;
    return [
      { translateX: width / 2 + width * 0.02 * t },
      { translateY: height / 2 - height * 0.02 * t },
      { scale: 1 + 0.06 * t },
      { rotate: (4 * Math.PI * t) / 180 },
      { translateX: -width / 2 },
      { translateY: -height / 2 },
    ];
  });

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} color={C.page} />
      <Group transform={auraTransform}>
        <AuraBlob box={{ w: width, h: height }} at={[0.4, 0.42]} r={[0.26, 0.3]} color={alpha(C.accent, 0.26)} />
        <AuraBlob box={{ w: width, h: height }} at={[0.62, 0.6]} r={[0.28, 0.32]} color="rgba(58, 154, 230, 0.22)" />
        <AuraBlob box={{ w: width, h: height }} at={[0.55, 0.35]} r={[0.18, 0.2]} color="rgba(255, 255, 255, 0.06)" />
      </Group>
      <Rect x={0} y={0} width={width} height={height} color={C.veil} opacity={veil} />
      <ParticlePicture sink={pictureSink} />
      {card && (
        <CardLayer
          card={card}
          lift={lift}
          choreo={choreo}
          reveal={reveal}
          glassIn={glassIn}
          rimIn={rimIn}
          cornerIn={cornerIn}
          beam={beam}
          reducedMotion={reducedMotion}
        />
      )}
    </Canvas>
  );
}

/** 입자 그림 — 엔진이 sink로 넘기는 그림을 받아 이 부품만 다시 그린다. */
function ParticlePicture({ sink }: { sink: RefObject<((picture: SkPicture) => void) | null> }) {
  const [picture, setPicture] = useState<SkPicture | null>(null);
  useEffect(() => {
    sink.current = setPicture;
    return () => {
      sink.current = null;
    };
  }, [sink]);
  return picture ? <Picture picture={picture} /> : null;
}

/** 오로라 한 덩이 — CSS radial-gradient(rx ry at x y, color, transparent 70%)를 타원으로. 오로라 상자는 화면보다
 * 사방 10% 크다(inset: -10%). */
function AuraBlob({
  box,
  at,
  r,
  color,
}: {
  box: { w: number; h: number };
  at: [number, number];
  r: [number, number];
  color: string;
}) {
  const bw = box.w * 1.2;
  const bh = box.h * 1.2;
  const cx = -box.w * 0.1 + bw * at[0];
  const cy = -box.h * 0.1 + bh * at[1];
  const rx = bw * r[0];
  const ry = bh * r[1];
  return (
    <Group transform={[{ translateX: cx }, { translateY: cy }, { scaleY: ry / rx }]}>
      <Circle cx={0} cy={0} r={rx * 0.7}>
        <RadialGradient c={vec(0, 0)} r={rx * 0.7} colors={[color, 'transparent']} />
        <BlurMask blur={12} style="normal" />
      </Circle>
    </Group>
  );
}

interface CardLayerProps {
  card: CardFrame;
  lift: SharedValue<number>;
  choreo: Choreography;
  reveal: SharedValue<number>;
  glassIn: SharedValue<number>;
  rimIn: SharedValue<number>;
  cornerIn: SharedValue<number>;
  beam: SharedValue<number>;
  reducedMotion: boolean;
}

function CardLayer({ card, lift, choreo, reveal, glassIn, rimIn, cornerIn, beam, reducedMotion }: CardLayerProps) {
  const { width: w, height: h } = card;
  const shape = useMemo(() => pathOf(cardPath(w, h)), [w, h]);
  const length = useMemo(() => {
    const it = Skia.ContourMeasureIter(shape, true, 1);
    return it.next()?.length() ?? 1;
  }, [shape]);
  const glass = cssLinear(140, w, h);
  const sheen = cssLinear(118, w, h);
  const cx = w / 2;
  const cy = h / 2;

  // 카드 전체 — 자리·흔들림·떠오르기(y 28 → 0, 0.97 → 1).
  const cardTransform = useDerivedValue(() => {
    const p = reveal.value;
    const s = 0.97 + 0.03 * p;
    return [
      { translateX: card.x + choreo.shakeX.value + cx },
      { translateY: card.y - lift.value + 28 * (1 - p) + cy },
      { scale: s },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });
  // 성공 뒤 사라지기 — 유리·외곽선·그림자는 1.04배로, 조각·로고는 1.6배로 커지며 사라진다.
  const leaveScale = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { scale: 1 + 0.04 * choreo.leave.value },
    { translateX: -cx },
    { translateY: -cy },
  ]);
  const glassAlpha = useDerivedValue(() => glassIn.value * (1 - choreo.leave.value));
  const glassBlur = useDerivedValue(() => 26 * glassAlpha.value);
  const rimAlpha = useDerivedValue(() => rimIn.value * (1 - choreo.leave.value));
  const beamPhase = useDerivedValue(() => length * (1 - beam.value));
  const beamPhaseAlt = useDerivedValue(() => length * (1 - ((beam.value + 0.5) % 1)));
  const beamAlpha = useDerivedValue(() => (reducedMotion ? 0 : rimAlpha.value));

  return (
    <Group transform={cardTransform}>
      {/* 그림자 — 카드 아래로 번지는 검은 그늘 */}
      <Group transform={leaveScale} opacity={glassAlpha}>
        <RoundedRect
          x={w * 0.06}
          y={h * 0.1 + 26}
          width={w * 0.88}
          height={h * 0.92}
          r={48}
          color="rgba(0, 0, 0, 0.78)"
        >
          <BlurMask blur={42} style="normal" />
        </RoundedRect>
      </Group>

      {/* 유리판 — 뒤를 흐리고(26px), 비스듬한 빛·안쪽 빛·반사·결을 얹는다. */}
      <Group transform={leaveScale}>
        <BackdropBlur blur={glassBlur} clip={shape}>
          <Group opacity={glassAlpha} clip={shape}>
            <Rect x={0} y={0} width={w} height={h} color="rgba(14, 15, 19, 0.22)" />
            <Rect x={0} y={0} width={w} height={h}>
              <LinearGradient
                start={glass.start}
                end={glass.end}
                positions={[0, 0.26, 0.56, 1]}
                colors={[
                  'rgba(255, 255, 255, 0.16)',
                  'rgba(255, 255, 255, 0.05)',
                  'rgba(255, 255, 255, 0.015)',
                  'rgba(255, 255, 255, 0.09)',
                ]}
              />
            </Rect>
            {/* 안쪽 빛 — 아래는 강조색, 왼쪽은 하늘색이 안으로 번진다(웹 inset box-shadow). */}
            <Rect x={0} y={h - 70} width={w} height={70}>
              <LinearGradient start={vec(0, h)} end={vec(0, h - 60)} colors={[alpha(C.accent, 0.22), 'transparent']} />
            </Rect>
            <Rect x={0} y={0} width={60} height={h}>
              <LinearGradient start={vec(0, 0)} end={vec(50, 0)} colors={['rgba(58, 154, 230, 0.12)', 'transparent']} />
            </Rect>
            {/* 비스듬한 빛줄기 셋(웹 ::before) */}
            <Rect x={0} y={0} width={w} height={h}>
              <LinearGradient
                start={sheen.start}
                end={sheen.end}
                positions={[0, 0.24, 0.48, 0.53, 0.6, 0.63, 0.66, 0.7]}
                colors={[
                  'rgba(255, 255, 255, 0.1)',
                  'transparent',
                  'transparent',
                  'rgba(255, 255, 255, 0.055)',
                  'transparent',
                  'transparent',
                  'rgba(255, 255, 255, 0.03)',
                  'transparent',
                ]}
              />
            </Rect>
            {/* 반사 — 손가락이 없으니 가운데에 둔다(웹은 마우스를 따라간다). */}
            <Rect x={0} y={0} width={w} height={h}>
              <RadialGradient c={vec(cx, cy)} r={308} colors={['rgba(255, 255, 255, 0.15)', 'transparent']} />
            </Rect>
            {/* 결(노이즈) */}
            <Rect x={0} y={0} width={w} height={h} opacity={0.07} blendMode="overlay">
              <FractalNoise freqX={0.85} freqY={0.85} octaves={2} />
            </Rect>
            {/* 위 가장자리 1px 빛 */}
            <Path path={shape} style="stroke" strokeWidth={2} color="rgba(255, 255, 255, 0.12)" />
          </Group>
        </BackdropBlur>
      </Group>

      {/* 외곽선 · 번쩍임 · 흐르는 빛 둘 */}
      <Group transform={leaveScale} opacity={rimAlpha}>
        <Path path={shape} style="stroke" strokeWidth={1}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(w, h)}
            positions={[0, 0.45, 1]}
            colors={['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.3)']}
          />
        </Path>
        <Path path={shape} style="stroke" strokeWidth={2.5} color={C.accent} opacity={choreo.flash}>
          <BlurMask blur={3.5} style="solid" />
        </Path>
        <Path path={shape} style="stroke" strokeWidth={2.5} color="#ef4444" opacity={choreo.flashError}>
          <BlurMask blur={3.5} style="solid" />
        </Path>
        <Group opacity={beamAlpha}>
          <Path path={shape} style="stroke" strokeWidth={6} strokeCap="round" color={C.accent} opacity={0.85}>
            <DashPathEffect intervals={[length * 0.07, length * 0.93]} phase={beamPhase} />
            <BlurMask blur={3.5} style="normal" />
          </Path>
          <Path
            path={shape}
            style="stroke"
            strokeWidth={1.6}
            strokeCap="round"
            color={mixHex(C.accent, '#ffffff', 0.78)}
          >
            <DashPathEffect intervals={[length * 0.07, length * 0.93]} phase={beamPhase} />
          </Path>
          <Path path={shape} style="stroke" strokeWidth={1.6} strokeCap="round" color="#a9d4ff" opacity={0.75}>
            <DashPathEffect intervals={[length * 0.044, length * 0.956]} phase={beamPhaseAlt} />
          </Path>
        </Group>
      </Group>

      <Corner corner="tl" x={choreo.tlX} y={choreo.tlY} cx={cx} cy={cy} choreo={choreo} cornerIn={cornerIn} />
      <Corner corner="br" x={choreo.brX} y={choreo.brY} cx={cx} cy={cy} choreo={choreo} cornerIn={cornerIn} />

      <Ring cx={cx} cy={cy} progress={choreo.ringOk} from={0.45} to={2.7} color={C.accentHi} glow={C.accent} />
      <Ring cx={cx} cy={cy} progress={choreo.ringOk2} from={0.45} to={2.7} color={C.accentHi} glow={C.accent} />
      <Ring cx={cx} cy={cy} progress={choreo.ringFail} from={0.5} to={2} color="#fc8181" glow="#ef4444" />
      <Logos cx={cx} cy={cy} choreo={choreo} />
    </Group>
  );
}

interface CornerProps {
  corner: 'tl' | 'br';
  x: SharedValue<number>;
  y: SharedValue<number>;
  cx: number;
  cy: number;
  choreo: Choreography;
  cornerIn: SharedValue<number>;
}

/** 모서리 유리 조각 — 평소엔 투명한 유리, 연출 중엔 강조색으로, 로그인 실패 땐 빨간색으로 빛난다. */
function Corner({ corner, x, y, cx, cy, choreo, cornerIn }: CornerProps) {
  const path = PIECE_SK[corner];
  const transform = useDerivedValue(() => {
    const s = 1 + 0.6 * choreo.leave.value;
    return [
      { translateX: cx + x.value },
      { translateY: cy + y.value },
      { scale: s },
      { translateX: -PIECE / 2 },
      { translateY: -PIECE / 2 },
    ];
  });
  const fade = useDerivedValue(() => cornerIn.value * (1 - choreo.leave.value));
  const blur = useDerivedValue(() => 16 * fade.value);
  const activeAlpha = useDerivedValue(() => choreo.active.value * (1 - choreo.leave.value));
  const errorAlpha = useDerivedValue(() => choreo.error.value * (1 - choreo.leave.value));

  return (
    <Group transform={transform}>
      <RoundedRect x={8} y={8} width={PIECE - 16} height={PIECE - 16} r={14} color={C.accent} opacity={activeAlpha}>
        <BlurMask blur={16} style="normal" />
      </RoundedRect>
      <RoundedRect x={8} y={8} width={PIECE - 16} height={PIECE - 16} r={14} color="#ef4444" opacity={errorAlpha}>
        <BlurMask blur={16} style="normal" />
      </RoundedRect>
      <BackdropBlur blur={blur} clip={path}>
        <Path path={path} opacity={fade}>
          <LinearGradient
            start={CORNER_GLASS.start}
            end={CORNER_GLASS.end}
            positions={[0, 0.62]}
            colors={['rgba(255, 255, 255, 0.24)', 'rgba(255, 255, 255, 0.04)']}
          />
        </Path>
      </BackdropBlur>
      <Path path={path} opacity={activeAlpha}>
        <LinearGradient
          start={CORNER_GLASS.start}
          end={CORNER_GLASS.end}
          positions={[0, 0.38, 1]}
          colors={[mixHex(C.accent, '#ffffff', 0.7), C.accentHi, C.accentLo]}
        />
      </Path>
      <Path path={path} opacity={errorAlpha}>
        <LinearGradient
          start={CORNER_GLASS.start}
          end={CORNER_GLASS.end}
          positions={[0, 0.38, 1]}
          colors={['#ffc4c4', '#f05252', '#c81e1e']}
        />
      </Path>
      <Path path={path} style="stroke" strokeWidth={1} color="rgba(255, 255, 255, 0.45)" opacity={fade} />
    </Group>
  );
}

interface RingProps {
  cx: number;
  cy: number;
  progress: SharedValue<number>;
  from: number;
  to: number;
  color: string;
  glow: string;
}

/** 퍼지는 링 — 진행 0 → 1에 크기 from → to, 불투명도 0.95 → 0(진행 0은 숨김). */
function Ring({ cx, cy, progress, from, to, color, glow }: RingProps) {
  const transform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { scale: from + (to - from) * progress.value },
  ]);
  const opacity = useDerivedValue(() => (progress.value > 0 && progress.value < 1 ? 0.95 * (1 - progress.value) : 0));
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={66} style="stroke" strokeWidth={8} color={alpha(glow, 0.5)}>
        <BlurMask blur={13} style="normal" />
      </Circle>
      <Circle cx={0} cy={0} r={66} style="stroke" strokeWidth={1.5} color={color} />
    </Group>
  );
}

/** 가운데 표시 — 성공이면 합쳐진 조각(◩) 위에 X 로고, 실패면 빛나는 ✕. */
function Logos({ cx, cy, choreo }: { cx: number; cy: number; choreo: Choreography }) {
  const okAlpha = useDerivedValue(() => choreo.logoOk.value * (1 - choreo.leave.value));
  const okTransform = useDerivedValue(() => {
    const s = choreo.logoOkScale.value * (1 + 0.6 * choreo.leave.value);
    const k = 36 / X_BOX.width;
    return [
      { translateX: cx },
      { translateY: cy },
      { scale: s * k },
      { translateX: -X_BOX.width / 2 },
      { translateY: -X_BOX.height / 2 },
    ];
  });
  const failTransform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { scale: (choreo.logoFailScale.value * 26) / 24 },
    { translateX: -12 },
    { translateY: -12 },
  ]);
  return (
    <>
      <Group transform={okTransform} opacity={okAlpha}>
        <Path path={X_PATH} color={C.accentInk} style="fill" />
        <Path path={X_PATH} color={C.accentInk} style="stroke" strokeWidth={6} strokeJoin="round" />
      </Group>
      <Group transform={failTransform} opacity={choreo.logoFail}>
        <Path
          path="M18 6 6 18M6 6l12 12"
          style="stroke"
          strokeWidth={3}
          strokeCap="round"
          color="rgba(255, 255, 255, 0.7)"
        >
          <BlurMask blur={5} style="normal" />
        </Path>
        <Path path="M18 6 6 18M6 6l12 12" style="stroke" strokeWidth={3} strokeCap="round" color="#ffffff" />
      </Group>
    </>
  );
}
