import { FileText, Film, Image as ImageIcon, ImageOff, LoaderCircle, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TechBoardKey, TechBoardMeta, TechColumn, TechItemDoc } from '../../data/tech-boards'
import { techFileActions, type TechFileActions } from '../../data/tech-file-actions'
import { fetchFileLinks, FILE_ACCEPT, filesOf, type TechFileLink, type TechFileRef } from '../../data/tech-files'
import { Button } from '@/ohq-ui/components/button'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { cx } from '@/ohq-ui/lib/cx'
import { useBoardEdit } from './board-edit-context'
import { ImageViewer, type ViewerImage } from './image-viewer'
import { uploadLabel, uploadPercent, useFileColumn, useFileDrop, type FileUpload } from './use-file-column'

// 파일 칸(대시보드) — 상세 패널의 파일(ItemFiles)과 수정 패널의 파일 칸(FileField). 올리기·끌어다 놓기·진행·
// 실패 시 다시 시도·모두 지우기는 세 레이아웃(대시보드·Monday 표·물)이 같은 규칙(use-file-column.ts)과 같은 길
// (data/tech-file-actions.ts)을 쓴다. 스타일은 styles/boards/_files.scss(썸네일·목록)·styles/_item-files.scss(올리기).

const VIDEO = /\.(mp4|mov|m4v|webm|avi|mkv)$/i

