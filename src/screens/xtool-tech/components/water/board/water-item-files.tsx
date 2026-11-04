import { FileText, Film, Image as ImageIcon, ImageOff, LoaderCircle, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cx } from '@/ohq-ui/lib/cx'
import { WaterBar } from '@/ohq-ui/water/charts/water-bar'
import { WaterButton, WaterDialog, WaterIconButton } from '@/ohq-ui/water/controls'
import { useReducedMotion, useWaterRipple } from '@/ohq-ui/water/hooks'
import { rippleAt } from '@/ohq-ui/water/ripple'
import { WaterFlag } from '@/ohq-ui/water/surfaces/water-flag'
import type { TechBoardMeta, TechColumn, TechItemDoc } from '../../../data/tech-boards'
import type { TechFileActions } from '../../../data/tech-file-actions'
import {
  fetchFileLinks,
  FILE_ACCEPT,
  filesOf,
  type TechFileLink,
  type TechFileRef,
} from '../../../data/tech-files'
import { ImageViewer, type ViewerImage } from '../../board/image-viewer'
import { uploadLabel, useFileColumn, useFileDrop, type FileUpload } from '../../board/use-file-column'

const VIDEO = /\.(mp4|mov|m4v|webm|avi|mkv)$/i

const FileIcon = ({ name, isImage }: { name: string; isImage: boolean }) =>
  isImage ? (
    <ImageIcon size={14} aria-hidden />
  ) : VIDEO.test(name) ? (
    <Film size={14} aria-hidden />
  ) : (
    <FileText size={14} aria-hidden />
  )

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * 사진 썸네일 — 누르면 크게 보기. 주소를 받기 전에는 빈 홈 + 도는 표시, 못 그리는 형식(HEIC 등)은 확장자.
 * 방금 올린 사진은 Monday 주소가 올 때까지 이 기기 미리보기(placeholder)로 이어 보인다. 칸이 처음 나타날 때만
 * 차례로 진해지고(index), 나중에 들어온 파일(index null)은 올리던 칸 자리에 바로 선다
 */
function Thumb({
  file,
  link,
  placeholder,
  failed,
  broken,
  index,
  onBroken,
  onView,
}: {
  file: TechFileRef
  link: TechFileLink | undefined
  placeholder: string | null
  failed: boolean
  broken: boolean
  index: number | null
  onBroken: () => void
  onView: () => void
}) {
  const src = link?.url ?? placeholder
  return (
    <button
      type="button"
      className={cx('water-files__thumb', index !== null && 'water-reveal')}
      style={index !== null ? ({ '--w-i': index } as CSSProperties) : undefined}
      title={file.name}
      aria-label={`${file.name} 크게 보기`}
      disabled={!link?.url}
      onClick={onView}
    >
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={link?.url ? onBroken : undefined} />
      ) : link?.url ? (
        <span className="water-files__fallback">
          <ImageOff size={16} aria-hidden />
          {file.name.split('.').pop()?.toUpperCase()}
        </span>
      ) : (
        <LoaderCircle size={16} className={cx('water-files__spin', !failed && 'is-spinning')} aria-hidden />
      )}
    </button>
  )
}

/** 올리는 중인 사진 — 이 기기 미리보기 위에 홈 막대가 차오른다(extend 스프링). 실패면 다시 시도·닫기 */
function PendingThumb({ p, onRetry, onDismiss }: { p: FileUpload; onRetry: () => void; onDismiss: () => void }) {
  const failed = p.state === 'fail'
  return (
    <div
      className={cx('water-files__thumb', 'water-reveal', 'is-pending', failed && 'is-failed')}
      role="group"
      aria-label={`${p.file.name} — ${uploadLabel(p)}`}
      title={failed ? `${p.file.name}: ${p.error}` : p.file.name}
    >
      {p.preview && <img src={p.preview} alt="" />}
      {failed ? (
        <span className="water-files__thumb-fail">
          <WaterIconButton icon={RotateCcw} label={`${p.file.name} 다시 올리기`} size="sm" onClick={onRetry} />
          <WaterIconButton icon={X} label={`${p.file.name} 닫기`} size="sm" onClick={onDismiss} />
        </span>
      ) : (
        <span className="water-files__thumb-bar">
          <WaterBar value={p.ratio} size="sm" />
        </span>
      )}
    </div>
  )
}

