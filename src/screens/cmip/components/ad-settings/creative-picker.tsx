import { useEffect, useRef, useState } from 'react'
import {
  analyzeCreative,
  CREATIVE_UPLOAD_MAX_MB,
  CREATIVE_UPLOAD_TYPES,
  deleteAdCreativeUpload,
  uploadAdCreative,
  type AdCreativeView,
  type AdEntityKey,
  type CreativeAnalysis,
} from '../../client'
import {
  addCachedCreative,
  changeCachedCreatives,
  type AdCreativesState,
} from '../../view-model/use-ad-creatives'

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

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

/** 카드·창의 집행 표시 — 직접 올린 것은 올린 날. */
const seenLabel = (c: AdCreativeView) =>
  c.upload
    ? `직접 올림 ${shortDate(c.lastSeenDate)}`
    : c.active
      ? '집행 중'
      : `~${shortDate(c.lastSeenDate)}`

const STRENGTH_LABEL: Record<string, string> = {
  strong: '강함',
  medium: '보통',
  weak: '약함',
}

/** 분석 결과 — 퍼셉트론 게시본 프롬프트로 Claude가 본 것. 프레임 수만큼
 * 비용이 들어(영상 30장이면 약 $0.2) 누를 때만 돈다. */
function CreativeAnalysisPanel({
  creative,
  onAnalyzed,
}: {
  creative: AdCreativeView
  onAnalyzed: (analysis: CreativeAnalysis) => void
}) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const analysis = creative.analysis
  const canRun = creative.status === 'ready' && !running

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      onAnalyzed(await analyzeCreative(creative.id))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setRunning(false)
    }
  }

  const r = analysis?.status === 'done' ? analysis.result : null
  const rows: [string, string][] = r
    ? [
        ['주제', r.topic],
        [
          '훅',
          `${r.hook.technique} · ${STRENGTH_LABEL[r.hook.strength] ?? r.hook.strength} — ${r.hook.firstSeconds}`,
        ],
        ['핵심 메시지', r.message],
        ['톤', r.tone],
        ['대상', r.persona],
        ['CTA', r.cta],
        ['형식', r.format],
      ]
    : []

  return (
    <section className="ad-creative-modal__analysis">
      <div className="ad-creative-modal__analysis-head">
        <h5>
          분석{' '}
          {analysis && (
            <span>
              {analysis.caseTitle} · 망 v{analysis.graphVersion}
              {analysis.model ? ` · ${analysis.model}` : ''}
              {analysis.costUsd != null
                ? ` · $${analysis.costUsd.toFixed(3)}`
                : ''}
            </span>
          )}
        </h5>
        <button
          type="button"
          className="ad-button is-small is-primary"
          onClick={run}
          disabled={!canRun}
        >
          {running ? '분석 중… (수십 초)' : analysis ? '다시 분석' : '분석하기'}
        </button>
      </div>
      {error && (
        <p className="ad-results__note">분석하지 못했습니다 — {error}</p>
      )}
      {!analysis && !error && (
        <p className="ad-results__note">
          퍼셉트론에 게시한 프롬프트(CREATIVE ANALYSIS)로 Claude가 프레임을 보고
          주제·훅·메시지를 정리합니다.
        </p>
      )}
      {analysis?.status === 'hold' && (
        <p className="ad-results__note">
          게이트가 사람 검토로 보냈습니다(신뢰도가 기준보다 낮아 Claude를 부르지
          않았습니다).
        </p>
      )}
      {analysis?.status === 'failed' && (
        <p className="ad-results__note">실패 — {analysis.error}</p>
      )}
      {r && (
        <>
          <p className="ad-creative-modal__summary">{r.summary}</p>
          <dl className="ad-creative-modal__facts">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <details className="ad-creative-modal__detail">
            <summary>퍼셉트론 출력 원문</summary>
            <pre>{r.detail}</pre>
          </details>
        </>
      )}
    </section>
  )
}