const FileIcon = ({ file }: { file: { name: string; isImage: boolean } }) =>
  file.isImage ? <ImageIcon size={14} aria-hidden /> : VIDEO.test(file.name) ? <Film size={14} aria-hidden /> : <FileText size={14} aria-hidden />

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** 칸 안 진행 막대 — 토스트와 같은 비율. 막대만 움직인다(transform) */
function UploadBar({ upload }: { upload: FileUpload }) {
  return (
    <span
      className="file-progress"
      role="progressbar"
      aria-label={`${upload.file.name} 올리는 중`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={uploadPercent(upload)}
    >
      <span style={{ transform: `scaleX(${upload.ratio})` }} />
    </span>
  )
}

/** 실패한 올리기의 다시 시도·닫기 */
function RetryButtons({ upload, onRetry, onDismiss }: { upload: FileUpload; onRetry: () => void; onDismiss: () => void }) {
  return (
    <>
      <button type="button" className="file-act" aria-label={`${upload.file.name} 다시 올리기`} title="다시 시도" onClick={onRetry}>
        <RotateCcw size={13} aria-hidden />
      </button>
      <button type="button" className="file-act" aria-label={`${upload.file.name} 닫기`} title="닫기" onClick={onDismiss}>
        <X size={13} aria-hidden />
      </button>
    </>
  )
}

/** 올리는 중인 사진 — 이 기기 미리보기 위에 막대가 차오른다. 실패면 다시 시도·닫기 */
function PendingThumb({ upload, onRetry, onDismiss }: { upload: FileUpload; onRetry: () => void; onDismiss: () => void }) {
  const failed = upload.state === 'fail'
  return (
    <div
      className={cx('file-thumb', 'is-pending', failed && 'is-failed')}
      role="group"
      aria-label={`${upload.file.name} — ${uploadLabel(upload)}`}
      title={failed ? `${upload.file.name}: ${upload.error}` : upload.file.name}
    >
      {upload.preview && <img src={upload.preview} alt="" />}
      {failed ? (
        <span className="file-thumb__fail">
          <RetryButtons upload={upload} onRetry={onRetry} onDismiss={onDismiss} />
        </span>
      ) : (
        <UploadBar upload={upload} />
      )}
    </div>
  )
}

/** 올리는 중인 문서·동영상 한 줄 — 이름 · 막대 · %(실패면 빨간 "실패" + 다시 시도·닫기) */
function PendingRow({ upload, onRetry, onDismiss }: { upload: FileUpload; onRetry: () => void; onDismiss: () => void }) {
  const failed = upload.state === 'fail'
  return (
    <li className={cx('file-pending', failed && 'is-failed')} title={failed ? `${upload.file.name}: ${upload.error}` : undefined}>
      <span className="file-list__name file-pending__name">
        <FileIcon file={{ name: upload.file.name, isImage: upload.isImage }} />
        <span>{upload.file.name}</span>
      </span>
      {failed ? (
        <>
          <span className="file-pending__fail">실패</span>
          <RetryButtons upload={upload} onRetry={onRetry} onDismiss={onDismiss} />
        </>
      ) : (
        <>
          <UploadBar upload={upload} />
          <span className="drawer__list-meta file-pending__pct">{uploadLabel(upload)}</span>
        </>
      )}
    </li>
  )
}

interface ColumnProps {
  itemId: string
  column: TechColumn
  files: TechFileRef[]
  links: Map<string, TechFileLink> | null
  error: string | null
  broken: ReadonlySet<string>
  onBroken: (assetId: string) => void
  onView: (assetId: string) => void
  actions?: TechFileActions
}

/**
 * 상세 패널의 파일 칸 하나 — 제목·개수, 사진 썸네일, 문서 목록. 올리기가 있으면 "올리기" 단추와 끌어다 놓기
 * 자리가 되고(칸 위에 점선 자리가 뜬다), 올리는 중인 파일은 칸 안에 막대로 차오른다. 실패하면 그 자리에서
 * 다시 시도·닫기. 비우기가 있으면 "모두 지우기"(확인창 — Monday엔 파일 하나만 지우기가 없다).
 */
function FileColumn({ itemId, column, files, links, error, broken, onBroken, onView, actions }: ColumnProps) {
  const input = useRef<HTMLInputElement>(null)
  const col = useFileColumn({ itemId, columnId: column.id, label: column.title }, actions, files)
  const drop = useFileDrop(col.canUpload ? col.pick : null)
  const images = files.filter((f) => f.isImage)
  const others = files.filter((f) => !f.isImage)
  const upImages = col.uploads.filter((u) => u.isImage)
  const upOthers = col.uploads.filter((u) => !u.isImage)

  return (
    <section
      className={cx(
        'drawer__section',
        'file-section',
        col.canUpload && 'is-droppable',
        drop.dragging && 'is-dragging',
        col.clearing.busy && 'is-clearing',
      )}
      data-column={column.id}
      aria-busy={col.busy || undefined}
      {...drop.dropProps}
    >
      <div className="file-section__head">
        <h3>
          {column.title} <span className="subitems__count">{files.length}개</span>
        </h3>
        {col.canClear && files.length > 0 && (
          <Button variant="ghost" size="sm" icon={Trash2} disabled={col.clearing.busy} onClick={col.askClear}>
            {col.clearing.busy ? '지우는 중…' : '모두 지우기'}
          </Button>
        )}
        {col.canUpload && (
          <Button variant="ghost" size="sm" icon={Upload} onClick={() => input.current?.click()}>
            올리기
          </Button>
        )}
      </div>

      {(images.length > 0 || upImages.length > 0) && (
        <div className="file-thumbs">
          {images.map((f) => {
            const link = links?.get(f.assetId)
            // 방금 올린 사진은 Monday 주소가 올 때까지 이 기기 미리보기로 이어 보인다
            const src = link?.url ?? col.previewOf(f.name)
            return (
              <button
                key={f.assetId}
                type="button"
                className="file-thumb"
                title={f.name}
                aria-label={`${f.name} 크게 보기`}
                disabled={!link?.url}
                onClick={() => onView(f.assetId)}
              >
                {src && !broken.has(f.assetId) ? (
                  <img
                    src={src}
                    alt={f.name}
                    loading="lazy"
                    decoding="async"
                    onError={link?.url ? () => onBroken(f.assetId) : undefined}
                  />
                ) : link?.url ? (
                  <span className="file-thumb__fallback">
                    <ImageOff size={16} aria-hidden />
                    {f.name.split('.').pop()?.toUpperCase()}
                  </span>
                ) : (
                  <LoaderCircle size={16} className={error ? undefined : 'is-spinning'} aria-hidden />
                )}
              </button>
            )
          })}
          {upImages.map((u) => (
            <PendingThumb key={`up-${u.id}`} upload={u} onRetry={() => col.retry(u)} onDismiss={() => col.dismiss(u)} />
          ))}
        </div>
      )}

      {(others.length > 0 || upOthers.length > 0) && (
        <ul className="drawer__list file-list">
          {others.map((f) => {
            const link = links?.get(f.assetId)
            return (
              <li key={f.assetId}>
                <span className="file-list__name">
                  <FileIcon file={f} />
                  {f.name}
                </span>
                {link?.url ? (
                  <a href={link.url} target="_blank" rel="noreferrer" className="drawer__list-meta">
                    열기
                  </a>
                ) : (
                  <span className="drawer__list-meta">{error ? '—' : '…'}</span>
                )}
              </li>
            )
          })}
          {upOthers.map((u) => (
            <PendingRow key={`up-${u.id}`} upload={u} onRetry={() => col.retry(u)} onDismiss={() => col.dismiss(u)} />
          ))}
        </ul>
      )}

      {col.canUpload && files.length === 0 && col.uploads.length === 0 && (
        <p className="file-section__hint">
          <Upload size={14} aria-hidden />
          끌어다 놓거나 "올리기" — 사진·동영상·문서, 10MB까지
        </p>
      )}

      {error && <p className="editor__error">파일 주소를 받지 못했어요: {error}</p>}
      {col.problem && <p className="editor__error">{col.problem}</p>}
      {col.clearing.error && (
        <p className="editor__error">
          {column.title} 지우기에 실패했어요: {col.clearing.error}
        </p>
      )}

      {col.canUpload && (
        <>
          <input
            ref={input}
            type="file"
            multiple
            accept={FILE_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              col.pick(e.target.files)
              e.target.value = ''
            }}
          />
          <span className="file-drop" aria-hidden>
            <Upload size={18} />
            놓으면 올라가요
          </span>
        </>
      )}
      <p className="sr-only" role="status">
        {col.status}
      </p>

      {col.canClear && (
        <ConfirmDialog
          open={col.confirming}
          title={`파일 ${files.length}개를 모두 지울까요?`}
          message={`'${column.title}' 칸의 파일이 Monday에서도 지워지고 되돌릴 수 없어요.`}
          confirmLabel="모두 지우기"
          onCancel={col.cancelClear}
          onConfirm={col.runClear}
        />
      )}
    </section>
  )
}

