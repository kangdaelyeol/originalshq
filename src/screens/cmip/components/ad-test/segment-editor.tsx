import type { CSSProperties } from 'react'
import { dateRange, formatMD } from '../../utils'
import type { AdTestSegment } from '../../client'
import { segmentColor } from './palette'

/**
 * 구간 편집 — 이름·시작·끝·메모. 구간이 겹치면(같은 날이 두 구간에) 알려 준다
 * (막지는 않는다 — 일부러 겹쳐 보고 싶을 때도 있어서). 아래 버튼으로 한 번에
 * 다시 나눈다: 설정 바뀐 날마다 / 고르게 2·3·4개.
 */
export function SegmentEditor({
  segments,
  canSplitBySettings,
  onUpdate,
  onRemove,
  onAdd,
  onBySettings,
  onEven,
}: {
  segments: readonly AdTestSegment[]
  canSplitBySettings: boolean
  onUpdate: (id: string, patch: Partial<AdTestSegment>) => void
  onRemove: (id: string) => void
  onAdd: () => void
  onBySettings: () => void
  onEven: (n: number) => void
}) {
  const overlaps = segments.some((s, i) =>
    segments.some((o, j) => j !== i && s.start <= o.end && o.start <= s.end),
  )
  return (
    <div className="ad-test-segments">
      <ol className="ad-test-segments__list">
        {segments.map((s, i) => (
          <li
            key={s.id}
            className="ad-test-segment"
            style={
              {
                '--seg-color': segmentColor(i),
                '--glass-i': i,
              } as CSSProperties
            }
          >
            <span className="ad-test-segment__dot" aria-hidden="true" />
            <input
              className="ad-input ad-test-segment__label"
              value={s.label}
              aria-label="구간 이름"
              maxLength={30}
              onChange={(e) => onUpdate(s.id, { label: e.target.value })}
            />
            <input
              className="ad-input"
              type="date"
              value={s.start}
              aria-label="시작일"
              onChange={(e) =>
                e.target.value && onUpdate(s.id, { start: e.target.value })
              }
            />
            <span className="ad-test-segment__tilde">~</span>
            <input
              className="ad-input"
              type="date"
              value={s.end}
              aria-label="끝날"
              onChange={(e) =>
                e.target.value && onUpdate(s.id, { end: e.target.value })
              }
            />
            <span className="ad-test-segment__days">
              {s.end >= s.start ? dateRange(s.start, s.end).length : 0}일
            </span>
            <input
              className="ad-input ad-test-segment__note"
              value={s.note}
              placeholder="이 구간에 무엇이 달랐나(소재 B안, 예산 증액 등)"
              maxLength={300}
              onChange={(e) => onUpdate(s.id, { note: e.target.value })}
            />
            <button
              type="button"
              className="ad-button is-small"
              aria-label={`${s.label} 빼기`}
              onClick={() => onRemove(s.id)}
            >
              빼기
            </button>
          </li>
        ))}
      </ol>
      {overlaps && (
        <p className="ad-test-segments__warn">
          겹치는 날이 있는 구간이 있습니다 — 그 날은 두 구간에 모두 들어갑니다.
        </p>
      )}
      <div className="ad-test-segments__actions">
        <button
          type="button"
          className="ad-button is-small"
          onClick={onAdd}
          disabled={segments.length >= 12}
        >
          구간 추가
        </button>
        <button
          type="button"
          className="ad-button is-small"
          onClick={onBySettings}
          disabled={!canSplitBySettings}
          title={
            canSplitBySettings ? undefined : '이 범위에 설정 바뀐 날이 없습니다'
          }
        >
          설정 바뀐 날로 나누기
        </button>
        <span className="ad-test-segments__even">
          고르게
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              className="ad-button is-small"
              onClick={() => onEven(n)}
            >
              {n}개
            </button>
          ))}
        </span>
        {segments.length > 0 && (
          <span className="ad-test-segments__range">
            전체 {formatMD(segments[0].start)} ~{' '}
            {formatMD(
              segments.reduce(
                (m, s) => (s.end > m ? s.end : m),
                segments[0].end,
              ),
            )}
          </span>
        )}
      </div>
    </div>
  )
}
