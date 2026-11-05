import { Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState, type CSSProperties } from 'react'
import type { TechColumn, TechItemDoc, TechSubitemDoc } from '@xtool-core/tech-boards'
import { isDraftSubitem } from '@xtool-core/tech-outbox'
import { editableSubColumns, relationColumn } from '@xtool-core/tech-subitems'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { cx } from '@/ohq-ui/lib/cx'
import { DELETE_CONFIRM_MESSAGE } from '../board/record-selection'
import { AddInput } from './monday-add-row'
import { InlineInput, type CellCommit } from './monday-editors'
import { EditableCell } from './monday-editable-cell'
import type { EditingCell } from './monday-group'
import { MonPopover } from './monday-popover'
import { HIDDEN_TYPES } from './monday-values'

// 하위 표에 안 그리는 칸 — 생성 로그
const SUB_HIDDEN_TYPES = new Set(['creation_log'])
const SUB_NAME_WIDTH = 340
const SUB_WIDTH = 130

/** 하위 아이템 편집 열쇠 — 항목 칸 열쇠(줄 열쇠:칸 id)와 겹치지 않게 */
const subKey = (sub: TechSubitemDoc, id: string) => `sub:${sub.id}:${id}`

interface SubTableProps {
  item: TechItemDoc
  columns: TechColumn[]
  nameTitle: string
  editing: EditingCell | null
  setEditing: (editing: EditingCell | null) => void
  onAdd: (name: string) => void
  /** 칸·이름 고치기, 지우기 — 없으면 보기만 */
  onCommitCell?: (sub: TechSubitemDoc, column: TechColumn, commit: CellCommit) => void
  onCommitName?: (sub: TechSubitemDoc, name: string) => void
  onRemove?: (sub: TechSubitemDoc) => void
}

/**
 * 하위 아이템(출장 설치 품목·AS 청구 부품) — Monday처럼 줄 아래로 들여 펼친다. 왼쪽 줄기에서
 * 줄마다 둥글게 꺾인 가지가 나오고, 맨 아래 "+ 품목명 추가"로 이름만 적어 새 줄을 만든다(바로
 * 보이고 뒤에서 만든다). 칸·이름은 항목 줄처럼 눌러서 그 자리에서 고치고(대시보드 편집 패널과
 * 같은 칸만), 이름 칸 오른쪽 "⋯"에서 이름 바꾸기·삭제. 부품 연결 칸이 있는 보드(AS)는 대시보드처럼 이름을
 * 손으로 고치지 않는다 — 부품을 고르면 이름이 따라간다("⋯"에는 삭제만).
 */
export function SubTable({ item, columns, nameTitle, editing, setEditing, onAdd, onCommitCell, onCommitName, onRemove }: SubTableProps) {
  const subitems = item.subitems ?? []
  const shown = columns.filter((c) => !HIDDEN_TYPES.has(c.type) && !SUB_HIDDEN_TYPES.has(c.type))
  const template = `${SUB_NAME_WIDTH}px ${shown.map(() => `${SUB_WIDTH}px`).join(' ')}`
  // 고칠 수 있는 칸 — 대시보드 편집 패널과 같은 규칙(품명은 서버가 이름·수량으로 맞춘다)
  const editable = new Set(editableSubColumns(columns).map((c) => c.id))
  // 연결 칸(AS 부품명)은 줄마다 하나만 잇는다. 이 칸이 있으면 이름은 부품을 따라가서 손으로 고치지 않는다.
  const relationId = relationColumn(columns)?.id
  const commitName = relationId ? undefined : onCommitName
  // "⋯" 메뉴를 연 줄 · 지울지 묻는 줄 — anchor는 그 줄의 "⋯" 단추(그만두면 포커스를 돌려준다)
  const [menu, setMenu] = useState<{ sub: TechSubitemDoc; anchor: HTMLElement } | null>(null)
  const [confirming, setConfirming] = useState<{ sub: TechSubitemDoc; anchor: HTMLElement } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div ref={ref} className="mon-sub" role="rowgroup" aria-label={`하위 아이템 ${subitems.length}개`} style={{ '--sub-cols': template } as CSSProperties}>
      <span className="mon-sub__trunk" aria-hidden />
      <div className="mon-sub__row mon-sub__row--head" role="row">
        <div className="mon-cell mon-sub__name" role="columnheader">
          <span className="mon-text">{nameTitle}</span>
        </div>
        {shown.map((c) => (
          <div key={c.id} className="mon-cell" role="columnheader" title={c.title}>
            <span className="mon-text">{c.title}</span>
          </div>
        ))}
      </div>
      {subitems.map((sub) => (
        <SubRow
          key={sub.id}
          sub={sub}
          columns={shown}
          editable={editable}
          relationId={relationId}
          nameTitle={nameTitle}
          editing={editing}
          setEditing={setEditing}
          onCommitCell={onCommitCell}
          onCommitName={commitName}
          menuOpen={menu?.sub.id === sub.id}
          onMenu={
            commitName || onRemove
              ? (anchor) => setMenu((m) => (m?.sub.id === sub.id ? null : { sub, anchor }))
              : undefined
          }
        />
      ))}
      <div className="mon-sub__row mon-sub__row--item mon-sub__row--add" role="row">
        <div className="mon-cell mon-sub__name" role="rowheader">
          <AddInput label={nameTitle} onAdd={onAdd} />
        </div>
      </div>
      {menu && (
        <MonPopover anchor={menu.anchor} width={200} onClose={() => setMenu(null)}>
          <ul className="mon-menu" aria-label={`${menu.sub.name} 메뉴`}>
            {commitName && (
              <li>
                <button
                  type="button"
                  className="mon-menu__item"
                  onClick={() => {
                    setMenu(null)
                    setEditing({ key: subKey(menu.sub, 'name'), anchor: menu.anchor })
                  }}
                >
                  <Pencil size={15} aria-hidden />
                  이름 바꾸기
                </button>
              </li>
            )}
            {onRemove && (
              <li>
                <button
                  type="button"
                  className="mon-menu__item"
                  onClick={() => {
                    setMenu(null)
                    setConfirming(menu)
                  }}
                >
                  <Trash2 size={15} aria-hidden />
                  삭제
                </button>
              </li>
            )}
          </ul>
        </MonPopover>
      )}
      <ConfirmDialog
        open={confirming !== null}
        title={`'${confirming?.sub.name ?? ''}' 줄을 지울까요?`}
        message={DELETE_CONFIRM_MESSAGE}
        confirmLabel="삭제"
        onCancel={() => {
          confirming?.anchor.focus()
          setConfirming(null)
        }}
        onConfirm={() => {
          if (confirming) onRemove?.(confirming.sub)
          setConfirming(null)
          // 지운 줄은 바로 빠진다 — 포커스는 "+ 추가" 칸으로
          ref.current?.querySelector<HTMLInputElement>('.mon-add')?.focus()
        }}
      />
    </div>
  )
}

