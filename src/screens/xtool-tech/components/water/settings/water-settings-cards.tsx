import { Pipette, Plus, RotateCcw } from 'lucide-react'
import { useRef, useState, type CSSProperties } from 'react'
import { useAppearance } from '@/ohq-ui/appearance/appearance'
import { cx } from '@/ohq-ui/lib/cx'
import {
  matchWaterPreset,
  WATER_ACCENTS,
  WATER_LIMITS,
  WATER_PANES,
  WATER_PRESETS,
  WATER_WALLS,
  waterAccentStops,
} from '@/ohq-ui/theme/water'
import { WaterButton, WaterCard, WaterRange, WaterSegmented, WaterStatusPill } from '@/ohq-ui/water'
import { SharedPhotoPicker, type SharedPhotoPickerProps } from '../../../pages/settings/shared-photo-picker'

// 설정 > 물 디자인 카드 셋 — 유리 디자인의 배경·강조색·유리 효과에 해당한다. 값은 외관 설정(appearance water)에
// 저장되고 ThemeRoot가 CSS 변수(--w-*)로 칠해 바꾸는 즉시 이 화면(물)에 보인다(ohq-ui/theme/water.ts).

// 직접 고르기 — 색 고르는 창을 끄는 동안 매번 칠하면 버벅여서, 손을 멈춘 뒤 반영한다(유리 강조색과 같게)
const CUSTOM_COMMIT_MS = 120
// D7 잉크(강조색 기본) 견본 색 — _tokens.scss $w-dark 위 단계
const INK = '#555358'

/**
 * 배경 — 타일 벽의 색조와 벽 아래 깔 사진(팀이 공유한 사진 — 벽 색조가 반투명 막으로 덮어 글자가 읽힌다).
 * "기본값으로"는 물 디자인 값 전체(벽·사진·강조색·유리 효과)를 처음으로.
 */
