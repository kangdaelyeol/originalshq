import { useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import {
  COLUMNS,
  GATE,
  HEAD_ID,
  type Answer,
  type Graph,
  type NodeDef,
  type NodeRow,
} from './data'
import { useEngine, type Engine } from './engine'
import {
  listAnalyzableAds,
  previewAdPrompt,
  previewPrompt,
  type AdListItem,
  type AdPreviewResult,
} from './graph-client'
import {
  editNode,
  fallbackResult,
  fmtTokens,
  fmtUsd,
  removeNode,
  setCaseAnswer,
  setCaseLine,
  setCaseOutTokens,
  setCaseResult,
  setPathStep,
  useModel,
  type GraphStore,
} from './model'

const Field = ({
  label,
  hint,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
}) => (
  <div className="pn-insp__field">
    <span className="pn-insp__label">{label}</span>
    {children}
    {hint && <p className="pn-insp__hint">{hint}</p>}
  </div>
)

/**
 * 실제 소재로 만들어 보기 — 집행 중인 Meta 광고를 하나 골라, 지금 케이스의
 * 경로로 그 광고의 실제 값(영상·문구·타겟팅·14일 성과·광고 설정·테스트)을 넣은
 * 프롬프트를 서버에서 만든다. Claude는 부르지 않는다.
 */
function AdPreview({ graph, caseId }: { graph: Graph; caseId: number }) {
  const [ads, setAds] = useState<AdListItem[] | null>(null)
  const [adId, setAdId] = useState('')
  const [busy, setBusy] = useState<'list' | 'preview' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AdPreviewResult | null>(null)

  const loadAds = async () => {
    setBusy('list')
    setError(null)
    try {
      const { ads } = await listAnalyzableAds()
      // 영상 소재부터.
      const sorted = [...ads].sort(
        (a, b) => Number(b.hasVideo) - Number(a.hasVideo),
      )
      setAds(sorted)
      setAdId(sorted[0]?.adId ?? '')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '광고 목록을 받지 못했습니다',
      )
    }
    setBusy(null)
  }

  const run = async () => {
    if (!adId) return
    setBusy('preview')
    setError(null)
    try {
      setResult(await previewAdPrompt(graph, adId, [caseId]))
    } catch (err) {
      setError(err instanceof Error ? err.message : '미리보기에 실패했습니다')
    }
    setBusy(null)
  }

  const got = result?.cases[0]
  return (
    <div className="pn-insp__ad">
      {ads === null ? (
        <button
          type="button"
          className="pn-insp__ghost"
          disabled={busy !== null}
          onClick={() => void loadAds()}
        >
          {busy === 'list' ? '광고 불러오는 중…' : '집행 중인 광고 불러오기'}
        </button>
      ) : (
        <div className="pn-insp__row">
          <select value={adId} onChange={(e) => setAdId(e.target.value)}>
            {ads.map((a) => (
              <option key={a.adId} value={a.adId}>
                {a.hasVideo ? '[영상] ' : '[이미지] '}
                {a.adName} · {a.adsetName}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="pn-insp__primary"
            disabled={!adId || busy !== null}
            onClick={() => void run()}
          >
            {busy === 'preview' ? '만드는 중…' : '이 소재로 만들기'}
          </button>
        </div>
      )}
      {error && <p className="pn-insp__server is-error">{error}</p>}
      {result && got && (
        <>
          <div className="pn-insp__adhead">
            {result.ad.thumbnailUrl && (
              <img src={result.ad.thumbnailUrl} alt="" loading="lazy" />
            )}
            <div>
              <b>{result.ad.name}</b>
              <span>
                {result.ad.hasVideo
                  ? `영상 · 프레임 ${result.ad.frameTimes.length}장`
                  : '이미지'}{' '}
                · 입력 {fmtTokens(got.cost.inTokens)} tok · 응답 ≈{' '}
                {fmtTokens(got.cost.outTokens)} tok ·{' '}
                {got.hold ? '보류 $0' : fmtUsd(got.cost.total)}
              </span>
            </div>
          </div>
          {got.missing.length > 0 && (
            <p className="pn-insp__server is-diff">
              값이 없어 '—'로 둔 자리: {got.missing.join(', ')}
            </p>
          )}
          {result.notes.map((n) => (
            <p key={n} className="pn-insp__hint">
              · {n}
            </p>
          ))}
          <pre className="pn-insp__prompt">{got.prompt.join('\n')}</pre>
        </>
      )}
    </div>
  )
}

/** 카드에 보이는 값 줄은 3줄까지(카드 높이). */
const MAX_CARD_ROWS = 3

/**
 * 고른 노드의 편집 패널 — 제목·카드 값·프롬프트 조각을 고치고, 지금 케이스가
 * 이 노드를 지나게 하거나 노드를 지운다. 출력 노드의 칸이면 칸의 기본 줄과
 * 이 케이스만의 줄을, 머리 칸이면 지금 케이스의 프롬프트 전체를 보여 준다.
 * 고친 내용은 바로 망·프롬프트에 반영되고 이 브라우저에 저장된다.
 */
export function Inspector({
  ref,
  store,
  engine,
  id,
  onClose,
  onSelect,
  onReplay,
}: {
  ref: Ref<HTMLElement>
  store: GraphStore
  engine: Engine
  id: string
  onClose: () => void
  onSelect: (id: string) => void
  /** 지금 케이스를 처음부터 다시 재생(편집 패널은 닫는다). */
  onReplay: () => void
}) {
  const model = useModel()
  const slot = useEngine(engine, (s) => s.slot)
  const [confirm, setConfirm] = useState<'delete' | 'reset' | null>(null)
  const [copied, setCopied] = useState(false)
  // 서버(소재 분석 API와 같은 코드)에서 만든 프롬프트가 화면과 같은지.
  const [server, setServer] = useState<{
    state: 'idle' | 'loading' | 'same' | 'diff' | 'error'
    text?: string
  }>({ state: 'idle' })
  const at = model.nodes.get(id)
  if (!at) return null

  const { node, col } = at
  const column = COLUMNS[col]
  const view = model.cases[slot]
  const c = view.def
  const isHead = id === HEAD_ID
  const isSection = col === 4 && !isHead
  const onPath = c.path[col] === id
  const sections = model.graph.layers[4].filter((s) => s.id !== HEAD_ID)
  const layer = model.graph.layers[col]
  const canDelete = !isHead && layer.length > 1

  const edit = (patch: Partial<NodeDef>) =>
    store.update((g) => editNode(g, id, patch))
  const answer = c.answers[id]
  const setAnswer = (a: Answer | null) =>
    store.update((g) => setCaseAnswer(g, slot, id, a))
  const setRow = (i: number, row: NodeRow) =>
    edit({ rows: node.rows.map((r, k) => (k === i ? row : r)) })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(view.prompt.join('\n'))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  const checkServer = async () => {
    setServer({ state: 'loading' })
    try {
      const res = await previewPrompt(model.graph, [c.id])
      const got = res.cases[0]
      const same =
        !!got &&
        got.prompt.join('\n') === view.prompt.join('\n') &&
        Math.abs(got.cost.total - view.cost.total) < 1e-9 &&
        got.hold === view.hold
      setServer(
        same
          ? {
              state: 'same',
              text: `서버와 같습니다 — 프롬프트 ${got.prompt.length}줄 · ${fmtUsd(got.cost.total)} (Claude 호출 없음)`,
            }
          : {
              state: 'diff',
              text: '서버 결과가 화면과 다릅니다 — 서버에 배포된 코드가 이 화면보다 오래됐을 수 있습니다',
            },
      )
    } catch (err) {
      setServer({
        state: 'error',
        text: `서버에 닿지 않습니다 — ${err instanceof Error ? err.message : '알 수 없는 오류'} (functions-cmip previewPrompt 배포 필요)`,
      })
    }
  }

  return (
    <aside
      ref={ref}
      className="pn-insp"
      style={{ '--col': column.color, '--case': c.color } as CSSProperties}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="pn-insp__head">
        <span>
          <i />
          {column.num} {column.title}
        </span>
        <button
          type="button"
          className="pn-insp__close"
          onClick={onClose}
          aria-label="편집 닫기"
        >
          ✕
        </button>
      </header>
      <div className="pn-insp__id">{id}</div>

      <div className="pn-insp__body">
        <Field
          label={isHead ? '제목 (· 뒤가 모델 이름)' : '제목'}
          hint={isSection ? '프롬프트에서 이 칸의 제목 줄이 됩니다' : undefined}
        >
          <input
            value={node.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </Field>

        <Field label="카드에 보이는 값" hint="★ = 기둥 색으로 강조">
          {node.rows.map(([k, v, tone], i) => (
            <div key={i} className="pn-insp__kv">
              <input
                value={k}
                aria-label="이름"
                onChange={(e) =>
                  setRow(
                    i,
                    tone ? [e.target.value, v, tone] : [e.target.value, v],
                  )
                }
              />
              <input
                value={v}
                aria-label="값"
                onChange={(e) =>
                  setRow(
                    i,
                    tone ? [k, e.target.value, tone] : [k, e.target.value],
                  )
                }
              />
              <button
                type="button"
                className={`pn-insp__icon${tone === 'accent' ? ' is-on' : ''}`}
                title="강조"
                onClick={() =>
                  setRow(i, tone === 'accent' ? [k, v] : [k, v, 'accent'])
                }
              >
                ★
              </button>
              <button
                type="button"
                className="pn-insp__icon"
                title="줄 지우기"
                disabled={node.rows.length <= 1}
                onClick={() =>
                  edit({ rows: node.rows.filter((_, k2) => k2 !== i) })
                }
              >
                −
              </button>
            </div>
          ))}
          {node.rows.length < MAX_CARD_ROWS && (
            <button
              type="button"
              className="pn-insp__ghost"
              onClick={() => edit({ rows: [...node.rows, ['key', 'value']] })}
            >
              + 줄 추가
            </button>
          )}
        </Field>

        {col < 4 && (
          <Field
            label="프롬프트 조각"
            hint={
              <>
                이 노드를 지나는 케이스의 프롬프트에 들어갑니다.{' '}
                <code>{'{result}'}</code> = 그 케이스의 결과
              </>
            }
          >
            <textarea
              rows={3}
              value={node.prompt}
              placeholder="예: - 성과 14일: CPA {result}"
              onChange={(e) => edit({ prompt: e.target.value })}
            />
            <label className="pn-insp__inline">
              <span>들어갈 칸</span>
              <select
                value={node.feeds}
                onChange={(e) => edit({ feeds: e.target.value })}
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          </Field>
        )}

        {(col === 0 || col === 2) && (
          <Field
            label="함께 보내는 입력 토큰"
            hint="영상 프레임·성과 표처럼 프롬프트와 같이 Claude에 보내는 것 — 이 노드를 지나는 케이스의 비용에 들어갑니다(영상 한 장 ≈ 1 230)"
          >
            <input
              type="number"
              min={0}
              step={100}
              value={node.tokens ?? 0}
              onChange={(e) =>
                edit({
                  tokens: Math.max(0, Math.round(Number(e.target.value)) || 0),
                })
              }
            />
          </Field>
        )}

        {isSection && (
          <>
            <Field label="모든 프롬프트에 들어가는 줄">
              <textarea
                rows={3}
                value={node.prompt}
                onChange={(e) => edit({ prompt: e.target.value })}
              />
            </Field>
            <Field label="이 칸으로 들어오는 노드">
              <div className="pn-insp__chips">
                {model.graph.layers.slice(0, 4).flatMap((l, k) =>
                  l
                    .filter((n) => n.feeds === id)
                    .map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        style={{ '--chip': COLUMNS[k].color } as CSSProperties}
                        onClick={() => onSelect(n.id)}
                      >
                        {n.title}
                      </button>
                    )),
                )}
              </div>
            </Field>
          </>
        )}

        {isHead && (
          <Field
            label={`${c.title} · 프롬프트`}
            hint={
              view.hold
                ? '신뢰도가 게이트(0.80) 아래라 보류 — 사람 검토로 넘어갑니다'
                : `입력 ${fmtTokens(view.cost.inTokens)} tok(글 ${fmtTokens(view.cost.textTokens)} + 함께 보내는 입력 ${fmtTokens(view.cost.attachedTokens)}) · 응답 ≈ ${fmtTokens(view.cost.outTokens)} tok · ${fmtUsd(view.cost.total)}`
            }
          >
            <pre className="pn-insp__prompt">{view.prompt.join('\n')}</pre>
            <div className="pn-insp__row">
              <button type="button" className="pn-insp__ghost" onClick={copy}>
                {copied ? '복사했습니다' : '프롬프트 복사'}
              </button>
              <button
                type="button"
                className="pn-insp__ghost"
                disabled={server.state === 'loading'}
                title="소재 분석 API와 같은 코드로 서버에서 만들어 비교합니다 — Claude는 부르지 않습니다"
                onClick={() => void checkServer()}
              >
                {server.state === 'loading'
                  ? '서버에서 만드는 중…'
                  : '서버에서 만들어 보기'}
              </button>
            </div>
            {server.state !== 'idle' && server.state !== 'loading' && (
              <p className={`pn-insp__server is-${server.state}`}>
                {server.text}
              </p>
            )}
          </Field>
        )}

        {isHead && (
          <Field
            label="실제 소재로 만들어 보기"
            hint="집행 중인 Meta 광고 하나의 실제 값(영상·문구·타겟팅·14일 성과·광고 설정·테스트)이 입력 노드 조각의 {이름} 자리에 들어갑니다 — Claude는 부르지 않습니다"
          >
            <AdPreview graph={model.graph} caseId={c.id} />
          </Field>
        )}

        {isHead && (
          <Field
            label={`${c.title} · 예상 응답 토큰`}
            hint="출력 형식이 길수록 커집니다 — 출력 단가가 입력의 5배라 비용에 크게 듭니다. 단가는 위 카드 값 in $/M · out $/M"
          >
            <input
              type="number"
              min={0}
              step={50}
              value={c.outTokens}
              onChange={(e) =>
                store.update((g) =>
                  setCaseOutTokens(
                    g,
                    slot,
                    Math.max(0, Math.round(Number(e.target.value)) || 0),
                  ),
                )
              }
            />
          </Field>
        )}

        {!isHead && (
          <section className="pn-insp__case">
            <div className="pn-insp__case-head">
              <span>지금 케이스</span>
              <b>{c.title}</b>
            </div>
            {onPath ? (
              <p className="pn-insp__onpath">● 이 케이스가 지나는 노드</p>
            ) : (
              <button
                type="button"
                className="pn-insp__primary"
                onClick={() =>
                  store.update((g) => setPathStep(g, slot, col, id))
                }
              >
                이 케이스가 이 노드를 지나게
              </button>
            )}
            {col === 1 && (
              <Field
                label="이 케이스의 답 · 신뢰도"
                hint={
                  onPath
                    ? `이 신뢰도로 게이트(${GATE.toFixed(2)})를 판정합니다 — 아래면 보류`
                    : `이 케이스가 이 질문을 지나면 이 신뢰도로 게이트를 판정합니다`
                }
              >
                <div className="pn-insp__answer">
                  <input
                    value={answer?.[0] ?? ''}
                    placeholder="답 (비우면 지움)"
                    onChange={(e) =>
                      setAnswer(
                        e.target.value
                          ? [e.target.value, answer?.[1] ?? GATE]
                          : null,
                      )
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={answer?.[1] ?? ''}
                    disabled={!answer}
                    aria-label="신뢰도"
                    onChange={(e) =>
                      answer &&
                      setAnswer([
                        answer[0],
                        Math.min(1, Math.max(0, Number(e.target.value) || 0)),
                      ])
                    }
                  />
                </div>
              </Field>
            )}
            {onPath && (col === 0 || col === 2) && (
              <Field label="결과 띠">
                <input
                  value={c.results[id] ?? ''}
                  placeholder={fallbackResult(node)}
                  onChange={(e) =>
                    store.update((g) =>
                      setCaseResult(g, slot, id, e.target.value),
                    )
                  }
                />
              </Field>
            )}
            {isSection && (
              <Field label="이 케이스만의 줄">
                <textarea
                  rows={2}
                  value={c.lines[id] ?? ''}
                  onChange={(e) =>
                    store.update((g) =>
                      setCaseLine(g, slot, id, e.target.value),
                    )
                  }
                />
              </Field>
            )}
            <button type="button" className="pn-insp__ghost" onClick={onReplay}>
              ▶ 이 케이스 처음부터 보기
            </button>
          </section>
        )}
      </div>

      <footer className="pn-insp__foot">
        <button
          type="button"
          className="pn-insp__danger"
          disabled={!canDelete}
          title={
            canDelete
              ? undefined
              : isHead
                ? '머리 칸은 지울 수 없습니다'
                : '층마다 노드가 하나는 있어야 합니다'
          }
          onClick={() => {
            if (confirm !== 'delete') return setConfirm('delete')
            store.update((g) => removeNode(g, id))
            onClose()
          }}
        >
          {confirm === 'delete' ? '한 번 더 누르면 삭제' : '노드 삭제'}
        </button>
        <button
          type="button"
          className="pn-insp__ghost"
          onClick={() => {
            if (confirm !== 'reset') return setConfirm('reset')
            store.reset()
            onClose()
          }}
        >
          {confirm === 'reset' ? '한 번 더: 전부 처음으로' : '전부 처음으로'}
        </button>
      </footer>
    </aside>
  )
}