/**
 * 상세 패널의 파일 — 사진은 썸네일(누르면 크게 보기), 나머지는 이름 목록(누르면 새 탭).
 * 주소는 패널을 열 때 한 번에 받는다(썸네일은 상세 패널에서만 — 목록 표에서는 받지 않는다).
 * Monday의 url_thumbnail은 Monday에 로그인해야 열리는 주소라 쓰지 않고, 썸네일도 임시
 * 공개 주소(원본)를 줄여서 보여 준다.
 * 보드 화면 안(편집 도구가 있을 때)이면 올리기·끌어다 놓기·모두 지우기도 된다 — 수정 패널 FileField와 같은 길·
 * 토스트이고, 올리기가 있으면 빈 칸도 보여 놓을 자리가 된다. actions로 바꿔 끼울 수 있다(null이면 보기만).
 */
export function ItemFiles({
  meta,
  item,
  actions,
}: {
  meta: TechBoardMeta
  item: TechItemDoc
  /** 올리기·비우기·주소 받기 — 없으면 이 보드의 Monday 올리기(편집 도구가 있을 때), null이면 보기만 */
  actions?: TechFileActions | null
}) {
  const boardKey = useBoardEdit()?.boardKey
  const real = useMemo(() => (boardKey ? techFileActions(boardKey) : undefined), [boardKey])
  const acts = actions === undefined ? real : (actions ?? undefined)
  const groups = meta.columns
    .filter((c) => c.type === 'file')
    .map((column) => ({ column, files: filesOf(item.values[column.id]?.value) }))
  const shown = acts?.upload ? groups : groups.filter((g) => g.files.length > 0)
  const assetIds = groups.flatMap((g) => g.files.map((f) => f.assetId))
  const key = `${item.itemId}:${assetIds.join(',')}`
  const fetchLinks = acts?.links ?? fetchFileLinks
  const [state, setState] = useState<{ key: string; links: Map<string, TechFileLink> | null; error: string | null }>({
    key: '',
    links: null,
    error: null,
  })
  const [viewing, setViewing] = useState<number | null>(null)
  // 썸네일을 못 그린 사진(HEIC 등 브라우저가 모르는 형식)
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (assetIds.length === 0) return
    let cancelled = false
    fetchLinks(item.itemId, assetIds)
      .then((links) => !cancelled && setState({ key, links, error: null }))
      .catch((e: unknown) => !cancelled && setState({ key, links: null, error: messageOf(e) }))
    return () => {
      cancelled = true
    }
    // key가 항목·파일 목록을 대표한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fetchLinks])

  if (shown.length === 0) return null
  // 받아 둔 주소는 새로 받는 동안에도 쓴다(같은 항목이면 — 파일이 늘 때 있던 썸네일까지 도는 표시로 돌아가지 않게)
  const links = state.key.startsWith(`${item.itemId}:`) ? state.links : null
  const error = state.key === key ? state.error : null
  // 크게 보기로 넘겨 볼 사진 — 칸이 여러 개여도 한 줄로 이어서 넘긴다.
  const viewerImages: ViewerImage[] = groups.flatMap((g) =>
    g.files.flatMap((f) => {
      const url = f.isImage ? links?.get(f.assetId)?.url : null
      return url ? [{ key: f.assetId, name: f.name, url }] : []
    }),
  )

  return (
    <>
      {shown.map(({ column, files }) => (
        <FileColumn
          key={`${item.itemId}:${column.id}`}
          itemId={item.itemId}
          column={column}
          files={files}
          links={links}
          error={error}
          broken={broken}
          onBroken={(id) => setBroken((prev) => new Set(prev).add(id))}
          onView={(id) => setViewing(viewerImages.findIndex((v) => v.key === id))}
          actions={acts}
        />
      ))}
      <ImageViewer images={viewerImages} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </>
  )
}