/** 직접 올린 소재 지우기 — 한 번 더 눌러야 지운다. 저장한 장에 들어 있으면
 * 서버가 거절한다(그 장의 기록이 이 소재를 가리킨다). */
function DeleteUpload({
  creative,
  onDeleted,
}: {
  creative: AdCreativeView
  onDeleted: () => void
}) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const remove = async () => {
    setStep('deleting')
    setError(null)
    try {
      await deleteAdCreativeUpload(creative.id)
      onDeleted()
    } catch (err) {
      setError(errorText(err))
      setStep('idle')
    }
  }
  return (
    <div className="ad-creative-modal__delete">
      {error && <span className="ad-results__note">{error}</span>}
      {step === 'confirm' ? (
        <>
          <button
            type="button"
            className="ad-button is-small"
            onClick={() => setStep('idle')}
          >
            그만두기
          </button>
          <button
            type="button"
            className="ad-button is-small is-danger"
            onClick={remove}
          >
            정말 지우기
          </button>
        </>
      ) : (
        <button
          type="button"
          className="ad-button is-small"
          onClick={() => setStep('confirm')}
          disabled={step === 'deleting'}
        >
          {step === 'deleting' ? '지우는 중…' : '이 소재 지우기'}
        </button>
      )}
    </div>
  )
}

/** 소재 하나 크게 — 원본(영상은 재생)과 분석, 분석용 프레임 전부, 쓴 광고. */
function CreativePreview({
  creative,
  onClose,
  onAnalyzed,
  onDeleted,
}: {
  creative: AdCreativeView
  onClose: () => void
  onAnalyzed: (analysis: CreativeAnalysis) => void
  onDeleted: () => void
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
            <h4>{creative.name}</h4>
            <span>
              {lengthLabel(creative)}
              {media?.width && media.height
                ? ` · ${media.width}×${media.height}`
                : ''}
              {creative.upload
                ? ` · ${seenLabel(creative)}${creative.upload.uploadedBy ? ` (${creative.upload.uploadedBy})` : ''}`
                : ` · ${creative.active ? '집행 중' : `마지막 집행 ${shortDate(creative.lastSeenDate)}`}`}
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

        <CreativeAnalysisPanel creative={creative} onAnalyzed={onAnalyzed} />

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

        {creative.upload && (
          <DeleteUpload creative={creative} onDeleted={onDeleted} />
        )}
      </div>
    </div>
  )
}

/** 올리는 중인 파일 — sent는 보낸 비율, 1이면 서버가 프레임을 뽑는 중. */
interface UploadState {
  name: string
  sent: number
}

/**
 * 광고 설정 편집기의 소재 칸 — 이 캠페인·광고셋에서 쓰인 저장 소재(매체에서
 * 가져왔거나 직접 올린 이미지·영상)를 카드로 보여 주고, 이 장에서 돌린 소재를
 * 고른다. 집행 중인 소재가 먼저 오고 지난 소재는 흐리게. 매체에서 못 가져오는
 * 소재(Google 유튜브 영상 등)는 여기서 직접 올린다.
 */