interface SubRowProps {
  sub: TechSubitemDoc
  columns: TechColumn[]
  editable: ReadonlySet<string>
  relationId: string | undefined
  nameTitle: string
  editing: EditingCell | null
  setEditing: (editing: EditingCell | null) => void
  onCommitCell?: (sub: TechSubitemDoc, column: TechColumn, commit: CellCommit) => void
  onCommitName?: (sub: TechSubitemDoc, name: string) => void
  /** "⋯" 메뉴 열기·닫기 — 없으면 단추를 그리지 않는다. */
  onMenu?: (anchor: HTMLElement) => void
  menuOpen: boolean
}

/** 하위 아이템 한 줄 — 만드는 중인 줄(아직 Monday id가 없다)은 다 만들어질 때까지 보기만. */
function SubRow({ sub, columns, editable, relationId, nameTitle, editing, setEditing, onCommitCell, onCommitName, onMenu, menuOpen }: SubRowProps) {
  const draft = isDraftSubitem(sub.id)
  const nameKey = subKey(sub, 'name')
  // 고칠 수 없는 칸에 올렸을 때 까닭
  const lockedTitle = (c: TechColumn) =>
    draft
      ? '만드는 중이에요 — 다 만들어지면 고칠 수 있어요'
      : c.type === 'mirror' || c.type === 'formula'
        ? `${c.title} — Monday가 계산하는 칸이에요`
        : c.writable
          ? `${c.title} — 이름·수량을 고치면 저절로 맞춰져요`
          : undefined
  return (
    <div className="mon-sub__row mon-sub__row--item" role="row">
      <div className="mon-cell mon-sub__name" role="rowheader">
        {editing?.key === nameKey && onCommitName ? (
          <InlineInput
            initial={sub.name}
            label={nameTitle}
            onCommit={(name) => {
              setEditing(null)
              if (name.trim()) onCommitName(sub, name.trim())
            }}
            onCancel={() => setEditing(null)}
          />
        ) : onCommitName && !draft ? (
          <button type="button" className="mon-name" title={sub.name} onClick={(e) => setEditing({ key: nameKey, anchor: e.currentTarget })}>
            {sub.name}
          </button>
        ) : (
          <span
            className="mon-text mon-sub__label"
            title={
              draft
                ? `${sub.name} — 만드는 중이에요`
                : relationId
                  ? `${sub.name} — 부품을 고르면 이름이 따라가요`
                  : sub.name
            }
          >
            {sub.name}
          </span>
        )}
        {onMenu && !draft && (
          <button
            type="button"
            className={cx('mon-sub__more', menuOpen && 'is-active')}
            aria-label={`${sub.name} 메뉴`}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            title={onCommitName ? '이름 바꾸기 · 삭제' : '삭제'}
            onClick={(e) => onMenu(e.currentTarget)}
          >
            <Ellipsis size={16} aria-hidden />
          </button>
        )}
      </div>
      {columns.map((c) => (
        <EditableCell
          key={c.id}
          editKey={subKey(sub, c.id)}
          column={c}
          cell={sub.values[c.id]}
          writable={!!onCommitCell && !draft && editable.has(c.id)}
          editing={editing}
          setEditing={setEditing}
          onCommit={(commit) => onCommitCell?.(sub, c, commit)}
          lockedTitle={lockedTitle(c)}
          single={c.id === relationId}
        />
      ))}
    </div>
  )
}