export function WaterWallCard(props: Pick<SharedPhotoPickerProps, 'shared' | 'uploading' | 'onUpload'>) {
  const { water, setWater, resetWater } = useAppearance()
  return (
    <WaterCard
      title="배경"
      actions={
        <WaterButton variant="ghost" size="sm" icon={RotateCcw} onClick={resetWater}>
          기본값으로
        </WaterButton>
      }
    >
      <div className="glass-presets water-walls" role="radiogroup" aria-label="벽 색조">
        {WATER_WALLS.map((wall) => {
          const selected = wall.value === water.wall
          return (
            <button
              key={wall.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={cx('glass-preset', selected && 'is-selected')}
              onClick={() => setWater({ wall: wall.value })}
            >
              <span className="water-wall-art" style={{ '--art-hi': wall.hi, '--art-lo': wall.lo } as CSSProperties} aria-hidden />
              <span className="glass-preset__label">
                <strong>{wall.label}</strong>
                <span>{wall.description}</span>
              </span>
            </button>
          )
        })}
      </div>
      <SharedPhotoPicker
        {...props}
        selectedId={water.photoId}
        onSelect={(photoId) => setWater({ photoId })}
        onCleared={() => setWater({ photoId: null })}
        none={{ label: '사진 없음', description: '타일 벽만', onSelect: () => setWater({ photoId: null }) }}
      />
    </WaterCard>
  )
}

/** 강조색 — 고른 것 뒤 알약·주 버튼·막대. 흰 글자가 얹히니 고른 색의 어두운 단계로 칠한다. */
export function WaterAccentCard() {
  const { water, setWater } = useAppearance()
  const isPreset = WATER_ACCENTS.some((a) => a.value === water.accent)
  const commitTimer = useRef<number | undefined>(undefined)
  const [sample, setSample] = useState<'on' | 'off'>('on')

  const onCustomColor = (value: string) => {
    window.clearTimeout(commitTimer.current)
    commitTimer.current = window.setTimeout(() => setWater({ accent: value }), CUSTOM_COMMIT_MS)
  }

  return (
    <WaterCard title="강조색">
      <div className="accent-picker">
        <ul className="swatches" aria-label="강조색">
          {WATER_ACCENTS.map((option) => (
            <li key={option.label}>
              <button
                type="button"
                className={cx('swatch', option.value === water.accent && 'is-selected')}
                style={{ '--swatch': option.value ? waterAccentStops(option.value).dark1 : INK } as CSSProperties}
                aria-label={option.label}
                aria-pressed={option.value === water.accent}
                title={option.label}
                onClick={() => setWater({ accent: option.value })}
              />
            </li>
          ))}
          <li>
            <label
              className={cx('swatch', 'swatch--custom', !isPreset && 'is-selected')}
              style={isPreset || !water.accent ? undefined : ({ '--swatch': waterAccentStops(water.accent).dark1 } as CSSProperties)}
              title="직접 고르기"
            >
              <input
                type="color"
                defaultValue={water.accent ?? INK}
                aria-label="강조색 직접 고르기"
                onChange={(e) => onCustomColor(e.target.value)}
              />
              <Pipette size={14} aria-hidden />
            </label>
          </li>
        </ul>

        {/* 지금 강조색으로 칠한 실제 물 부품 */}
        <div className="water-accent-preview">
          <WaterSegmented
            options={[
              { value: 'on', label: '고른 것' },
              { value: 'off', label: '다른 것' },
            ]}
            value={sample}
            onChange={setSample}
            ariaLabel="강조색 미리보기"
            size="sm"
          />
          <WaterButton size="sm" icon={Plus}>
            주요 버튼
          </WaterButton>
        </div>
      </div>
    </WaterCard>
  )
}

/**
 * 유리 효과 — 물 유리 판의 깊이(떨어지는 그림자)·테두리(가장자리·안쪽 그림자) 진하기, 판 색(불투명 판 바탕)·유리
 * 농도(판에 덮는 흰빛). 프리셋은 깊이·테두리만 바꾼다.
 */
export function WaterEffectCard() {
  const { water, setWater } = useAppearance()
  const preset = matchWaterPreset(water)
  return (
    <WaterCard
      title="유리 효과"
      actions={preset === null ? <WaterStatusPill tone="neutral">사용자 지정</WaterStatusPill> : null}
    >
      <div className="glass-presets" role="group" aria-label="유리 효과 프리셋">
        {WATER_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={cx('glass-preset', preset === p.value && 'is-selected')}
            aria-pressed={preset === p.value}
            onClick={() => setWater({ depth: p.depth, rim: p.rim })}
          >
            {/* 그 프리셋 값으로 칠한 작은 유리 판 */}
            <span className="water-effect-sample" aria-hidden>
              <span
                className="water-effect-sample__chip"
                style={{ '--w-depth': p.depth, '--w-rim': p.rim } as CSSProperties}
              />
            </span>
            <span className="glass-preset__label">
              <strong>{p.label}</strong>
              <span>{p.description}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="water-effect-sliders">
        <WaterRange
          label="깊이"
          hint="판이 벽에서 얼마나 떠 보일지(그림자)"
          value={Math.round(water.depth * 100)}
          min={WATER_LIMITS.depth.min * 100}
          max={WATER_LIMITS.depth.max * 100}
          step={10}
          format={(v) => `${v}%`}
          onChange={(v) => setWater({ depth: v / 100 })}
        />
        <WaterRange
          label="테두리"
          hint="유리 가장자리와 안쪽 그림자의 진하기"
          value={Math.round(water.rim * 100)}
          min={WATER_LIMITS.rim.min * 100}
          max={WATER_LIMITS.rim.max * 100}
          step={10}
          format={(v) => `${v}%`}
          onChange={(v) => setWater({ rim: v / 100 })}
        />
        <div className="water-effect-field">
          <p className="water-effect-field__label">판 색</p>
          <WaterSegmented
            options={WATER_PANES}
            value={water.pane}
            onChange={(pane) => setWater({ pane })}
            ariaLabel="판 색"
            size="sm"
          />
          <p className="water-effect-field__hint">서랍·팝업·알림처럼 내용을 가리는 판의 바탕색</p>
        </div>
        <WaterRange
          label="유리 농도"
          hint="판에 덮는 흰빛 — 높을수록 밝고 뿌옇게"
          value={Math.round(water.frost * 100)}
          min={WATER_LIMITS.frost.min * 100}
          max={WATER_LIMITS.frost.max * 100}
          step={5}
          format={(v) => `${v}%`}
          onChange={(v) => setWater({ frost: v / 100 })}
        />
      </div>
    </WaterCard>
  )
}
