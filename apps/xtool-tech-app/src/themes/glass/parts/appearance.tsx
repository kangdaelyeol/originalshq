import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, Text as RNText, View, type ViewInstance } from 'react-native';
import {
  Canvas,
  ClipOp,
  Picture,
  Skia,
  TileMode,
  PaintStyle,
  type SkCanvas,
  type SkPicture,
} from '@shopify/react-native-skia';
import Svg, { G, Polygon } from 'react-native-svg';
import { Check, Info, Pipette, Plus, RotateCcw } from 'lucide-react-native';
import { X_BOX, X_POLYGONS } from '../../../login/shape';
import {
  ACCENT_PRESETS,
  alpha,
  BACKGROUND_OPTIONS,
  DEFAULT_ACCENT,
  font,
  GLASS_LIMITS,
  GLASS_PRESETS,
  glassRim,
  glassTint,
  isHexColor,
  isPhotoBackground,
  KIND_LABEL,
  matchGlassPreset,
  MONO,
  saturateMatrix,
  T,
  type AccentPalette,
  type GlassSettings,
} from '../theme';
import { useGlass, useStyles, type GlassState } from '../theme-context';
import { backgroundPicture, cssLinear } from '../backgrounds/art';
import { usePhotoCrop } from '../backgrounds/backdrop';
import { BackgroundArt } from '../backgrounds/background-art';
import { Button, StatusPill, TextField } from './controls';
import { Sheet } from './overlays';
import { Card } from './surfaces';

// 외관 설정 — 웹 설정의 유리 카드 셋(pages/settings: background-card·accent-card·glass-effect-card)과 같은 모양·글.
// 값은 글라스 Provider(useGlass)가 들고, 이 기기에 남는다.

/** 외관 설정(계약 AppearanceSettings) — 배경 · 강조색 · 유리 효과 */
export function AppearanceSettings() {
  return (
    <>
      <BackgroundCard />
      <AccentCard />
      <GlassEffectCard />
    </>
  );
}

// ── 배경 ───────────────────────────────────────────────────────────────────────────────────────────────