/** 올리는 중인 문서·동영상 한 줄 — 이름 · 홈 막대 · % (실패면 빨간 점 + 다시 시도·닫기) */
function PendingRow({ p, onRetry, onDismiss }: { p: FileUpload; onRetry: () => void; onDismiss: () => void }) {
  const failed = p.state === 'fail'
  return (
    <li className={cx('water-files__row', 'water-reveal', 'is-pending', failed && 'is-failed')}>
      <span className="water-files__name" title={p.file.name}>
        <FileIcon name={p.file.name} isImage={false} />
        <span>{p.file.name}</span>
      </span>
      {failed ? (
        <>
          <WaterFlag tone="crit" className="water-files__flag">
            실패
          </WaterFlag>
          <WaterIconButton icon={RotateCcw} label={`${p.file.name} 다시 올리기`} size="sm" onClick={onRetry} />
          <WaterIconButton icon={X} label={`${p.file.name} 닫기`} size="sm" onClick={onDismiss} />
        </>
      ) : (
        <>
          <WaterBar value={p.ratio} size="sm" className="water-files__bar" />
          <span className="water-files__pct">{uploadLabel(p)}</span>
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
 * 파일 칸 하나 — 제목·개수, 사진 썸네일, 문서 목록. 올리기(actions.upload)가 있으면 "올리기" 단추와 끌어다 놓기
 * 자리가 되고, 올리는 중인 파일은 칸 안에 홈 막대로 차오른다. 놓는 순간 그 자리에서 D7 물결 두 겹이 퍼진다.
 * 비우기(actions.clear)가 있으면 "모두 지우기"(확인 대화상자 — Monday엔 파일 하나만 지우기가 없다).
 */
function FileColumn({ itemId, column, files, links, error, broken, onBroken, onView, actions }: ColumnProps) {
  const reduced = useReducedMotion()
  const input = useRef<HTMLInputElement>(null)
  const zone = useRef<HTMLElement>(null)
  const { ref: rippleRef, engine: ripple } = useWaterRipple()
  // 올리기·비우기·실패·다시 시도 — 세 레이아웃의 파일 칸이 같이 쓰는 규칙(components/board/use-file-column.ts)
  const col = useFileColumn({ itemId, columnId: column.id, label: column.title }, actions, files)
  // 끌어다 놓기 — 놓은 자리에서 D7 물결 두 겹(반지름 22 → 초속 525px, 0.3초) — 칸 크기 그대로, 배율 0.75
  const drop = useFileDrop(
    col.canUpload
      ? (list, e) => {
          const svg = rippleRef.current
          const el = zone.current
          if (svg && el && !reduced) {
            ripple.current?.play({
              ...rippleAt(svg, el, { radius: 16, point: { x: e.clientX, y: e.clientY } }),
              scale: 0.75,
            })
          }
          col.pick(list)
        }
      : null,
  )
  // 칸이 처음 그려질 때 있던 파일 — 이것만 차례로 진해진다(나중에 올린 것은 올리던 자리에 바로 선다)
  const [initial] = useState(() => new Set(files.map((f) => f.assetId)))
  const upload = col.canUpload
  const clear = col.canClear
  const images = files.filter((f) => f.isImage)
  const others = files.filter((f) => !f.isImage)
  const upImages = col.uploads.filter((p) => p.isImage)
  const upOthers = col.uploads.filter((p) => !p.isImage)

  return (
    <section
      ref={zone}
      className={cx('water-files', upload && 'is-droppable', drop.dragging && 'is-dragging', col.clearing.busy && 'is-clearing')}
      data-column={column.id}
      aria-busy={col.busy || undefined}
      {...drop.dropProps}
    >
      <header className="water-files__head">
        <h3 className="water-files__title">
          {column.title} <span className="water-files__count">{files.length}개</span>
        </h3>
        {(upload || (clear && files.length > 0)) && (
          <div className="water-files__actions">
            {clear && files.length > 0 && (
              <WaterButton
                variant="ghost"
                size="sm"
                icon={Trash2}
                disabled={col.clearing.busy}
                onClick={col.askClear}
              >
                {col.clearing.busy ? '지우는 중…' : '모두 지우기'}
              </WaterButton>
            )}
            {upload && (
              <WaterButton variant="ghost" size="sm" icon={Upload} onClick={() => input.current?.click()}>
                올리기
              </WaterButton>
            )}
          </div>
        )}
      </header>

      {(images.length > 0 || upImages.length > 0) && (
        <div className="water-files__thumbs">
          {images.map((f, i) => (
            <Thumb
              key={f.assetId}
              file={f}
              link={links?.get(f.assetId)}
              placeholder={col.previewOf(f.name)}
              failed={!!error}
              broken={broken.has(f.assetId)}
              index={initial.has(f.assetId) ? i : null}
              onBroken={() => onBroken(f.assetId)}
              onView={() => onView(f.assetId)}
            />
          ))}
          {upImages.map((p) => (
            <PendingThumb key={`up-${p.id}`} p={p} onRetry={() => col.retry(p)} onDismiss={() => col.dismiss(p)} />
          ))}
        </div>
      )}

      {(others.length > 0 || upOthers.length > 0) && (
        <ul className="water-files__list">
          {others.map((f, i) => {
            const link = links?.get(f.assetId)
            return (
              <li
                key={f.assetId}
                className={cx('water-files__row', initial.has(f.assetId) && 'water-reveal')}
                style={initial.has(f.assetId) ? ({ '--w-i': i } as CSSProperties) : undefined}
              >
                <span className="water-files__name" title={f.name}>
                  <FileIcon name={f.name} isImage={f.isImage} />
                  <span>{f.name}</span>
                </span>
                {link?.url ? (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="water-files__open"
                    aria-label={`${f.name} 열기`}
                  >
                    열기
                  </a>
                ) : (
                  <span className="water-files__meta">{error ? '—' : '…'}</span>
                )}
              </li>
            )
          })}
          {upOthers.map((p) => (
            <PendingRow key={`up-${p.id}`} p={p} onRetry={() => col.retry(p)} onDismiss={() => col.dismiss(p)} />
          ))}
        </ul>
      )}

      {upload && files.length === 0 && col.uploads.length === 0 && (
        <p className="water-files__hint">
          <Upload size={14} aria-hidden />
          끌어다 놓거나 "올리기" — 사진·동영상·문서, 10MB까지
        </p>
      )}

      {error && <p className="water-files__error">파일 주소를 받지 못했어요: {error}</p>}
      {col.problem && <p className="water-files__error">{col.problem}</p>}
      {col.clearing.error && (
        <p className="water-files__error">
          {column.title} 지우기에 실패했어요: {col.clearing.error}
        </p>
      )}

      {upload && (
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
          <span className="water-files__drop" aria-hidden>
            <Upload size={18} />
            놓으면 올라가요
          </span>
          <svg ref={rippleRef} className="water-files__ripple" aria-hidden focusable="false" />
        </>
      )}
      <p className="sr-only" role="status">
        {col.status}
      </p>

      {clear && (
        <WaterDialog
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

interface WaterItemFilesProps {
  meta: TechBoardMeta
  item: TechItemDoc
  /**
   * 물에만 — 올리기·비우기·주소 받기. 없으면 기존 ItemFiles와 똑같이 보기만(파일이 있는 칸만, 주소는 Monday).
   * 올리기가 있으면 빈 칸도 보여 놓을 자리가 된다. 한 번 만든 것을 계속 넘긴다(주소 받기가 다시 돌지 않게).
   * 타입은 세 레이아웃이 같이 쓰는 TechFileActions(data/tech-file-actions.ts — 물 이름 WaterFileActions도 같다)
   */
  actions?: TechFileActions
}

/**
 * 상세 서랍의 파일(물) — ItemFiles와 같은 props. 사진은 유리 테두리 썸네일(누르면 크게 보기, ← → 로 넘김),
 * 나머지는 이름 줄(누르면 새 탭으로 열기). 주소는 서랍을 열 때 한 번에 받고(썸네일은 서랍에서만), 칸이
 * 나타날 때 썸네일·줄이 왼쪽부터 21ms 간격으로 55ms 동안 진해진다(D7 아이콘 차례).
 */
export function WaterItemFiles({ meta, item, actions }: WaterItemFilesProps) {
  const groups = meta.columns
    .filter((c) => c.type === 'file')
    .map((column) => ({ column, files: filesOf(item.values[column.id]?.value) }))
  const shownGroups = actions?.upload ? groups : groups.filter((g) => g.files.length > 0)
  const assetIds = groups.flatMap((g) => g.files.map((f) => f.assetId))
  const key = `${item.itemId}:${assetIds.join(',')}`
  const fetchLinks = actions?.links ?? fetchFileLinks
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

  if (shownGroups.length === 0) return null
  // 받아 둔 주소는 새로 받는 동안에도 쓴다(같은 항목이면 — 파일이 늘 때 있던 썸네일까지 도는 표시로 돌아가지 않게)
  const links = state.key.startsWith(`${item.itemId}:`) ? state.links : null
  const error = state.key === key ? state.error : null
  // 크게 보기로 넘겨 볼 사진 — 칸이 여러 개여도 한 줄로 이어서 넘긴다
  const viewerImages: ViewerImage[] = groups.flatMap((g) =>
    g.files.flatMap((f) => {
      const url = f.isImage ? links?.get(f.assetId)?.url : null
      return url ? [{ key: f.assetId, name: f.name, url }] : []
    }),
  )

  return (
    <div className="water-files-stack">
      {shownGroups.map(({ column, files }) => (
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
          actions={actions}
        />
      ))}
      <ImageViewer images={viewerImages} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </div>
  )
}
