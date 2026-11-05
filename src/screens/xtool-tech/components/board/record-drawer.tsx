import { PenLine, Trash2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { SegmentedControl } from '@/ohq-ui/components/segmented-control'
import { deleteItems } from '../../data/tech-outbox'
import { UPDATE_BOARDS } from '../../data/use-item-updates'
import { useItemPanel, type ItemPanel } from '../../lib/use-item-param'
import { useBoardEdit } from './board-edit-context'
import { StagePill } from './cells'
import { DrawerShell } from './drawer-shell'
import { ItemFiles } from './item-files'
import { ItemUpdates } from './item-updates'
import { DELETE_CONFIRM_MESSAGE } from './record-selection'

export interface DrawerField {
  label: string
  value: ReactNode
}

interface RecordDrawerProps {
  /** 열린 기록 — null이면 닫힌다. */
  record: { itemId: string; name: string; stage: string | null; status: string | null } | null
  /** 이름 위 한 줄(보드 이름 등) — 내 업무에서는 그 보드로 가는 링크 */
  eyebrow: ReactNode
  fields?: readonly DrawerField[]
  /** 긴 글(증상·문의 내용 등) — 비어 있는 건 빼고 보여 준다. */
  texts?: readonly { label: string; text: string | null }[]
  children?: ReactNode
  onClose: () => void
}

/**
 * 기록 상세 — 오른쪽 유리 패널. 보드가 편집을 허락하면 "수정"으로 편집 패널을 겹쳐 열고, 휴지통으로 지운다
 * (Monday 휴지통 — 확인을 받는다). 말풍선 보드(출장업무·
 * 아톡문의)는 "정보 · 업데이트" 탭 — 업데이트는 Monday 표 말풍선 패널과 같은 기능(ItemUpdates).
 */
export function RecordDrawer({ record, eyebrow, fields = [], texts = [], children, onClose }: RecordDrawerProps) {
  const edit = useBoardEdit()
  const [panel, setPanel] = useItemPanel()
  const updatesBoard = !!edit && UPDATE_BOARDS.has(edit.boardKey)
  const tab: ItemPanel = updatesBoard ? panel : 'info'
  const count = (record && edit?.itemOf(record.itemId)?.updateCount) || 0
  const [confirming, setConfirming] = useState(false)
  return (
    <DrawerShell
      open={record !== null}
      onClose={onClose}
      labelledBy="drawer-title"
      contentKey={record?.itemId}
      placement="center"
    >
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
            {edit && (
              <button type="button" className="icon-button" aria-label="삭제" title="삭제" onClick={() => setConfirming(true)}>
                <Trash2 size={15} aria-hidden />
              </button>
            )}
            <button type="button" className="icon-button" aria-label="닫기" onClick={onClose}>
              <X size={16} aria-hidden />
            </button>
          </header>

          {updatesBoard && (
            <div className="drawer__tabs">
              <SegmentedControl
                ariaLabel="상세 보기"
                size="sm"
                options={[
                  { value: 'info' as ItemPanel, label: '정보' },
                  { value: 'updates' as ItemPanel, label: count ? `업데이트 ${count}` : '업데이트' },
                ]}
                value={tab}
                onChange={setPanel}
              />
            </div>
          )}

          {tab === 'updates' && edit ? (
            <div className="drawer__body">
              <ItemUpdates key={record.itemId} boardKey={edit.boardKey} itemId={record.itemId} />
            </div>
          ) : (
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

              {/* 파일 칸(사진은 썸네일) — 칸 종류로 찾아서 모든 보드에 같이 나온다. */}
              {edit && edit.itemOf(record.itemId) && <ItemFiles meta={edit.meta} item={edit.itemOf(record.itemId)!} />}
            </div>
          )}

          {edit && (
            <ConfirmDialog
              open={confirming}
              title="이 항목을 지울까요?"
              message={DELETE_CONFIRM_MESSAGE}
              confirmLabel="삭제"
              onCancel={() => setConfirming(false)}
              onConfirm={() => {
                setConfirming(false)
                deleteItems(edit.boardKey, [record.itemId])
                onClose()
              }}
            />
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