/** 배경(웹 BackgroundCard) — 타일(16:10 그림 + 이름·종류·설명), 고른 타일은 강조 테두리·고리. 기본값으로는 셋 다 처음으로 */
function BackgroundCard() {
  const s = useStyles(bgStyles);
  const g = useGlass();
  return (
    <Card
      title="배경"
      actions={<Button label="기본값으로" icon={RotateCcw} variant="secondary" size="sm" onPress={g.reset} />}
    >
      <View style={s.list}>
        {BACKGROUND_OPTIONS.map(option => {
          const selected = option.value === g.background;
          return (
            <Pressable
              key={option.value}
              onPress={() => g.setBackground(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={({ pressed }) => [s.tile, selected ? s.tileOn : pressed && s.tilePressed]}
            >
              <BackgroundArt
                kind={option.value}
                accent={option.kind === 'photo' ? DEFAULT_ACCENT : g.accent}
                style={s.art}
              >
                {selected ? (
                  <View style={s.check}>
                    <Check size={14} strokeWidth={3} color={g.a.ink} />
                  </View>
                ) : null}
              </BackgroundArt>
              <View style={s.meta}>
                <View style={s.nameRow}>
                  <RNText style={s.name}>{option.label}</RNText>
                  <View style={s.kind}>
                    <RNText style={s.kindText}>{KIND_LABEL[option.kind]}</RNText>
                  </View>
                </View>
                <RNText style={s.desc}>{option.description}</RNText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const bgStyles = ({ a }: GlassState) => ({
  list: { gap: 14 },
  tile: {
    gap: 10,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  tilePressed: { borderColor: 'rgba(255, 255, 255, 0.16)', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  tileOn: {
    borderColor: alpha(a.accent, 0.7),
    backgroundColor: alpha(a.accent, 0.06),
    boxShadow: `0 0 0 3px ${alpha(a.accent, 0.16)}, 0 12px 30px -16px ${alpha(a.accent, 0.7)}`,
  },
  art: { aspectRatio: 16 / 10, borderRadius: 11 },
  check: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: a.accent,
    boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.6)',
  },
  meta: { gap: 3, paddingHorizontal: 4, paddingBottom: 4 },
  nameRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  name: { ...font(13.5, 700), color: T.text1 },
  kind: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  kindText: { ...font(10.5, 600), color: T.text3 },
  desc: { ...font(12, 400, { lh: 1.45 }), color: T.text3 },
});

// ── 강조색 ─────────────────────────────────────────────────────────────────────────────────────────────

/** 강조색(웹 AccentCard) — 견본 원 34, 직접 고르기, 지금 강조색 미리보기(로고·주 버튼·배지·HEX). 사진 배경이면 잠김 */
function AccentCard() {
  const s = useStyles(accentStyles);
  const g = useGlass();
  const locked = isPhotoBackground(g.background);
  const isPreset = ACCENT_PRESETS.some(p => p.value === g.accent);
  const [custom, setCustom] = useState(false);
  return (
    <Card title="강조색" actions={locked ? <StatusPill tone="neutral" label="사진 배경 — 기본색 고정" /> : undefined}>
      <View style={s.picker}>
        <View style={[s.swatches, locked && s.locked]}>
          {ACCENT_PRESETS.map(preset => {
            const on = !locked && preset.value === g.accent;
            return (
              <Pressable
                key={preset.value}
                onPress={() => g.setAccent(preset.value)}
                disabled={locked}
                accessibilityLabel={preset.label}
                accessibilityState={{ selected: on, disabled: locked }}
                style={({ pressed }) => [
                  s.swatch,
                  {
                    backgroundColor: preset.value,
                    boxShadow: on
                      ? `0 0 0 2px ${T.cardGap}, 0 0 0 4px ${preset.value}`
                      : `inset 0 0 0 1px rgba(255, 255, 255, 0.2), 0 4px 12px -4px ${preset.value}`,
                  },
                  pressed && s.swatchPressed,
                ]}
              />
            );
          })}
          <Pressable
            onPress={() => setCustom(true)}
            disabled={locked}
            accessibilityLabel="강조색 직접 고르기"
            style={({ pressed }) => [
              s.swatch,
              {
                boxShadow:
                  !locked && !isPreset
                    ? `0 0 0 2px ${T.cardGap}, 0 0 0 4px ${g.accent}`
                    : 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), 0 4px 12px -4px rgba(0, 0, 0, 0.6)',
              },
              pressed && s.swatchPressed,
            ]}
          >
            {isPreset ? <Rainbow /> : <View style={[s.fillCircle, { backgroundColor: g.accent }]} />}
            <Pipette size={14} strokeWidth={2} color="#ffffff" />
          </Pressable>
        </View>

        {/* 지금 칠해진 강조색 미리보기 — 실제 부품과 같은 모양(누를 수는 없다) */}
        <View style={s.preview} pointerEvents="none">
          <BrandMark a={g.a} />
          <Button label="주요 버튼" icon={Plus} onPress={() => undefined} />
          <View style={s.chip}>
            <RNText style={s.chipText}>강조 배지</RNText>
          </View>
          <RNText style={s.hex}>{g.accentInUse.toUpperCase()}</RNText>
        </View>

        {locked ? (
          <View style={s.note}>
            <Info size={14} strokeWidth={2} color={T.info} style={s.noteIcon} />
            <RNText style={s.noteText}>
              사진 배경에서는 사진 색을 해치지 않게 기본 강조색(xTool 그린)을 써요. 다른 배경으로 바꾸면 고른 색이 다시
              적용돼요.
            </RNText>
          </View>
        ) : null}
      </View>
      <CustomAccentSheet visible={custom} current={g.accent} onClose={() => setCustom(false)} onApply={g.setAccent} />
    </Card>
  );
}

/** 직접 고르기 — 무지개 원(웹 conic-gradient)을 Skia 원뿔 그라데이션으로 */
function Rainbow() {
  const picture = useMemo(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, 34, 34));
    const colors = ['#ff5a5a', '#ffb84d', '#e8ff4d', '#4dff88', '#4dd2ff', '#6b5cff', '#ff4dd2', '#ff5a5a'];
    // CSS conic는 12시에서 시계 방향 — Skia 원뿔은 3시에서 시작하니 −90° 돌린다
    const m = Skia.Matrix()
      .translate(17, 17)
      .rotate(-Math.PI / 2)
      .translate(-17, -17);
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setShader(
      Skia.Shader.MakeSweepGradient(
        17,
        17,
        colors.map(x => Skia.Color(x)),
        null,
        TileMode.Clamp,
        m,
      ),
    );
    c.drawCircle(17, 17, 17, paint);
    return rec.finishRecordingAsPicture();
  }, []);
  return (
    <Canvas style={{ position: 'absolute', left: 0, top: 0, width: 34, height: 34 }} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}

/** 로고 판(웹 BrandMark) — 145deg 밝은 단계 → 강조색 55% → 어두운 단계, 그 위 짙은 X(24px) */
export function BrandMark({ a }: { a: AccentPalette }) {
  const xh = (24 * X_BOX.height) / X_BOX.width;
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: `linear-gradient(145deg, ${a.hi}, ${a.accent} 55%, ${a.lo})`,
        boxShadow: `0 8px 22px -6px ${alpha(a.accent, 0.7)}, inset 0 1px 0 rgba(255, 255, 255, 0.32)`,
      }}
    >
      <Svg width={24} height={xh} viewBox={`0 0 ${X_BOX.width} ${X_BOX.height}`}>
        <G fill={a.ink} stroke={a.ink} strokeWidth={6} strokeLinejoin="round">
          {X_POLYGONS.map((poly, i) => (
            <Polygon key={i} points={poly.map(([x, y]) => `${x},${y}`).join(' ')} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

/** 직접 고르기 시트 — #rrggbb를 적으면 견본에 바로 보이고, 적용하면 강조색이 된다(웹은 색 고르는 창) */
function CustomAccentSheet({
  visible,
  current,
  onClose,
  onApply,
}: {
  visible: boolean;
  current: string;
  onClose: () => void;
  onApply: (accent: string) => void;
}) {
  const s = useStyles(accentStyles);
  const [text, setText] = useState(current.toUpperCase());
  // 열 때마다 지금 강조색에서 시작
  const [wasOpen, setWasOpen] = useState(visible);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) setText(current.toUpperCase());
  }
  const value = text.startsWith('#') ? text : `#${text}`;
  const valid = isHexColor(value);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="강조색 직접 고르기"
      subtitle="#RRGGBB — 16진수 여섯 자리"
      footer={
        <View style={s.footer}>
          <Button label="취소" variant="secondary" onPress={onClose} />
          <Button
            label="적용"
            disabled={!valid}
            onPress={() => {
              onApply(value.toLowerCase());
              onClose();
            }}
          />
        </View>
      }
    >
      <View style={s.customRow}>
        <View style={[s.customSwatch, { backgroundColor: valid ? value : 'transparent' }]} />
        <TextField
          value={text}
          onChangeText={t => setText(t.toUpperCase())}
          placeholder="#00C767"
          autoCapitalize="none"
          maxLength={7}
          error={text && !valid ? '#과 16진수 여섯 자리로 적어 주세요' : null}
          style={s.customField}
        />
      </View>
    </Sheet>
  );
}

const accentStyles = ({ a }: GlassState) => ({
  picker: { gap: 18 },
  swatches: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12 },
  locked: { opacity: 0.4 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  swatchPressed: { transform: [{ scale: 1.08 }] },
  fillCircle: { position: 'absolute' as const, left: 0, top: 0, width: 34, height: 34, borderRadius: 17 },
  // 웹 .accent-preview — p 14/16 r14, 테두리 .06, 바탕 rgba(0,0,0,.22), 사이 14
  preview: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alpha(a.accent, 0.32),
    backgroundColor: alpha(a.accent, 0.12),
  },
  chipText: { ...font(11.5, 600), color: a.hi },
  hex: { fontFamily: MONO, fontSize: 12, color: T.text3, marginLeft: 'auto' as const },
  note: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8 },
  noteIcon: { marginTop: 2 },
  noteText: { ...font(12.5, 400, { lh: 1.5 }), color: T.text3, flex: 1 },
  customRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12 },
  customSwatch: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  customField: { flex: 1 },
  footer: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 8 },
});

