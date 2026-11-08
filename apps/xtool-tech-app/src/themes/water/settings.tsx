import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { Plus, RotateCcw } from 'lucide-react-native';
import { WButton, WPill } from './parts/controls';
import { WSegmented } from './parts/segmented';
import { WCard } from './parts/surfaces';
import { WText } from './parts/text';
import {
  darkFill,
  glassShadow,
  matchWaterPreset,
  shadow,
  solidFill,
  solidShadow,
  W,
  WATER_ACCENTS,
  WATER_LIMITS,
  WATER_PANES,
  WATER_PRESETS,
  WATER_WALLS,
  waterAccentStops,
  type WaterPane,
} from './theme';
import { resetWater, setWater, useWater } from './theme-context';

// 설정 > 물 디자인(웹 components/water/settings/water-settings-cards.tsx) — 배경(벽 색조)·강조색(고른 것 뒤 알약·주
// 버튼·막대)·유리 효과(깊이·테두리·판 색·농도). 바꾸는 즉시 앱 전체 물 부품에 칠해지고 이 기기에 남는다. 벽 아래 사진·
// 강조색 직접 고르기는 앱에 아직 없다(사진 주소 찾기·색 고르는 창이 없어서).

/** D7 잉크(강조색 기본) 견본 색 */
const INK = '#555358';

export function WaterAppearanceSettings() {
  return (
    <>
      <WallCard />
      <AccentCard />
      <EffectCard />
    </>
  );
}

/** 견본 칸(웹 .glass-preset — 물 화면: 옅은 흰 판, 고른 칸은 잉크 테) */
function Preset({
  selected,
  onPress,
  label,
  description,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.preset,
        pressed && !selected ? styles.presetPressed : null,
        selected ? styles.presetOn : null,
      ]}
    >
      {children}
      <View style={styles.presetLabel}>
        <WText size={13} weight="700">
          {label}
        </WText>
        <WText size={11} color={W.ink3} lh={1.4}>
          {description}
        </WText>
      </View>
    </Pressable>
  );
}

/** 두 칸씩 */
function Grid({ children }: { children: ReactNode[] }) {
  const rows: ReactNode[][] = [];
  for (let i = 0; i < children.length; i += 2) rows.push(children.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.gridRow}>
          {row.map((c, j) => (
            <View key={j} style={styles.gridCell}>
              {c}
            </View>
          ))}
          {row.length === 1 ? <View style={styles.gridCell} /> : null}
        </View>
      ))}
    </View>
  );
}

/** 배경 — 타일 벽의 색조. "기본값으로"는 물 디자인 값 전체를 처음으로 */
function WallCard() {
  const p = useWater();
  return (
    <WCard
      title="배경"
      actions={
        <WButton variant="ghost" size="sm" icon={RotateCcw} onPress={resetWater}>
          기본값으로
        </WButton>
      }
    >
      <Grid>
        {WATER_WALLS.map(wall => (
          <Preset
            key={wall.value}
            selected={p.settings.wall === wall.value}
            onPress={() => setWater({ wall: wall.value })}
            label={wall.label}
            description={wall.description}
          >
            {/* 그 색조의 사선 그러데이션 + 타일 격자선(46 × 20) */}
            <View
              style={[
                styles.art,
                {
                  backgroundImage: `linear-gradient(90deg, ${W.line} 1px, transparent 1px), linear-gradient(180deg, ${W.line} 1px, transparent 1px), linear-gradient(135deg, ${wall.hi}, ${wall.lo})`,
                },
              ]}
            />
          </Preset>
        ))}
      </Grid>
    </WCard>
  );
}

