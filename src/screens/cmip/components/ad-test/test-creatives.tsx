import type { CSSProperties } from 'react'
import type { AdCreativeView } from '../../client'
import type { AdCreativesState } from '../../view-model/use-ad-creatives'
import {
  lengthLabel,
  seenLabel,
  STRENGTH_LABEL,
} from '../ad-settings/creative-labels'
import type { SettingSegment } from './changes'
import { segmentColor } from './palette'

type ById = ReadonlyMap<string, AdCreativeView>

/** 썸네일 한 칸 — 목록에 없거나(지운 소재 등) 아직 처리 중이면 글자로. */
const Thumb = ({
  id,
  creative,
  loading,
}: {
  id: string
  creative: AdCreativeView | undefined
  loading: boolean
}) =>
  creative?.media?.thumbnailUrl ? (
    <img src={creative.media.thumbnailUrl} alt="" loading="lazy" />
  ) : (
    <span className="ad-test-thumb__empty" title={creative ? undefined : id}>
      {loading
        ? ''
        : !creative
          ? '없음'
          : creative.status === 'failed'
            ? '받지 못함'
            : '처리 중'}
    </span>
  )

/**
 * 구간 카드의 소재 줄 — 그 장에 고른 소재. 바로 앞 설정에 없던 것은 "새로",
 * 앞 설정에 있었는데 뺀 것은 흐리게 뒤에 붙인다(처음 넣은 장은 표시하지 않는다).
 */
export function SegmentCreatives({
  segment,
  byId,
  loading,
  onOpen,
}: {
  segment: SettingSegment
  byId: ById
  loading: boolean
  onOpen: (id: string) => void
}) {
  const ids = segment.setting?.creativeIds ?? []
  const event = segment.event
  const before = event && !event.first ? event.creatives.before : null
  const removed = before ? before.filter((id) => !ids.includes(id)) : []
  if (ids.length === 0 && removed.length === 0) return null

  const item = (id: string, mark: 'new' | 'removed' | null) => {
    const creative = byId.get(id)
    return (
      <li
        key={`${mark ?? ''}${id}`}
        className={mark ? `is-${mark}` : undefined}
      >
        <button
          type="button"
          className="ad-test-thumb"
          onClick={() => onOpen(id)}
          disabled={!creative}
          title={creative?.name ?? '목록에 없는 소재'}
          aria-label={`${creative?.name ?? '소재'} 크게 보기`}
        >
          <Thumb id={id} creative={creative} loading={loading} />
          {creative?.analysis?.status === 'done' && (
            <i className="ad-test-thumb__analyzed" aria-label="분석됨" />
          )}
        </button>
        {mark && (
          <span className="ad-test-period__mark">
            {mark === 'new' ? '새로' : '뺌'}
          </span>
        )}
      </li>
    )
  }

  return (
    <div className="ad-test-period__creatives">
      <span className="ad-test-period__creatives-label">
        소재 {ids.length}개
      </span>
      <ul>
        {ids.map((id) =>
          item(id, before && !before.includes(id) ? 'new' : null),
        )}
        {removed.map((id) => item(id, 'removed'))}
      </ul>
    </div>
  )
}

/** 분석 전·보류·실패일 때 한 줄. */
const pendingText = (c: AdCreativeView) =>
  c.status !== 'ready'
    ? c.status === 'failed'
      ? `파일을 받지 못했습니다 — ${c.error ?? ''}`
      : '아직 내려받는 중입니다(다음 동기화에 처리됩니다).'
    : !c.analysis
      ? '분석 전 — 눌러서 분석합니다.'
      : c.analysis.status === 'hold'
        ? '게이트가 사람 검토로 보냈습니다.'
        : `분석 실패 — ${c.analysis.error ?? ''}`

/**
 * 구간들에 고른 소재를 한 번씩 — 어느 구간에 돌았는지와 분석 요약(주제·훅·
 * 메시지). 구간마다 바뀐 소재가 무엇이었는지 성과와 견줄 때 본다. 누르면 크게
 * 보고, 분석하지 않았으면 거기서 분석한다.
 */
export function TestCreatives({
  segments,
  state,
  byId,
  onOpen,
}: {
  segments: readonly SettingSegment[]
  state: AdCreativesState | null
  byId: ById
  onOpen: (id: string) => void
}) {
  // 처음 고른 구간 순서대로, 소재마다 돈 구간들.
  const runs = new Map<string, number[]>()
  segments.forEach((segment, i) => {
    for (const id of segment.setting?.creativeIds ?? [])
      runs.set(id, [...(runs.get(id) ?? []), i])
  })

  if (runs.size === 0 || !state)
    return (
      <p className="ad-test-creatives__note">
        구간에 고른 소재가 없습니다 — 광고 설정에서 장마다 돌린 소재를 고르면
        여기서 구간과 함께 소재 내용(분석)을 봅니다.
      </p>
    )
  if (state.status === 'loading')
    return <p className="ad-test-creatives__note">소재를 불러오는 중…</p>
  if (state.status === 'error')
    return (
      <p className="ad-test-creatives__note">
        소재를 불러오지 못했습니다 — {state.error}
      </p>
    )

  return (
    <ul className="ad-test-creatives">
      {[...runs].map(([id, segmentIndexes]) => {
        const c = byId.get(id)
        const r = c?.analysis?.status === 'done' ? c.analysis.result : null
        return (
          <li key={id} className="ad-test-creative">
            <button
              type="button"
              className="ad-test-thumb is-large"
              onClick={() => onOpen(id)}
              disabled={!c}
              aria-label={`${c?.name ?? '소재'} 크게 보기`}
            >
              <Thumb id={id} creative={c} loading={false} />
            </button>
            <div className="ad-test-creative__body">
              <div className="ad-test-creative__head">
                <b title={c?.name ?? id}>
                  {c?.name ?? `목록에 없는 소재 (${id})`}
                </b>
                {c && (
                  <span>
                    {lengthLabel(c)} · {seenLabel(c)}
                  </span>
                )}
              </div>
              <div className="ad-test-creative__segments">
                {segmentIndexes.map((i) => (
                  <span
                    key={i}
                    style={{ '--seg-color': segmentColor(i) } as CSSProperties}
                  >
                    <i />
                    {segments[i].label}
                  </span>
                ))}
              </div>
              {r ? (
                <dl className="ad-test-creative__facts">
                  <div>
                    <dt>주제</dt>
                    <dd>{r.topic}</dd>
                  </div>
                  <div>
                    <dt>훅</dt>
                    <dd>
                      {r.hook.technique} ·{' '}
                      {STRENGTH_LABEL[r.hook.strength] ?? r.hook.strength}
                    </dd>
                  </div>
                  <div>
                    <dt>메시지</dt>
                    <dd>{r.message}</dd>
                  </div>
                </dl>
              ) : (
                c && (
                  <button
                    type="button"
                    className="ad-test-creative__pending"
                    onClick={() => onOpen(id)}
                  >
                    {pendingText(c)}
                  </button>
                )
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
