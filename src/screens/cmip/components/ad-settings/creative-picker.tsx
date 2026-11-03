import { useEffect, useState } from 'react'
import type { AdCreativeView } from '../../client'
import type { AdCreativesState } from '../../view-model/use-ad-creatives'

const lengthLabel = (c: AdCreativeView) =>
  c.kind === 'image'
    ? '이미지'
    : c.media?.lengthSec != null
      ? `영상 ${Math.round(c.media.lengthSec)}초`
      : '영상'

const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${m}/${d}`
}

/** 소재 하나 크게 — 원본(영상은 재생)과 분석용 프레임 전부, 쓴 광고. */
function CreativePreview({
  creative,
  onClose,
}: {
  creative: AdCreativeView
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const media = creative.media
  return (
    <div className="ad-creative-modal" onClick={onClose}>
      <div
        className="ad-creative-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label="소재 보기"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ad-creative-modal__head">
          <div>
            <h4>{creative.ads[0]?.name || creative.id}</h4>
            <span>
              {lengthLabel(creative)}
              {media?.width && media.height
                ? ` · ${media.width}×${media.height}`
                : ''}
              {` · ${creative.active ? '집행 중' : `마지막 집행 ${shortDate(creative.lastSeenDate)}`}`}
            </span>
          </div>
          <button
            type="button"
            className="ad-creative-modal__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        {media?.originalUrl ? (
          creative.kind === 'video' ? (
            <video
              className="ad-creative-modal__original"
              src={media.originalUrl}
              poster={media.thumbnailUrl ?? undefined}
              controls
              playsInline
            />
          ) : (
            <img
              className="ad-creative-modal__original"
              src={media.originalUrl}
              alt=""
            />
          )
        ) : (
          <p className="ad-results__note">
            {creative.status === 'failed'
              ? `파일을 받지 못했습니다 — ${creative.error ?? ''}`
              : '아직 내려받는 중입니다(다음 동기화에 처리됩니다).'}
          </p>
        )}

        {media && media.frames.length > 1 && (
          <section className="ad-creative-modal__frames">
            <h5>
              분석용 프레임 <span>{media.frames.length}장</span>
            </h5>
            <ol>
              {media.frames.map((f) => (
                <li key={f.t}>
                  {f.url && <img src={f.url} alt="" loading="lazy" />}
                  <span>{f.t}초</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {creative.ads.length > 0 && (
          <section className="ad-creative-modal__ads">
            <h5>
              이 소재를 쓴 광고 <span>{creative.ads.length}개</span>
            </h5>
            <ul>
              {creative.ads.map((ad) => (
                <li key={ad.id}>{ad.name || ad.id}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

/**
 * 광고 설정 편집기의 소재 칸 — 이 캠페인·광고셋에서 쓰인 저장 소재(매체에서
 * 가져온 이미지·영상)를 카드로 보여 주고, 이 장에서 돌린 소재를 고른다. 집행
 * 중인 소재가 먼저 오고 지난 소재는 흐리게.
 */
export function CreativePicker({
  state,
  selected,
  onToggle,
}: {
  state: AdCreativesState
  selected: readonly string[]
  onToggle: (id: string) => void
}) {
  const [preview, setPreview] = useState<AdCreativeView | null>(null)

  if (state.status === 'loading')
    return <p className="ad-results__note">소재를 불러오는 중…</p>
  if (state.status === 'error')
    return (
      <p className="ad-results__note">
        소재를 불러오지 못했습니다 — {state.error}
      </p>
    )

  const creatives = state.creatives
  const known = new Set(creatives.map((c) => c.id))
  const missing = selected.filter((id) => !known.has(id)).length
  const active = creatives.filter((c) => c.active).length

  return (
    <section className="ad-creatives" aria-label="소재">
      <div className="ad-creatives__head">
        <h4>소재</h4>
        <span className="ad-results__hint">
          집행 중 {active} · 지난 소재 {creatives.length - active} · 고른 것{' '}
          {selected.length}
          {missing > 0 && ` (목록에 없는 ${missing}개 포함)`}
        </span>
        {/* 직접 올리기 — 다음 단계(매체에서 못 가져오는 Google 영상 등). */}
        <button type="button" className="ad-button is-small" disabled>
          + 직접 올리기 (준비 중)
        </button>
      </div>

      {creatives.length === 0 ? (
        <p className="ad-results__note">
          이 대상에서 가져온 소재가 없습니다. 지금은 Meta·당근 소재를 하루 여섯
          번 가져옵니다.
        </p>
      ) : (
        <ul className="ad-creatives__grid">
          {creatives.map((c) => {
            const isSelected = selected.includes(c.id)
            return (
              <li
                key={c.id}
                className={`ad-creative${c.active ? '' : ' is-past'}${isSelected ? ' is-selected' : ''}`}
              >
                <button
                  type="button"
                  className="ad-creative__thumb"
                  onClick={() => setPreview(c)}
                  aria-label="크게 보기"
                >
                  {c.media?.thumbnailUrl ? (
                    <img src={c.media.thumbnailUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="ad-creative__empty">
                      {c.status === 'failed' ? '받지 못함' : '처리 중'}
                    </span>
                  )}
                  <span className="ad-creative__kind">{lengthLabel(c)}</span>
                </button>
                <label className="ad-creative__pick">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(c.id)}
                  />
                  <span>
                    {c.active ? '집행 중' : `~${shortDate(c.lastSeenDate)}`}
                  </span>
                </label>
                <span className="ad-creative__name" title={c.ads[0]?.name}>
                  {c.ads[0]?.name || c.id}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {preview && (
        <CreativePreview creative={preview} onClose={() => setPreview(null)} />
      )}
    </section>
  )
}
