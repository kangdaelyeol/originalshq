import { ExternalLink, PenLine, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useBoardEdit } from './board-edit-context'
import { StagePill } from './cells'
import { DrawerShell } from './drawer-shell'

export interface DrawerField {
  label: string
  value: ReactNode
}

interface RecordDrawerProps {
  /** 열린 기록 — null이면 닫힌다. */
  record: { itemId: string; name: string; stage: string | null; status: string | null; url: string | null } | null
  /** 이름 위 한 줄(보드 이름 등) */
  eyebrow: string
  fields?: readonly DrawerField[]
  /** 긴 글(증상·문의 내용 등) — 비어 있는 건 빼고 보여 준다. */
  texts?: readonly { label: string; text: string | null }[]
  children?: ReactNode
  onClose: () => void
}

/** 기록 상세 — 오른쪽 유리 패널. 보드가 편집을 허락하면 "수정"으로 편집 패널을 겹쳐 연다. */
export function RecordDrawer({ record, eyebrow, fields = [], texts = [], children, onClose }: RecordDrawerProps) {
  const edit = useBoardEdit()
  return (
    <DrawerShell open={record !== null} onClose={onClose} labelledBy="drawer-title" contentKey={record?.itemId}>
      {record && (
        <>
          <header className="drawer__header">
            <div className="drawer__heading">
              <p className="drawer__eyebrow">{eyebrow}</p>
              <h2 id="drawer-title" className="drawer__title">
                {record.name || '(이름 없음)'}
              </h2>
              <StagePill stage={record.stage} status={record.status} />
            </div>
            {edit && (
              <button type="button" className="button button--ghost button--sm" onClick={() => edit.openEditor(record.itemId)}>
                <PenLine size={13} aria-hidden />
                수정
              </button>
            )}
            <button type="button" className="icon-button" aria-label="닫기" onClick={onClose}>
              <X size={16} aria-hidden />
            </button>
          </header>

          <div className="drawer__body">
            {fields.length > 0 && (
              <dl className="drawer__fields">
                {fields.map((field) => (
                  <div key={field.label} className="drawer__field">
                    <dt>{field.label}</dt>
                    <dd>{field.value ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            )}

            {texts
              .filter((t) => t.text)
              .map((t) => (
                <section key={t.label} className="drawer__section">
                  <h3>{t.label}</h3>
                  <p className="drawer__text">{t.text}</p>
                </section>
              ))}

            {children}
          </div>

          {record.url && (
            <footer className="drawer__footer">
              <a href={record.url} target="_blank" rel="noreferrer" className="button button--ghost button--md">
                <ExternalLink size={14} aria-hidden />
                Monday에서 열기
              </a>
            </footer>
          )}
        </>
      )}
    </DrawerShell>
  )
}

/** 상세 패널의 작은 목록(설치 품목·청구 부품) */
export function DrawerList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="drawer__section">
      <h3>{title}</h3>
      <ul className="drawer__list">{children}</ul>
    </section>
  )
}
