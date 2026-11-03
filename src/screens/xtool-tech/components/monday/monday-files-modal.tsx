import { ExternalLink, FileText, ImageOff, LoaderCircle, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TechBoardKey, TechColumn, TechItemDoc } from '../../data/tech-boards'
import { checkFile, fetchFileLinks, FILE_ACCEPT, filesOf, type TechFileLink } from '../../data/tech-files'
import { clearFilesInBackground, uploadInBackground } from '../../data/tech-save-queue'
import { usePortalRoot } from '../../lib/portal-root'
import { ImageViewer, type ViewerImage } from '../board/image-viewer'
import { ConfirmDialog } from '../ui/confirm-dialog'

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
 * 파일 칸 모달 — 표의 파일 칸을 누르면 그 칸의 파일을 바로 보여 준다. 사진은 썸네일(누르면
 * 크게 보기), 동영상은 그 자리에서 재생, 문서는 새 탭으로 열기. 아래에서 올리기·모두 지우기
 * (뒤에서 처리 — 진행은 토스트, 바뀐 목록은 실시간으로 들어온다).
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
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

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

  const map = links.key === key ? links.map : null
  const error = links.key === key ? links.error : null
  const viewerImages: ViewerImage[] = files.flatMap((f) => {
    const url = f.isImage ? map?.get(f.assetId)?.url : null
    return url ? [{ key: f.assetId, name: f.name, url }] : []
  })
  const target = { boardKey, itemId: item.itemId, columnId: column.id }

  const pick = (list: FileList | null) => {
    if (!list) return
    const problems: string[] = []
    for (const file of Array.from(list)) {
      const reason = checkFile(file)
      if (reason) problems.push(reason)
      else uploadInBackground(target, file)
    }
    setProblem(problems.length ? problems.join(' / ') : null)
    if (input.current) input.current.value = ''
  }

  if (!root) return null
  return createPortal(
    <>
      <div className="mon-modal" role="presentation" onClick={onClose}>
        <section
          className="mon-modal__card"
          role="dialog"
          aria-modal="true"
          aria-label={`${itemName} — ${column.title}`}
          onClick={(e) => e.stopPropagation()}
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
            {files.length === 0 && <p className="mon-modal__empty">올린 파일이 없어요.</p>}
            {error && <p className="mon-modal__error">파일 주소를 받지 못했어요: {error}</p>}
            <ul className="mon-filecards">
              {files.map((f) => {
                const link = map?.get(f.assetId)
                const url = link?.url ?? null
                return (
                  <li key={f.assetId} className="mon-filecard">
                    <div className="mon-filecard__preview">
                      {!url && !error ? (
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
            </ul>
            {problem && <p className="mon-modal__error">{problem}</p>}
          </div>

          <footer className="mon-modal__foot">
            {files.length > 0 && (
              <button
                type="button"
                className="mon-modal__clear"
                onClick={() => setConfirming(true)}
              >
                <Trash2 size={14} aria-hidden />
                모두 지우기
              </button>
            )}
            <span className="mon-modal__hint">사진·동영상·문서, 10MB까지</span>
            <input
              ref={input}
              type="file"
              multiple
              accept={FILE_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => pick(e.target.files)}
            />
            <button type="button" className="mon-modal__upload" onClick={() => input.current?.click()}>
              <Upload size={14} aria-hidden />
              파일 올리기
            </button>
          </footer>
        </section>
      </div>
      <ConfirmDialog
        open={confirming}
        title={`파일 ${files.length}개를 모두 지울까요?`}
        message={`'${column.title}' 칸의 파일이 Monday에서도 지워지고 되돌릴 수 없어요.`}
        confirmLabel="모두 지우기"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          clearFilesInBackground(target, column.title)
        }}
      />
      {/* 모달 밖에 둔다 — 크게 보기의 바깥 누르기가 모달까지 닫지 않게(React 이벤트는 포털을 넘어 올라간다). */}
      <ImageViewer images={viewerImages} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </>,
    root,
  )
}
