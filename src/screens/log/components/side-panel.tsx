import { useEffect, type CSSProperties, type ReactNode } from 'react'

/** 패널 위 테두리·머리 네모의 색 — 상태(성공·실패 등) 또는 탭 강조색. */
export type PanelTone =
  | 'accent'
  | 'success'
  | 'partial'
  | 'failed'
  | 'timeout'
  | 'running'
  | 'missing'
  | 'pending'
  | 'no-data'

/**
 * 오른쪽에 떠오르는 상세 패널 — 흐름 그림의 노드를 누르면 열린다(퍼셉트론의
 * 편집 패널 .pn-insp와 같은 자리·모양). 세 탭이 같이 쓰고, 안의 내용만 탭마다
 * 다르다. 열려 있으면 ←/→로 이웃 노드(onStep이 있을 때), Esc로 닫는다 — 입력칸·
 * 고르기 상자 안에서는 그 칸의 키로 둔다. 닫혀 있어도 붙여 두어 미끄러져
 * 나가게 하고, 다른 노드로 바꾸면 내용만 새로 켠다(contentKey).
 */
export const SidePanel = ({
  open,
  tone,
  heading,
  idLine,
  contentKey,
  label,
  onClose,
  onStep,
  children,
}: {
  open: boolean
  tone: PanelTone
  /** 머리 왼쪽 — "NODE 01/07" 등. */
  heading: string
  /** 머리 아래 한 줄 — id·함수 이름 등. */
  idLine: string
  contentKey: string
  /** 읽어 주는 이름. */
  label: string
  onClose: () => void
  onStep?: (step: -1 | 1) => void
  children: ReactNode
}) => {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
        return
      if (event.key === 'Escape') onClose()
      else if (
        onStep &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ) {
        event.preventDefault()
        onStep(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, onStep])

  return (
    <aside
      className={`log-insp is-${tone}${open ? '' : ' is-closed'}`}
      aria-label={label}
      aria-hidden={!open}
    >
      <header className="log-insp__head">
        <span>
          <i aria-hidden="true" />
          {heading}
        </span>
        <div className="log-insp__tools">
          {onStep && (
            <>
              <button
                type="button"
                onClick={() => onStep(-1)}
                aria-label="이전"
                title="이전 (←)"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => onStep(1)}
                aria-label="다음"
                title="다음 (→)"
              >
                →
              </button>
            </>
          )}
          <button
            type="button"
            className="log-insp__close"
            onClick={onClose}
            aria-label="닫기"
            title="닫기 (Esc)"
          >
            ✕
          </button>
        </div>
      </header>
      <div className="log-insp__id">
        <i>//</i> {idLine}
      </div>
      <div key={contentKey} className="log-insp__body">
        {children}
      </div>
    </aside>
  )
}

/** 패널 안 칸 하나 — 이름(작은 대문자) + 내용. index 순서대로 떠오른다. */
export const PanelCell = ({
  title,
  index,
  children,
}: {
  title: string
  index: number
  children: ReactNode
}) => (
  <section className="log-insp__cell" style={{ '--i': index } as CSSProperties}>
    <h3>{title}</h3>
    {children}
  </section>
)

/** 패널 맨 위 이름·설명. */
export const PanelTitle = ({
  title,
  tag,
  desc,
}: {
  title: string
  tag?: string
  desc?: string
}) => (
  <div className="log-insp__title" style={{ '--i': 0 } as CSSProperties}>
    <h2>
      {title}
      {tag && <span className="batch-log__codebase">{tag}</span>}
    </h2>
    {desc && <p className="batch-log__muted">{desc}</p>}
  </div>
)

/** 숫자 칸들 — 두 줄씩. tone이 있으면 그 상태 색으로. */
export const PanelStats = ({
  items,
}: {
  items: {
    label: string
    value: string
    tone?: 'ok' | 'warn' | 'fail'
  }[]
}) => (
  <dl className="log-insp__stats">
    {items.map((item) => (
      <div key={item.label}>
        <dt>{item.label}</dt>
        <dd className={item.tone ? `is-${item.tone}` : undefined}>
          {item.value}
        </dd>
      </div>
    ))}
  </dl>
)

/** 이름 + 막대 + 값 목록 — 많은 순. 누를 수 있으면 onPick. */
export const PanelBars = ({
  rows,
  empty,
  onPick,
}: {
  rows: { key: string; name: string; value: number; text: string }[]
  empty: string
  onPick?: (key: string) => void
}) => {
  if (rows.length === 0) return <p className="log-insp__empty">{empty}</p>
  // 1보다 작은 값(금액)도 가장 큰 줄이 가득 차게 — 모두 0이면 1.
  const max = Math.max(0, ...rows.map((row) => row.value)) || 1
  return (
    <ul className="log-insp__bars">
      {rows.map((row, index) => {
        const body = (
          <>
            <span className="name" title={row.name}>
              {row.name}
            </span>
            <span className="track" aria-hidden="true">
              <span
                style={
                  {
                    width: `${(row.value / max) * 100}%`,
                    '--i': index,
                  } as CSSProperties
                }
              />
            </span>
            <span className="value">{row.text}</span>
          </>
        )
        return (
          <li key={row.key}>
            {onPick ? (
              <button type="button" onClick={() => onPick(row.key)}>
                {body}
              </button>
            ) : (
              <div>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** 기록 목록 — 줄을 누르면 아래 표에서 그 줄이 펼쳐진다. */
export const PanelList = ({
  items,
  empty,
}: {
  items: {
    key: string
    title: string
    meta: string
    side?: ReactNode
    onOpen?: () => void
  }[]
  empty: string
}) =>
  items.length === 0 ? (
    <p className="log-insp__empty">{empty}</p>
  ) : (
    <ul className="log-insp__list">
      {items.map((item) => (
        <li key={item.key}>
          <button type="button" onClick={item.onOpen} disabled={!item.onOpen}>
            <span className="title">{item.title}</span>
            <span className="meta">{item.meta}</span>
            {item.side && <span className="side">{item.side}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