export function CreativePicker({
  entityKey,
  state,
  selected,
  onToggle,
  onUploaded,
  onDeleted,
}: {
  entityKey: AdEntityKey
  state: AdCreativesState
  selected: readonly string[]
  onToggle: (id: string) => void
  /** 방금 올린 소재 — 편집기가 이 장에 바로 고른다. */
  onUploaded: (id: string) => void
  /** 지운 소재 — 편집기가 고른 것에서 뺀다. */
  onDeleted: (id: string) => void
}) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  // 이 화면에서 방금 분석·올리기·지운 것 — 목록을 다시 받지 않고 카드·창에 바로
  // 보인다(받아 둔 목록에도 넣어서 편집기를 다시 열어도 보인다).
  const [analyzed, setAnalyzed] = useState<Record<string, CreativeAnalysis>>({})
  const [added, setAdded] = useState<AdCreativeView[]>([])
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(new Set())
  const [upload, setUpload] = useState<UploadState | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const startUpload = async (file: File) => {
    setUploadError(null)
    const kind = CREATIVE_UPLOAD_TYPES[file.type]
    if (!kind) {
      setUploadError(
        'JPG·PNG·WebP·GIF 이미지나 MP4·MOV·WebM 영상만 올릴 수 있습니다',
      )
      return
    }
    const maxMb = CREATIVE_UPLOAD_MAX_MB[kind]
    if (file.size > maxMb * 1024 * 1024) {
      setUploadError(
        `${kind === 'video' ? '영상' : '이미지'}은 ${maxMb}MB까지 올릴 수 있습니다`,
      )
      return
    }
    setUpload({ name: file.name, sent: 0 })
    try {
      const creative = await uploadAdCreative(entityKey, file, (sent) =>
        setUpload({ name: file.name, sent }),
      )
      setAdded((prev) => [
        creative,
        ...prev.filter((c) => c.id !== creative.id),
      ])
      addCachedCreative(entityKey, creative)
      onUploaded(creative.id)
    } catch (err) {
      setUploadError(`${file.name} — ${errorText(err)}`)
    } finally {
      setUpload(null)
    }
  }

  if (state.status === 'loading')
    return <p className="ad-results__note">소재를 불러오는 중…</p>
  if (state.status === 'error')
    return (
      <p className="ad-results__note">
        소재를 불러오지 못했습니다 — {state.error}
      </p>
    )

  const listed = new Set(state.creatives.map((c) => c.id))
  const creatives = [
    ...added.filter((c) => !listed.has(c.id)),
    ...state.creatives,
  ]
    .filter((c) => !deleted.has(c.id))
    .map((c) => (analyzed[c.id] ? { ...c, analysis: analyzed[c.id] } : c))
  const preview = creatives.find((c) => c.id === previewId) ?? null
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
        <input
          ref={fileInput}
          type="file"
          accept={Object.keys(CREATIVE_UPLOAD_TYPES).join(',')}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void startUpload(file)
          }}
        />
        <button
          type="button"
          className="ad-button is-small"
          onClick={() => fileInput.current?.click()}
          disabled={upload !== null}
        >
          {upload
            ? upload.sent < 1
              ? `올리는 중 ${Math.round(upload.sent * 100)}%`
              : '프레임 뽑는 중…'
            : '+ 직접 올리기'}
        </button>
      </div>
      {upload && (
        <p className="ad-results__note">
          {upload.name} —{' '}
          {upload.sent < 1
            ? '파일을 보내는 중입니다.'
            : '분석용 프레임을 뽑고 있습니다(영상은 수십 초).'}{' '}
          창을 닫지 마세요.
        </p>
      )}
      {uploadError && (
        <p className="ad-results__note">올리지 못했습니다 — {uploadError}</p>
      )}

      {creatives.length === 0 ? (
        <p className="ad-results__note">
          이 대상의 소재가 없습니다. Meta·당근 소재는 하루 여섯 번 자동으로
          가져오고, Google·네이버·OpenAI 소재는 직접 올려 주세요.
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
                  onClick={() => setPreviewId(c.id)}
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
                  {c.analysis?.status === 'done' && (
                    <span className="ad-creative__analyzed">분석됨</span>
                  )}
                </button>
                <label className="ad-creative__pick">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(c.id)}
                  />
                  <span>{seenLabel(c)}</span>
                </label>
                <span className="ad-creative__name" title={c.name}>
                  {c.name}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {preview && (
        <CreativePreview
          creative={preview}
          onClose={() => setPreviewId(null)}
          onAnalyzed={(analysis) => {
            setAnalyzed((prev) => ({ ...prev, [preview.id]: analysis }))
            changeCachedCreatives((list) =>
              list.map((c) => (c.id === preview.id ? { ...c, analysis } : c)),
            )
          }}
          onDeleted={() => {
            setDeleted((prev) => new Set(prev).add(preview.id))
            changeCachedCreatives((list) =>
              list.filter((c) => c.id !== preview.id),
            )
            setPreviewId(null)
            onDeleted(preview.id)
          }}
        />
      )}
    </section>
  )
}