/** 강조색 — 고른 것 뒤 알약·주 버튼·막대. 흰 글자가 얹히니 고른 색의 어두운 단계로 칠한다 */
function AccentCard() {
  const p = useWater();
  const [sample, setSample] = useState<'on' | 'off'>('on');
  return (
    <WCard title="강조색">
      <View style={styles.swatches}>
        {WATER_ACCENTS.map(option => {
          const color = option.value ? waterAccentStops(option.value).dark1 : INK;
          const on = option.value === p.settings.accent;
          return (
            <Pressable
              key={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={option.label}
              hitSlop={4}
              onPress={() => setWater({ accent: option.value })}
              style={[
                styles.swatch,
                {
                  backgroundColor: color,
                  boxShadow: on
                    ? [shadow(0, 0, 0, 2, '#d6d4d9'), shadow(0, 0, 0, 4, color)]
                    : [shadow(0, 0, 0, 1, 'rgba(255, 255, 255, 0.2)', true), shadow(0, 4, 12, -4, color)],
                },
              ]}
            />
          );
        })}
      </View>
      {/* 지금 강조색으로 칠한 실제 물 부품 */}
      <View style={styles.preview}>
        <WSegmented
          options={[
            { value: 'on' as const, label: '고른 것' },
            { value: 'off' as const, label: '다른 것' },
          ]}
          value={sample}
          onChange={setSample}
          size="sm"
          accessibilityLabel="강조색 미리보기"
        />
        <WButton size="sm" icon={Plus}>
          주요 버튼
        </WButton>
      </View>
    </WCard>
  );
}

/** 유리 효과 — 깊이(떨어지는 그림자)·테두리 진하기, 판 색·유리 농도. 프리셋은 깊이·테두리만 바꾼다 */
function EffectCard() {
  const p = useWater();
  const s = p.settings;
  const preset = matchWaterPreset(s);
  return (
    <WCard title="유리 효과" actions={preset === null ? <WPill tone="neutral">사용자 지정</WPill> : null}>
      <Grid>
        {WATER_PRESETS.map(pr => (
          <Preset
            key={pr.value}
            selected={preset === pr.value}
            onPress={() => setWater({ depth: pr.depth, rim: pr.rim })}
            label={pr.label}
            description={pr.description}
          >
            {/* 그 프리셋 값으로 칠한 작은 유리 판 */}
            <View style={[styles.effectArt, { backgroundImage: `linear-gradient(135deg, ${p.wallHi}, ${p.wallLo})` }]}>
              <View
                style={[
                  styles.effectChip,
                  { backgroundColor: p.pane, boxShadow: glassShadow({ rim: pr.rim, depth: pr.depth }, 0.6, 0.6) },
                ]}
              />
            </View>
          </Preset>
        ))}
      </Grid>
      <View style={styles.sliders}>
        <WRange
          label="깊이"
          hint="판이 벽에서 얼마나 떠 보일지(그림자)"
          value={Math.round(s.depth * 100)}
          min={WATER_LIMITS.depth.min * 100}
          max={WATER_LIMITS.depth.max * 100}
          step={10}
          onChange={v => setWater({ depth: v / 100 })}
        />
        <WRange
          label="테두리"
          hint="유리 가장자리와 안쪽 그림자의 진하기"
          value={Math.round(s.rim * 100)}
          min={WATER_LIMITS.rim.min * 100}
          max={WATER_LIMITS.rim.max * 100}
          step={10}
          onChange={v => setWater({ rim: v / 100 })}
        />
        <View style={styles.paneField}>
          <WText size={12.5} weight="600" color={W.ink2} lh={1.2}>
            판 색
          </WText>
          <WSegmented<WaterPane>
            options={WATER_PANES}
            value={s.pane}
            onChange={pane => setWater({ pane })}
            size="sm"
            accessibilityLabel="판 색"
          />
          <WText size={11.5} color={W.ink2} lh={1.4}>
            서랍·팝업·알림처럼 내용을 가리는 판의 바탕색
          </WText>
        </View>
        <WRange
          label="유리 농도"
          hint="판에 덮는 흰빛 — 높을수록 밝고 뿌옇게"
          value={Math.round(s.frost * 100)}
          min={WATER_LIMITS.frost.min * 100}
          max={WATER_LIMITS.frost.max * 100}
          step={5}
          onChange={v => setWater({ frost: v / 100 })}
        />
      </View>
    </WCard>
  );
}

const KNOB = 22;

/**
 * 물 슬라이더(웹 WaterRange) — 유리에 파인 홈 + 어두운 채움 + 불투명 유리 손잡이(22). 끌거나 누른 자리로 값이 바뀐다.
 * 채움은 홈 폭 그대로 두고 옮기기만 한다(오른끝 = 손잡이 가운데).
 */
function WRange({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const p = useWater();
  const [w, setW] = useState(0);
  const t = max > min ? (value - min) / (max - min) : 0;
  const pos = KNOB / 2 + Math.max(0, w - KNOB) * t;
  const pick = (e: GestureResponderEvent) => {
    if (w <= KNOB) return;
    const x = e.nativeEvent.locationX;
    const u = Math.min(1, Math.max(0, (x - KNOB / 2) / (w - KNOB)));
    const next = Math.round((min + u * (max - min)) / step) * step;
    if (next !== value) onChange(Math.min(max, Math.max(min, next)));
  };
  return (
    <View style={styles.range}>
      <View style={styles.rangeHead}>
        <WText size={12.5} weight="600" color={W.ink2} lh={1.2}>
          {label}
        </WText>
        <WText size={12} weight="600" tabular>
          {value}%
        </WText>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: `${value}%` }}
        onAccessibilityAction={e => {
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + step));
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - step));
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        style={styles.track}
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={pick}
        onResponderMove={pick}
      >
        <View pointerEvents="none" style={styles.groove}>
          <View
            style={[styles.fill, { width: w, transform: [{ translateX: pos - w }], backgroundImage: darkFill(p) }]}
          />
          <View style={styles.grooveRim} />
        </View>
        <View pointerEvents="none" style={[styles.knob, { transform: [{ translateX: pos - KNOB / 2 }] }]}>
          <View style={styles.knobShadow} />
          <View style={[styles.knobFill, { backgroundImage: solidFill('circle'), boxShadow: solidShadow(0.3) }]} />
        </View>
      </View>
      {hint ? (
        <WText size={11.5} color={W.ink2} lh={1.4}>
          {hint}
        </WText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  gridCell: { flex: 1, minWidth: 0 },
  preset: {
    gap: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  presetPressed: { borderColor: 'rgba(255, 255, 255, 0.7)' },
  presetOn: {
    borderColor: 'rgba(63, 62, 67, 0.7)',
    backgroundColor: 'rgba(63, 62, 67, 0.06)',
    boxShadow: [shadow(0, 0, 0, 3, 'rgba(63, 62, 67, 0.16)')],
  },
  presetLabel: { gap: 1, paddingHorizontal: 2, paddingBottom: 2 },
  art: {
    height: 56,
    borderRadius: 10,
    backgroundSize: '46px 20px, 46px 20px, 100% 100%',
    backgroundRepeat: 'repeat, repeat, no-repeat',
  },
  effectArt: { height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  effectChip: { width: '58%', height: 26, borderRadius: 13 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  preview: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 16 },
  sliders: { gap: 16, marginTop: 16 },
  paneField: { gap: 8, alignItems: 'flex-start' },
  range: { gap: 8 },
  rangeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  track: { height: KNOB, justifyContent: 'center' },
  groove: { height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(0, 0, 0, 0.12)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5 },
  grooveRim: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 5,
    boxShadow: [
      shadow(0, 1.2, 0, 0, 'rgba(0, 0, 0, 0.3)', true),
      shadow(0, 0, 0, 0.84, 'rgba(0, 0, 0, 0.16)', true),
      shadow(0, 3, 3.6, 0, 'rgba(0, 0, 0, 0.05)', true),
    ],
  },
  knob: { position: 'absolute', left: 0, top: 0, width: KNOB, height: KNOB },
  knobShadow: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: KNOB / 2,
    boxShadow: [shadow(0, 2, 5, 0, 'rgba(0, 0, 0, 0.24)')],
  },
  knobFill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: KNOB / 2 },
});