/**
 * 편집 패널의 파일 칸 — 지금 붙은 파일 이름, "파일 올리기"(끌어다 놓아도 된다), "모두 지우기". 누르는·놓는
 * 순간 뒤에서 처리된다(저장 버튼과 따로 — 진행은 칸 안 막대와 토스트). Monday API에 파일 하나만 지우기가 없어
 * 지우기는 칸 전체를 비운다 — 실수하지 않게 확인창에서 한 번 더 누른다.
 */
export function FileField({
  id,
  boardKey,
  itemId,
  columnId,
  current,
  label,
}: {
  id: string
  boardKey: TechBoardKey
  /** 칸 이름 — 토스트 문구에 쓴다 */
  label: string
  /** 새로 만들 때는 없음 — 만든 뒤에 올릴 수 있다 */
  itemId: string | null
  columnId: string
  current: string | null | undefined
}) {
  const input = useRef<HTMLInputElement>(null)
  const files = filesOf(current)
  const actions = useMemo(() => techFileActions(boardKey), [boardKey])
  const col = useFileColumn(itemId ? { itemId, columnId, label } : null, actions, files)
  const drop = useFileDrop(col.canUpload ? col.pick : null)

  return (
    <div
      className={cx('file-field', col.canUpload && 'is-droppable', drop.dragging && 'is-dragging')}
      aria-busy={col.busy || undefined}
      {...drop.dropProps}
    >
      {files.length > 0 ? (
        <div className="file-field__current">
          <ul className="file-field__list">
            {files.map((f) => (
              <li key={f.assetId}>
                <FileIcon file={f} />
                {f.name}
              </li>
            ))}
          </ul>
          {col.canClear && (
            <button type="button" className="file-field__clear" disabled={col.clearing.busy} onClick={col.askClear}>
              <Trash2 size={13} aria-hidden />
              {col.clearing.busy ? '지우는 중…' : '모두 지우기'}
            </button>
          )}
        </div>
      ) : (
        col.uploads.length === 0 && <p className="file-field__empty">올린 파일 없음</p>
      )}
      {col.uploads.length > 0 && (
        <ul className="file-field__list file-field__uploads">
          {col.uploads.map((u) => (
            <PendingRow key={u.id} upload={u} onRetry={() => col.retry(u)} onDismiss={() => col.dismiss(u)} />
          ))}
        </ul>
      )}
      {itemId ? (
        <>
          <input
            ref={input}
            id={id}
            type="file"
            multiple
            accept={FILE_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              col.pick(e.target.files)
              e.target.value = ''
            }}
          />
          <button type="button" className="subitems__add" onClick={() => input.current?.click()}>
            <Upload size={14} aria-hidden />
            파일 올리기 <small>사진·동영상·문서, 10MB까지</small>
          </button>
          <p className="file-field__hint">
            고르거나 끌어다 놓으면 바로 Monday에 올라가요 — 아래 저장 버튼과 별개라, 취소해도 올린 파일은 남아요.
          </p>
          <span className="file-drop" aria-hidden>
            <Upload size={18} />
            놓으면 올라가요
          </span>
        </>
      ) : (
        <p className="file-field__empty">항목을 만든 뒤에 파일을 올릴 수 있어요.</p>
      )}
      {col.problem && <p className="editor__error">{col.problem}</p>}
      {col.clearing.error && (
        <p className="editor__error">
          {label} 지우기에 실패했어요: {col.clearing.error}
        </p>
      )}
      <p className="sr-only" role="status">
        {col.status}
      </p>
      <ConfirmDialog
        open={col.confirming}
        title={`파일 ${files.length}개를 모두 지울까요?`}
        message={`'${label}' 칸의 파일이 Monday에서도 지워지고 되돌릴 수 없어요.`}
        confirmLabel="모두 지우기"
        onCancel={col.cancelClear}
        onConfirm={col.runClear}
      />
    </div>
  )
}
