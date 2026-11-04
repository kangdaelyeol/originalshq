import { PenLine, X } from 'lucide-react'
import { useId, useMemo, type ReactNode } from 'react'
import { useBoardEdit } from '../../board/board-edit-context'
import { WaterButton, WaterIconButton } from '@/ohq-ui/water/controls'
import { WaterStagePill } from './cells'
import { WaterDrawerShell } from './drawer-shell'
import { techFileActions, type WaterFileActions } from './file-actions'
import { WaterItemFiles } from './water-item-files'

export interface WaterDrawerField {
  label: string
  value: ReactNode
}

interface WaterRecordDrawerProps {
  /** 열린 기록 — null이면 닫힌다. */
  record: {
    itemId: string
    name: string
    stage: string | null
    status: string | null
  } | null
  /** 이름 위 한 줄(보드 이름 등) */
  eyebrow: string
  fields?: readonly WaterDrawerField[]
  /** 긴 글(증상·문의 내용 등) — 비어 있는 건 빼고 보여 준다. */
  texts?: readonly { label: string; text: string | null }[]
  children?: ReactNode
  onClose: () => void
  /**
   * 물에만 — 파일 칸의 올리기·비우기(끌어다 놓기 포함). 기본은 이 보드의 Monday 올리기(편집할 수 있는 보드일 때,
   * 기존 편집 패널 FileField와 같은 길·토스트). null이면 기존 ItemFiles처럼 보기만, 견본은 가짜를 넘긴다
   */
  fileActions?: WaterFileActions | null
}

/**
 * 기록 상세(물) — 오른쪽 유리 서랍. 기존 RecordDrawer와 같은 props·내용이고, 보드가 편집을 허락하면
 * "수정"으로 편집 패널을 겹쳐 연다. 머리·칸 줄·글 묶음은 서랍이 닿은 뒤 차례로 나타난다([data-water-reveal]).
 */
export function WaterRecordDrawer({
  record,
  eyebrow,
  fields = [],
  texts = [],
  children,
  onClose,
  fileActions,
}: WaterRecordDrawerProps) {
  const edit = useBoardEdit()
  const titleId = useId()
  const item = record && edit ? edit.itemOf(record.itemId) : undefined
  const boardKey = edit?.boardKey
  const realFiles = useMemo(
    () => (boardKey ? techFileActions(boardKey) : undefined),
    [boardKey],
  )
  const files =
    fileActions === undefined ? realFiles : (fileActions ?? undefined)
  return (
    <WaterDrawerShell
      open={record !== null}
      onClose={onClose}
      labelledBy={titleId}
      contentKey={record?.itemId}
    >
      {record && (
        <>
          <header className="water-drawer__header" data-water-reveal>
            <div className="water-drawer__heading">
              <p className="water-drawer__eyebrow">{eyebrow}</p>
              <h2 id={titleId} className="water-drawer__title">
                {record.name || '(이름 없음)'}
              </h2>
              <WaterStagePill stage={record.stage} status={record.status} />
            </div>
            {edit && (
              <WaterButton
                variant="ghost"
                size="sm"
                icon={PenLine}
                onClick={() => edit.openEditor(record.itemId)}
              >
                수정
              </WaterButton>
            )}
            <WaterIconButton
              icon={X}
              label="닫기"
              size="sm"
              onClick={onClose}
            />
          </header>

          <div className="water-drawer__body">
            {fields.length > 0 && (
              <dl className="water-drawer__fields">
                {fields.map((field) => (
                  <div
                    key={field.label}
                    className="water-drawer__field"
                    data-water-reveal
                  >
                    <dt>{field.label}</dt>
                    <dd>{field.value ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            )}

            {texts
              .filter((t) => t.text)
              .map((t) => (
                <section
                  key={t.label}
                  className="water-drawer__section"
                  data-water-reveal
                >
                  <h3>{t.label}</h3>
                  <p className="water-drawer__text">{t.text}</p>
                </section>
              ))}

            {children && (
              <div className="water-drawer__extra" data-water-reveal>
                {children}
              </div>
            )}

            {/* 파일 칸(사진은 썸네일) — 칸 종류로 찾아서 모든 보드에 같이 나온다. 물 판: 올리기·끌어다 놓기·비우기 */}
            {edit && item && (
              <div data-water-reveal>
                <WaterItemFiles meta={edit.meta} item={item} actions={files} />
              </div>
            )}
          </div>
        </>
      )}
    </WaterDrawerShell>
  )
}

/** 상세 서랍의 작은 목록(설치 품목·청구 부품) */
export function WaterDrawerList({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="water-drawer__section">
      <h3>{title}</h3>
      <ul className="water-drawer__list">{children}</ul>
    </section>
  )
}
