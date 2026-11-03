import { FileText, Film, Image as ImageIcon, ImageOff, LoaderCircle, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TechBoardKey, TechBoardMeta, TechItemDoc } from '../../data/tech-boards'
import { checkFile, fetchFileLinks, FILE_ACCEPT, filesOf, type TechFileLink, type TechFileRef } from '../../data/tech-files'
import { clearFilesInBackground, uploadInBackground } from '../../data/tech-save-queue'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { ImageViewer, type ViewerImage } from './image-viewer'

const VIDEO = /\.(mp4|mov|m4v|webm|avi|mkv)$/i

const FileIcon = ({ file }: { file: TechFileRef }) =>
  file.isImage ? <ImageIcon size={14} aria-hidden /> : VIDEO.test(file.name) ? <Film size={14} aria-hidden /> : <FileText size={14} aria-hidden />

/** 항목의 파일 칸들 — 칸 제목과 파일 목록 */
const fileColumnsOf = (meta: TechBoardMeta, item: TechItemDoc) =>
  meta.columns
    .filter((c) => c.type === 'file')
    .map((c) => ({ column: c, files: filesOf(item.values[c.id]?.value) }))

/**
 * 상세 패널의 파일 — 사진은 썸네일(누르면 크게 보기), 나머지는 이름 목록(누르면 새 탭).
 * 주소는 패널을 열 때 한 번에 받는다(썸네일은 상세 패널에서만 — 목록 표에서는 받지 않는다).
 * Monday의 url_thumbnail은 Monday에 로그인해야 열리는 주소라 쓰지 않고, 썸네일도 임시
 * 공개 주소(원본)를 줄여서 보여 준다.
 */
export function ItemFiles({ meta, item }: { meta: TechBoardMeta; item: TechItemDoc }) {
  const groups = fileColumnsOf(meta, item).filter((g) => g.files.length > 0)
  const assetIds = groups.flatMap((g) => g.files.map((f) => f.assetId))
  const key = `${item.itemId}:${assetIds.join(',')}`
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
    fetchFileLinks(item.itemId, assetIds)
      .then((links) => !cancelled && setState({ key, links, error: null }))
      .catch((e: unknown) => !cancelled && setState({ key, links: null, error: e instanceof Error ? e.message : String(e) }))
    return () => {
      cancelled = true
    }
    // key가 항목·파일 목록을 대표한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (groups.length === 0) return null
  const links = state.key === key ? state.links : null
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
      {groups.map(({ column, files }) => {
        const images = files.filter((f) => f.isImage)
        const others = files.filter((f) => !f.isImage)
        return (
          <section key={column.id} className="drawer__section">
            <h3>
              {column.title} <span className="subitems__count">{files.length}개</span>
            </h3>
            {images.length > 0 && (
              <div className="file-thumbs">
                {images.map((f) => {
                  const link = links?.get(f.assetId)
                  return (
                    <button
                      key={f.assetId}
                      type="button"
                      className="file-thumb"
                      title={f.name}
                      aria-label={`${f.name} 크게 보기`}
                      disabled={!link?.url}
                      onClick={() => setViewing(viewerImages.findIndex((v) => v.key === f.assetId))}
                    >
                      {link?.url && !broken.has(f.assetId) ? (
                        <img
                          src={link.url}
                          alt={f.name}
                          loading="lazy"
                          decoding="async"
                          onError={() => setBroken((prev) => new Set(prev).add(f.assetId))}
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
              </div>
            )}
            {others.length > 0 && (
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
              </ul>
            )}
            {error && <p className="editor__error">파일 주소를 받지 못했어요: {error}</p>}
          </section>
        )
      })}
      <ImageViewer images={viewerImages} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </>
  )
}

/**
 * 편집 패널의 파일 칸 — 지금 붙은 파일 이름, "파일 올리기", "모두 지우기". 둘 다 누르는 순간
 * 뒤에서 처리된다(저장 버튼과 따로, 진행은 토스트). Monday API에 파일 하나만 지우기가 없어
 * 지우기는 칸 전체를 비운다 — 실수하지 않게 두 번 눌러야 한다.
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
  const [problem, setProblem] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const files = filesOf(current)

  // "모두 지우기" — 확인 모달에서 한 번 더 확인한다.
  const clearAll = () => {
    setConfirming(false)
    if (itemId) clearFilesInBackground({ boardKey, itemId, columnId }, label)
  }

  const pick = (list: FileList | null) => {
    if (!list || !itemId) return
    const problems: string[] = []
    for (const file of Array.from(list)) {
      const reason = checkFile(file)
      if (reason) problems.push(reason)
      else uploadInBackground({ boardKey, itemId, columnId }, file)
    }
    setProblem(problems.length ? problems.join(' / ') : null)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="file-field">
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
          {itemId && (
            <button
              type="button"
              className="file-field__clear"
              onClick={() => setConfirming(true)}
            >
              <Trash2 size={13} aria-hidden />
              모두 지우기
            </button>
          )}
        </div>
      ) : (
        <p className="file-field__empty">올린 파일 없음</p>
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
            onChange={(e) => pick(e.target.files)}
          />
          <button type="button" className="subitems__add" onClick={() => input.current?.click()}>
            <Upload size={14} aria-hidden />
            파일 올리기 <small>사진·동영상·문서, 10MB까지</small>
          </button>
          <p className="file-field__hint">고르면 바로 Monday에 올라가요 — 아래 저장 버튼과 별개라, 취소해도 올린 파일은 남아요.</p>
        </>
      ) : (
        <p className="file-field__empty">항목을 만든 뒤에 파일을 올릴 수 있어요.</p>
      )}
      {problem && <p className="editor__error">{problem}</p>}
      <ConfirmDialog
        open={confirming}
        title={`파일 ${files.length}개를 모두 지울까요?`}
        message={`'${label}' 칸의 파일이 Monday에서도 지워지고 되돌릴 수 없어요.`}
        confirmLabel="모두 지우기"
        onCancel={() => setConfirming(false)}
        onConfirm={clearAll}
      />
    </div>
  )
}
