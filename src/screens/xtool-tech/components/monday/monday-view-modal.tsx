import { LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { TechBoardKey, TechBoardMeta, TechColumn, TechItemDoc } from '@xtool-core/tech-boards'
import {
  applyViewRules,
  cellChoices,
  createBoardView,
  deleteBoardView,
  GROUP_COLUMN,
  NAME_COLUMN,
  OPS_BY_KIND,
  opInput,
  ruleKind,
  updateBoardView,
  VIEW_LIMITS,
  type BoardView,
  type BoardViewSpec,
  type ViewRule,
} from '@xtool-core/tech-views'
import { errorText } from '@xtool-core/error-text'
import { cx } from '@/ohq-ui/lib/cx'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { groupIdOf, viewColumns } from './monday-values'

interface ViewModalProps {
  boardKey: TechBoardKey
  meta: TechBoardMeta
  /** 보드 항목 전부 — 고를 값 목록과 맞는 항목 수를 센다 */
  items: TechItemDoc[]
  /** 고칠 보기 — null이면 새 보기 */
  view: BoardView | null
  /** 새 보기를 만들 때 처음 값(복제) */
  initial?: BoardViewSpec
  onClose: () => void
  /** 저장한 보기 id — 새로 만들었으면 그 보기로 옮겨 간다 */
  onSaved: (id: string) => void
  /** 지운 뒤 — 메인 테이블로 */
  onDeleted: () => void
}

const EMPTY: BoardViewSpec = { name: '', match: 'all', rules: [], sort: null, hidden: [] }

/** 칸을 고르면 그 칸 종류의 첫 조건으로 */
const ruleFor = (column: TechColumn): ViewRule => ({ columnId: column.id, op: OPS_BY_KIND[ruleKind(column)][0].op, values: [] })

/**
 * 보기 추가·고치기 모달 — 이름, 조건(칸·조건·값 줄들, 모두/하나라도), 정렬, 숨길 칸. 조건을 고치는 동안 맞는
 * 항목 수를 바로 보여 준다. 저장하면 기술팀 모두의 보드에 같은 보기 탭이 생긴다(data/tech-views).
 */
export function ViewModal({ boardKey, meta, items, view, initial, onClose, onSaved, onDeleted }: ViewModalProps) {
  const root = usePortalRoot()
  const columns = useMemo(() => viewColumns(meta, boardKey), [meta, boardKey])
  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  const [draft, setDraft] = useState<BoardViewSpec>(() => (view ? { ...view } : (initial ?? EMPTY)))
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const groupOf = (item: TechItemDoc) => groupIdOf(meta, item)
  const matched = applyViewRules(items, draft, columns, groupOf).length

  // 고를 값 — 칸마다 Monday 라벨(options)과 항목에 적힌 값, 많이 쓰인 순. 그룹은 보드의 그룹 순서대로.
  const choicesOf = (column: TechColumn): { value: string; label: string }[] => {
    if (column.id === GROUP_COLUMN) return meta.groups.map((g) => ({ value: g.id, label: g.title }))
    const counts = new Map<string, number>((column.options ?? []).map((o) => [o, 0]))
    for (const item of items) for (const v of cellChoices(column, item, '')) counts.set(v, (counts.get(v) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).map(([value]) => ({ value, label: value }))
  }

  useEffect(() => {
    // 지우기 확인이 떠 있으면 그쪽이 Esc를 먼저 받는다(capture).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const patch = (next: Partial<BoardViewSpec>) => setDraft((d) => ({ ...d, ...next }))
  const setRule = (index: number, rule: ViewRule) => patch({ rules: draft.rules.map((r, i) => (i === index ? rule : r)) })
  const addRule = () => {
    // 처음 고를 칸 — 상태 칸(가장 자주 거르는 칸)이 있으면 그것, 없으면 이름
    const first = columns.find((c) => c.type === 'status') ?? columns[0]
    patch({ rules: [...draft.rules, ruleFor(first)] })
  }
  const toggleHidden = (id: string) =>
    patch({ hidden: draft.hidden.includes(id) ? draft.hidden.filter((h) => h !== id) : [...draft.hidden, id] })

  const name = draft.name.trim()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name || busy) return
    setBusy('save')
    setError(null)
    try {
      const id = view ? (await updateBoardView(view.id, draft), view.id) : await createBoardView(boardKey, draft)
      onSaved(id)
    } catch (err) {
      setError(errorText(err))
      setBusy(null)
    }
  }
  const remove = async () => {
    if (!view) return
    setConfirmDelete(false)
    setBusy('delete')
    setError(null)
    try {
      await deleteBoardView(view.id)
      onDeleted()
    } catch (err) {
      setError(errorText(err))
      setBusy(null)
    }
  }

  if (!root) return null
  return createPortal(
    <>
      <div className="mon-modal" role="presentation" onClick={onClose}>
        <form
          className="mon-modal__card mon-viewmodal"
          role="dialog"
          aria-modal="true"
          aria-label={view ? `보기 고치기 — ${view.name}` : '보기 추가'}
          aria-busy={busy !== null || undefined}
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => void submit(e)}
        >
          <header className="mon-modal__head">
            <div>
              <h2>{view ? '보기 고치기' : '보기 추가'}</h2>
              <p>{meta.name} · 저장하면 기술팀 모두에게 같은 보기가 보여요</p>
            </div>
            <button type="button" className="mon-modal__close" aria-label="닫기" onClick={onClose}>
              <X size={18} aria-hidden />
            </button>
          </header>

          <div className="mon-modal__body mon-viewmodal__body">
            <label className="mon-viewmodal__field">
              <span className="mon-viewmodal__label">보기 이름</span>
              <input
                className="mon-vinput"
                autoFocus
                value={draft.name}
                maxLength={VIEW_LIMITS.name}
                placeholder="예: 일정 확정 건"
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>

            <section className="mon-viewmodal__section" aria-label="조건">
              <div className="mon-viewmodal__row-head">
                <span className="mon-viewmodal__label">조건</span>
                {draft.rules.length > 1 && (
                  <span className="mon-viewmodal__match" role="radiogroup" aria-label="조건 맞추기">
                    {(['all', 'any'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={draft.match === m}
                        className={cx('mon-vchip', draft.match === m && 'is-on')}
                        onClick={() => patch({ match: m })}
                      >
                        {m === 'all' ? '모두 만족' : '하나라도 만족'}
                      </button>
                    ))}
                  </span>
                )}
                <span className="mon-viewmodal__count">
                  맞는 항목 <strong>{matched}</strong> / {items.length}
                </span>
              </div>

              {draft.rules.length === 0 && <p className="mon-modal__hint">조건이 없으면 모든 항목이 보여요.</p>}
              <ol className="mon-viewmodal__rules">
                {draft.rules.map((rule, index) => {
                  const column = byId.get(rule.columnId)
                  const kind = column ? ruleKind(column) : 'text'
                  const input = opInput(rule.op)
                  return (
                    <li key={index} className="mon-viewrule">
                      <div className="mon-viewrule__line">
                        {index > 0 && <span className="mon-viewrule__join">{draft.match === 'all' ? '그리고' : '또는'}</span>}
                        <select
                          className="mon-vselect"
                          aria-label="칸"
                          value={column ? rule.columnId : ''}
                          onChange={(e) => {
                            const next = byId.get(e.target.value)
                            if (next) setRule(index, ruleFor(next))
                          }}
                        >
                          {!column && <option value="">(지워진 칸)</option>}
                          {columns.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                        <select
                          className="mon-vselect"
                          aria-label="조건"
                          value={rule.op}
                          onChange={(e) => setRule(index, { ...rule, op: e.target.value as ViewRule['op'], values: [] })}
                        >
                          {OPS_BY_KIND[kind].map((o) => (
                            <option key={o.op} value={o.op}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {input === 'type' && (
                          <input
                            className="mon-vinput"
                            aria-label="값"
                            inputMode={kind === 'number' ? 'decimal' : undefined}
                            value={rule.values[0] ?? ''}
                            placeholder={kind === 'number' ? '숫자' : '글자'}
                            onChange={(e) => setRule(index, { ...rule, values: [e.target.value] })}
                          />
                        )}
                        <button
                          type="button"
                          className="mon-viewrule__remove"
                          aria-label="조건 빼기"
                          title="조건 빼기"
                          onClick={() => patch({ rules: draft.rules.filter((_, i) => i !== index) })}
                        >
                          <X size={15} aria-hidden />
                        </button>
                      </div>
                      {input === 'pick' && column && (
                        <div className="mon-viewrule__choices" role="group" aria-label={`${column.title} 값`}>
                          {choicesOf(column).map((choice) => {
                            const on = rule.values.includes(choice.value)
                            return (
                              <button
                                key={choice.value}
                                type="button"
                                aria-pressed={on}
                                className={cx('mon-vchip', on && 'is-on')}
                                onClick={() =>
                                  setRule(index, {
                                    ...rule,
                                    values: on ? rule.values.filter((v) => v !== choice.value) : [...rule.values, choice.value],
                                  })
                                }
                              >
                                {choice.label}
                              </button>
                            )
                          })}
                          {choicesOf(column).length === 0 && <span className="mon-modal__hint">고를 값이 없어요</span>}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
              {draft.rules.length < VIEW_LIMITS.rules && (
                <button type="button" className="mon-viewmodal__add" onClick={addRule}>
                  <Plus size={14} aria-hidden />
                  조건 추가
                </button>
              )}
            </section>

            <section className="mon-viewmodal__section" aria-label="정렬">
              <span className="mon-viewmodal__label">정렬</span>
              <div className="mon-viewrule__line">
                <select
                  className="mon-vselect"
                  aria-label="정렬할 칸"
                  value={draft.sort?.columnId ?? ''}
                  onChange={(e) => patch({ sort: e.target.value ? { columnId: e.target.value, dir: draft.sort?.dir ?? 1 } : null })}
                >
                  <option value="">정렬 안 함</option>
                  {columns
                    .filter((c) => c.id !== GROUP_COLUMN)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                </select>
                {draft.sort && (
                  <span className="mon-viewmodal__match" role="radiogroup" aria-label="정렬 방향">
                    {([1, -1] as const).map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        role="radio"
                        aria-checked={draft.sort?.dir === dir}
                        className={cx('mon-vchip', draft.sort?.dir === dir && 'is-on')}
                        onClick={() => draft.sort && patch({ sort: { ...draft.sort, dir } })}
                      >
                        {dir === 1 ? '오름차순' : '내림차순'}
                      </button>
                    ))}
                  </span>
                )}
              </div>
            </section>

            <section className="mon-viewmodal__section" aria-label="숨길 칸">
              <span className="mon-viewmodal__label">숨길 칸</span>
              <div className="mon-viewrule__choices">
                {columns
                  .filter((c) => c.id !== NAME_COLUMN && c.id !== GROUP_COLUMN)
                  .map((c) => {
                    const hidden = draft.hidden.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={hidden}
                        className={cx('mon-vchip', 'mon-vchip--hide', hidden && 'is-on')}
                        onClick={() => toggleHidden(c.id)}
                      >
                        {c.title}
                      </button>
                    )
                  })}
              </div>
            </section>

            {error && <p className="mon-modal__error">저장하지 못했어요: {error}</p>}
          </div>

          <footer className="mon-modal__foot">
            {view && (
              <button type="button" className="mon-modal__clear" disabled={busy !== null} onClick={() => setConfirmDelete(true)}>
                {busy === 'delete' ? <LoaderCircle size={14} className="is-spinning" aria-hidden /> : <Trash2 size={14} aria-hidden />}
                보기 지우기
              </button>
            )}
            <span className="mon-viewmodal__actions">
              <button type="button" className="mon-modal__clear" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="mon-modal__upload" disabled={!name || busy !== null}>
                {busy === 'save' && <LoaderCircle size={14} className="is-spinning" aria-hidden />}
                {view ? '저장' : '보기 추가'}
              </button>
            </span>
          </footer>
        </form>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={`"${view?.name ?? ''}" 보기를 지울까요?`}
        message="기술팀 모두의 보드에서 이 보기 탭이 사라져요. 항목은 그대로예요."
        confirmLabel="지우기"
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>,
    root,
  )
}
