import { ExternalLink, FileText, ImageOff, LoaderCircle, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TechBoardKey, TechColumn, TechItemDoc } from '../../data/tech-boards'
import { techFileActions } from '../../data/tech-file-actions'
import { fetchFileLinks, FILE_ACCEPT, filesOf, type TechFileLink } from '../../data/tech-files'
import { cx } from '@/ohq-ui/lib/cx'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'
import { ImageViewer, type ViewerImage } from '../board/image-viewer'
import { uploadLabel, uploadPercent, useFileColumn, useFileDrop, type FileUpload } from '../board/use-file-column'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'

const VIDEO = /\.(mp4|mov|m4v|webm)$/i

interface FilesModalProps {
  boardKey: TechBoardKey
  item: TechItemDoc
  /** 보여 줄 파일 칸 */
  column: TechColumn
  /** 모달 제목에 쓸 항목 이름 */
  itemName: string
  onClose: () => void
}

/**
 * 올리는 중인 파일 카드 — 사진은 이 기기 미리보기, 아래에 Monday 파란 막대가 차오른다. 실패면 이유와
 * 다시 시도·닫기(실패 토스트의 "다시 시도"도 이 카드로 돌아온다).
 */
function PendingCard({ upload, onRetry, onDismiss }: { upload: FileUpload; onRetry: () => void; onDismiss: () => void }) {
  const failed = upload.state === 'fail'
  const name = upload.file.name
  return (
    <li className={cx('mon-filecard', 'is-pending', failed && 'is-failed')} aria-label={`${name} — ${uploadLabel(upload)}`}>
      <div className="mon-filecard__preview">
        {upload.preview ? (
          <img src={upload.preview} alt="" />
        ) : (
          <span className="mon-filecard__icon">
            <FileText size={24} aria-hidden />
            {name.split('.').pop()?.toUpperCase()}
          </span>
        )}
      </div>
      {!failed && (
        <span
          className="mon-filecard__bar"
          role="progressbar"
          aria-label={`${name} 올리는 중`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={uploadPercent(upload)}
        >
          <span style={{ transform: `scaleX(${upload.ratio})` }} />
        </span>
      )}
      <div className="mon-filecard__meta">
        <span title={name}>{name}</span>
        <small className="mon-filecard__state">{uploadLabel(upload)}</small>
        {failed && (
          <>
            <button type="button" className="mon-filecard__act" aria-label={`${name} 다시 올리기`} title="다시 시도" onClick={onRetry}>
              <RotateCcw size={14} aria-hidden />
            </button>
            <button type="button" className="mon-filecard__act" aria-label={`${name} 닫기`} title="닫기" onClick={onDismiss}>
              <X size={14} aria-hidden />
            </button>
          </>
        )}
      </div>
      {failed && <p className="mon-filecard__error">{upload.error}</p>}
    </li>
  )
}

/**
 * 파일 칸 모달 — 표의 파일 칸을 누르면 그 칸의 파일을 바로 보여 준다. 사진은 썸네일(누르면
 * 크게 보기), 동영상은 그 자리에서 재생, 문서는 새 탭으로 열기. 아래에서 올리기·모두 지우기, 모달 어디에
 * 끌어다 놓아도 올라간다(뒤에서 처리 — 진행은 카드 막대와 토스트, 바뀐 목록은 실시간으로 들어온다).
 * 올리기·실패·다시 시도·비우기 규칙은 대시보드·물 파일 칸과 같다(board/use-file-column.ts).
 */
export function FilesModal({ boardKey, item, column, itemName, onClose }: FilesModalProps) {
  const root = usePortalRoot()
  const files = filesOf(item.values[column.id]?.value)
  const assetIds = files.map((f) => f.assetId)
  const key = assetIds.join(',')
  const [links, setLinks] = useState<{ key: string; map: Map<string, TechFileLink> | null; error: string | null }>({
    key: '',
    map: null,
    error: null,
  })
  const [viewing, setViewing] = useState<number | null>(null)
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set())
  const input = useRef<HTMLInputElement>(null)
  const actions = useMemo(() => techFileActions(boardKey), [boardKey])
  const col = useFileColumn({ itemId: item.itemId, columnId: column.id, label: column.title }, actions, files)
  const drop = useFileDrop(col.pick)

  useEffect(() => {
    if (assetIds.length === 0) return
    let cancelled = false
    fetchFileLinks(item.itemId, assetIds)
      .then((map) => !cancelled && setLinks({ key, map, error: null }))
      .catch((e: unknown) => !cancelled && setLinks({ key, map: null, error: e instanceof Error ? e.message : String(e) }))
    return () => {
      cancelled = true
    }
    // key가 파일 목록을 대표한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.itemId, key])

  useEffect(() => {
    // 크게 보기가 열려 있으면 그쪽이 Esc를 먼저 받는다(capture).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 받아 둔 주소는 새로 받는 동안에도 쓴다(파일이 늘 때 있던 카드까지 도는 표시로 돌아가지 않게) — 새 파일만
  // 지금 목록의 주소를 받을 때까지(settled) 도는 표시
  const map = links.map
  const settled = links.key === key && map !== null
  const error = links.key === key ? links.error : null
  const viewerImages: ViewerImage[] = files.flatMap((f) => {
    const url = f.isImage ? map?.get(f.assetId)?.url : null
    return url ? [{ key: f.assetId, name: f.name, url }] : []
  })
  const pickFiles = () => input.current?.click()

  if (!root) return null
  return createPortal(
    <>
      <div className="mon-modal" role="presentation" onClick={onClose}>
        <section
          className={cx('mon-modal__card', drop.dragging && 'is-dragging')}
          role="dialog"
          aria-modal="true"
          aria-label={`${itemName} — ${column.title}`}
          aria-busy={col.busy || undefined}
          onClick={(e) => e.stopPropagation()}
          {...drop.dropProps}
        >
          <header className="mon-modal__head">
            <div>
              <h2>{column.title}</h2>
              <p>
                {itemName} · 파일 {files.length}개
              </p>
            </div>
            <button type="button" className="mon-modal__close" aria-label="닫기" onClick={onClose}>
              <X size={18} aria-hidden />
            </button>
          </header>

          <div className="mon-modal__body">
            {files.length === 0 && col.uploads.length === 0 && (
              <button type="button" className="mon-dropzone" onClick={pickFiles}>
                <Upload size={22} aria-hidden />
                <span>여기에 파일을 끌어다 놓거나 눌러서 고르세요</span>
                <small>사진·동영상·문서, 10MB까지</small>
              </button>
            )}
            {error && <p className="mon-modal__error">파일 주소를 받지 못했어요: {error}</p>}
            {(files.length > 0 || col.uploads.length > 0) && (
              <ul className="mon-filecards">
                {files.map((f) => {
                  const link = map?.get(f.assetId)
                  // 방금 올린 사진은 Monday 주소가 올 때까지 이 기기 미리보기로 이어 보인다
                  const url = link?.url ?? null
                  const local = url ? null : col.previewOf(f.name)
                  return (
                    <li key={f.assetId} className="mon-filecard">
                      <div className="mon-filecard__preview">
                        {local ? (
                          <img src={local} alt="" />
                        ) : !url && !error && !settled ? (
                          <LoaderCircle size={18} className="is-spinning" aria-hidden />
                        ) : url && f.isImage && !broken.has(f.assetId) ? (
                          <button
                            type="button"
                            className="mon-filecard__image"
                            aria-label={`${f.name} 크게 보기`}
                            onClick={() => setViewing(viewerImages.findIndex((v) => v.key === f.assetId))}
                          >
                            <img src={url} alt={f.name} onError={() => setBroken((prev) => new Set(prev).add(f.assetId))} />
                          </button>
                        ) : url && VIDEO.test(f.name) ? (
                          <video src={url} controls preload="metadata" />
                        ) : (
                          <span className="mon-filecard__icon">
                            {f.isImage ? <ImageOff size={24} aria-hidden /> : <FileText size={24} aria-hidden />}
                            {f.name.split('.').pop()?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="mon-filecard__meta">
                        <span title={f.name}>{f.name}</span>
                        {url && (
                          <a href={url} target="_blank" rel="noreferrer" aria-label={`${f.name} 원본 열기`}>
                            <ExternalLink size={14} aria-hidden />
                          </a>
                        )}
                      </div>
                    </li>
                  )
                })}
                {col.uploads.map((u) => (
                  <PendingCard key={`up-${u.id}`} upload={u} onRetry={() => col.retry(u)} onDismiss={() => col.dismiss(u)} />
                ))}
              </ul>
            )}
            {col.problem && <p className="mon-modal__error">{col.problem}</p>}
            {col.clearing.error && (
              <p className="mon-modal__error">
                {column.title} 지우기에 실패했어요: {col.clearing.error}
              </p>
            )}
          </div>

          <footer className="mon-modal__foot">
            {files.length > 0 && (
              <button type="button" className="mon-modal__clear" disabled={col.clearing.busy} onClick={col.askClear}>
                <Trash2 size={14} aria-hidden />
                {col.clearing.busy ? '지우는 중…' : '모두 지우기'}
              </button>
            )}
            <span className="mon-modal__hint">끌어다 놓아도 돼요 · 사진·동영상·문서, 10MB까지</span>
            <input
              ref={input}
              type="file"
              multiple
              accept={FILE_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                col.pick(e.target.files)
                e.target.value = ''
              }}
            />
            <button type="button" className="mon-modal__upload" onClick={pickFiles}>
              <Upload size={14} aria-hidden />
              파일 올리기
            </button>
          </footer>

          <span className="mon-modal__drop" aria-hidden>
            <Upload size={22} />
            놓으면 이 칸에 올라가요
          </span>
          <p className="sr-only" role="status">
            {col.status}
          </p>
        </section>
      </div>
      <ConfirmDialog
        open={col.confirming}
        title={`파일 ${files.length}개를 모두 지울까요?`}
        message={`'${column.title}' 칸의 파일이 Monday에서도 지워지고 되돌릴 수 없어요.`}
        confirmLabel="모두 지우기"
        onCancel={col.cancelClear}
        onConfirm={col.runClear}
      />
      {/* 모달 밖에 둔다 — 크게 보기의 바깥 누르기가 모달까지 닫지 않게(React 이벤트는 포털을 넘어 올라간다). */}
      <ImageViewer images={viewerImages} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </>,
    root,
  )
}