// ── 유리 효과 ───────────────────────────────────────────────────────────────────────────────────────────

/** 유리 효과(웹 GlassEffectCard) — 프리셋 넷(줄무늬 위 유리 칩), 슬라이더 넷, 지금 배경 위 미리보기 */
function GlassEffectCard() {
  const s = useStyles(glassStyles);
  const g = useGlass();
  const preset = matchGlassPreset(g.glass);
  return (
    <Card title="유리 효과" actions={preset === null ? <StatusPill tone="neutral" label="사용자 지정" /> : undefined}>
      <View style={s.settings}>
        <View>
          <View style={s.presets}>
            {GLASS_PRESETS.map(p => {
              const on = preset === p.value;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => g.setGlass(p.glass)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${p.label} — ${p.description}`}
                  style={({ pressed }) => [s.preset, on ? s.presetOn : pressed && s.presetPressed]}
                >
                  <PresetSample glass={p.glass} accent={g.a.accent} />
                  <View style={s.presetLabel}>
                    <RNText style={s.presetName}>{p.label}</RNText>
                    <RNText style={s.presetDesc}>{p.description}</RNText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={s.sliders}>
            <RangeField
              label="흐림"
              hint="뒤 배경을 얼마나 뿌옇게 흐릴지"
              value={g.glass.blur}
              {...GLASS_LIMITS.blur}
              format={v => `${v}px`}
              onChange={blur => g.setGlass({ blur })}
            />
            <RangeField
              label="유리 농도"
              hint="낮을수록 투명하고, 높을수록 글이 또렷해요"
              value={Math.round(g.glass.opacity * 100)}
              min={GLASS_LIMITS.opacity.min * 100}
              max={GLASS_LIMITS.opacity.max * 100}
              step={1}
              format={v => `${v}%`}
              onChange={v => g.setGlass({ opacity: v / 100 })}
            />
            <RangeField
              label="채도"
              hint="비쳐 보이는 배경 색을 얼마나 진하게"
              value={g.glass.saturate}
              {...GLASS_LIMITS.saturate}
              format={v => `${v}%`}
              onChange={saturate => g.setGlass({ saturate })}
            />
            <RangeField
              label="테두리 빛"
              hint="유리 가장자리의 얇은 빛 테두리"
              value={Math.round(g.glass.rim * 100)}
              min={GLASS_LIMITS.rim.min * 100}
              max={GLASS_LIMITS.rim.max * 100}
              step={10}
              format={v => `${v}%`}
              onChange={v => g.setGlass({ rim: v / 100 })}
            />
          </View>
        </View>
        <GlassPreview />
      </View>
    </Card>
  );
}

const glassStyles = ({ a }: GlassState) => ({
  settings: { gap: 24 },
  presets: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 },
  preset: {
    flexBasis: '46%' as const,
    flexGrow: 1,
    gap: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  presetPressed: { borderColor: 'rgba(255, 255, 255, 0.16)' },
  presetOn: {
    borderColor: alpha(a.accent, 0.7),
    backgroundColor: alpha(a.accent, 0.06),
    boxShadow: `0 0 0 3px ${alpha(a.accent, 0.16)}`,
  },
  presetLabel: { gap: 1, paddingHorizontal: 2, paddingBottom: 2 },
  presetName: { ...font(13, 700), color: T.text1 },
  presetDesc: { ...font(11, 400, { lh: 1.4 }), color: T.text3 },
  sliders: { gap: 16, marginTop: 20 },
});

/** 유리 판 한 장을 Skia로(미리보기용) — 배경을 흐리고(blur·saturate) 칠·150deg 빛·테두리 빛·위 안 빛·아래 그림자 */
function drawGlassPanel(c: SkCanvas, x: number, y: number, w: number, h: number, r: number, glass: GlassSettings) {
  const rr = Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r);
  // 흐림·채도 — 판 자리 뒤를 그대로 읽어 거른다(웹 backdrop-filter)
  c.save();
  c.clipRRect(rr, ClipOp.Intersect, true);
  const backdrop = Skia.ImageFilter.MakeColorFilter(
    Skia.ColorFilter.MakeMatrix(saturateMatrix(glass.saturate / 100)),
    glass.blur > 0 ? Skia.ImageFilter.MakeBlur(glass.blur, glass.blur, TileMode.Clamp, null) : null,
  );
  c.saveLayer(undefined, Skia.XYWHRect(x, y, w, h), backdrop);
  const tint = Skia.Paint();
  tint.setColor(Skia.Color(glassTint(glass.opacity)));
  c.drawRect(Skia.XYWHRect(x, y, w, h), tint);
  const { start, end } = cssLinear(150, x, y, w, h);
  const sheen = Skia.Paint();
  sheen.setShader(
    Skia.Shader.MakeLinearGradient(
      start,
      end,
      ['rgba(255, 255, 255, 0.075)', 'rgba(255, 255, 255, 0.022)', 'rgba(255, 255, 255, 0.045)'].map(v =>
        Skia.Color(v),
      ),
      [0, 0.42, 1],
      TileMode.Clamp,
    ),
  );
  c.drawRect(Skia.XYWHRect(x, y, w, h), sheen);
  c.restore();
  // 위쪽 안 빛 1px(inset 0 1px 0 rgba(255,255,255, .07 × 테두리 빛))
  const inset = Skia.Paint();
  inset.setColor(Skia.Color(`rgba(255, 255, 255, ${0.07 * glass.rim})`));
  c.drawRect(Skia.XYWHRect(x, y + 1, w, 1), inset);
  c.restore();
  // 테두리 빛 1px
  const rim = Skia.Paint();
  rim.setAntiAlias(true);
  rim.setStyle(PaintStyle.Stroke);
  rim.setStrokeWidth(1);
  rim.setColor(Skia.Color(glassRim(glass.rim)));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + 0.5, y + 0.5, w - 1, h - 1), r - 0.5, r - 0.5), rim);
  // 아래 그림자(0 24px 48px -24px rgba(0,0,0,.75)) — 판 안에는 그리지 않는다
  c.save();
  c.clipRRect(rr, ClipOp.Difference, true);
  const shadow = Skia.Paint();
  shadow.setAntiAlias(true);
  shadow.setColor(Skia.Color('rgba(0, 0, 0, 0.75)'));
  shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(0, 24, true));
  c.drawRRect(
    Skia.RRectXY(Skia.XYWHRect(x + 24, y + 48, w - 48, h - 48), Math.max(0, r - 24), Math.max(0, r - 24)),
    shadow,
  );
  c.restore();
}

/** 프리셋 견본(웹 .glass-preset__sample) — 115deg 줄무늬(강조색·흰색·짙은 색) 위에 그 프리셋 값으로 칠한 유리 칩 */
function PresetSample({ glass, accent }: { glass: GlassSettings; accent: string }) {
  const [w, setW] = useState(0);
  const h = 58;
  const picture = useMemo<SkPicture | null>(() => {
    if (!w) return null;
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, w, h));
    // repeating-linear-gradient(115deg, accent .95 0 6px, 흰 .85 6px 9px, #14161b 9px 18px)
    const { start } = cssLinear(115, 0, 0, w, h);
    const a = (115 * Math.PI) / 180;
    const end = { x: start.x + Math.sin(a) * 18, y: start.y - Math.cos(a) * 18 };
    const stripes = Skia.Paint();
    stripes.setShader(
      Skia.Shader.MakeLinearGradient(
        start,
        end,
        [
          alpha(accent, 0.95),
          alpha(accent, 0.95),
          'rgba(255, 255, 255, 0.85)',
          'rgba(255, 255, 255, 0.85)',
          '#14161b',
          '#14161b',
        ].map(v => Skia.Color(v)),
        [0, 6 / 18, 6 / 18, 9 / 18, 9 / 18, 1],
        TileMode.Repeat,
      ),
    );
    c.drawRect(Skia.XYWHRect(0, 0, w, h), stripes);
    drawGlassPanel(c, 14, 11, w - 28, h - 22, 9, glass);
    return rec.finishRecordingAsPicture();
  }, [w, glass, accent]);
  return (
    <View style={sample.box} onLayout={e => setW(Math.round(e.nativeEvent.layout.width))}>
      {picture ? (
        <Canvas style={sample.canvas} pointerEvents="none">
          <Picture picture={picture} />
        </Canvas>
      ) : null}
    </View>
  );
}

const sample = {
  box: { height: 58, borderRadius: 10, overflow: 'hidden' as const, backgroundColor: '#14161b' },
  canvas: { position: 'absolute' as const, left: 0, top: 0, right: 0, bottom: 0 },
};

/** 미리보기(웹 .glass-preview) — 지금 배경 위에 지금 유리 값으로 칠한 판(제목·글·버튼) */
function GlassPreview() {
  const s = useStyles(previewStyles);
  const g = useGlass();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [card, setCard] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const photo = usePhotoCrop(g.background === 'photo' ? 'tile' : null);
  // 배경은 배경·강조색이 바뀔 때만, 유리는 슬라이더를 움직일 때마다 다시 그린다
  const art = useMemo(
    () =>
      box ? backgroundPicture({ kind: g.background, accent: g.accentInUse, width: box.w, height: box.h, photo }) : null,
    [box, g.background, g.accentInUse, photo],
  );
  const picture = useMemo<SkPicture | null>(() => {
    if (!box || !card || !art) return null;
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, box.w, box.h));
    c.drawPicture(art);
    drawGlassPanel(c, card.x, card.y, card.w, card.h, 16, g.glass);
    return rec.finishRecordingAsPicture();
  }, [box, card, art, g.glass]);
  return (
    <View
      style={s.box}
      onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {picture ? (
        <Canvas style={sample.canvas} pointerEvents="none">
          <Picture picture={picture} />
        </Canvas>
      ) : null}
      <View
        style={s.card}
        onLayout={e => {
          const { x, y, width, height } = e.nativeEvent.layout;
          setCard({ x, y, w: width, h: height });
        }}
      >
        <RNText style={s.title}>미리보기</RNText>
        <RNText style={s.text}>지금 고른 배경 위에서 유리 판은 이렇게 보여요.</RNText>
        <Button label="버튼" size="sm" onPress={() => undefined} />
      </View>
    </View>
  );
}

const previewStyles = () => ({
  box: {
    minHeight: 300,
    padding: 24,
    borderRadius: 16,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#050506',
  },
  card: { width: '100%' as const, maxWidth: 280, padding: 20, gap: 8, alignItems: 'flex-start' as const },
  title: { ...font(15, 700), color: T.text1 },
  text: { ...font(12.5, 400, { lh: 1.5 }), color: T.text2 },
});

// ── 슬라이더(웹 RangeField) ──────────────────────────────────────────────────────────────────────────────

/** 이름 + 지금 값(고정폭) + 슬라이더(채운 구간 강조색, 흰 손잡이에 강조 테두리 3px) + 설명 */
function RangeField({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const s = useStyles(rangeStyles);
  const track = useRef<ViewInstance | null>(null);
  const frame = useRef({ x: 0, w: 1 });
  const latest = useRef({ value, onChange, min, max, step });
  latest.current = { value, onChange, min, max, step };
  const ratio = (value - min) / (max - min);

  const responder = useMemo(() => {
    const set = (pageX: number) => {
      const { onChange: change, min: lo, max: hi, step: st, value: now } = latest.current;
      const t = Math.min(1, Math.max(0, (pageX - frame.current.x) / frame.current.w));
      const next = Math.round((lo + t * (hi - lo)) / st) * st;
      const fixed = Math.min(hi, Math.max(lo, Number(next.toFixed(4))));
      if (fixed !== now) change(fixed);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => {
        track.current?.measureInWindow((x, _y, w) => {
          frame.current = { x, w: Math.max(1, w) };
          set(e.nativeEvent.pageX);
        });
      },
      onPanResponderMove: e => set(e.nativeEvent.pageX),
    });
  }, []);

  const nudge = (dir: 1 | -1) => {
    const next = Math.min(max, Math.max(min, Number((value + dir * step).toFixed(4))));
    if (next !== value) onChange(next);
  };

  return (
    <View style={s.field}>
      <View style={s.head}>
        <RNText style={s.label}>{label}</RNText>
        <RNText style={s.value}>{format(value)}</RNText>
      </View>
      <View
        ref={track}
        collapsable={false}
        style={s.hit}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: format(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        {...responder.panHandlers}
      >
        <View style={s.track} pointerEvents="none">
          <View style={[s.fill, { width: `${ratio * 100}%` }]} />
        </View>
        <View pointerEvents="none" style={[s.thumb, { left: `${ratio * 100}%` }]} />
      </View>
      {hint ? <RNText style={s.hint}>{hint}</RNText> : null}
    </View>
  );
}

const rangeStyles = ({ a }: GlassState) => ({
  field: { gap: 6 },
  head: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
  },
  label: { ...font(12.5, 600), color: T.text2 },
  value: { fontFamily: MONO, fontSize: 12, color: T.text1 },
  // 손가락이 잡기 쉽게 높이 28(웹 입력 높이 20) — 트랙은 가운데 6px
  hit: { height: 28, justifyContent: 'center' as const },
  track: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' as const },
  fill: { height: 6, backgroundColor: a.accent },
  thumb: {
    position: 'absolute' as const,
    top: 5,
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: a.accent,
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
  },
  hint: { ...font(11, 400, { lh: 1.45 }), color: T.text4 },
});
