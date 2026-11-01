import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePortalRoot } from '../../lib/portal-root'

export interface ViewerImage {
  key: string
  name: string
  /** Monday 임시 공개 주소(1시간) */
  url: string
}

/**
 * 사진 크게 보기 — 화면 가운데에 원본을 맞춰 띄우고 ← → 로 넘긴다. Esc·바깥 누르기로 닫는다.
 * 상세 패널 위에 뜨므로 Esc를 먼저(capture) 받아 패널까지 닫히지 않게 막는다.
 */
export function ImageViewer({
  images,
  index,
  onChange,
  onClose,
}: {
  images: ViewerImage[]
  /** 지금 보는 사진 — null이면 닫힘 */
  index: number | null
  onChange: (index: number) => void
  onClose: () => void
}) {
  const root = usePortalRoot()
  const open = index !== null && images.length > 0
  const current = open ? images[Math.min(index, images.length - 1)] : null
  const count = images.length
  // 브라우저가 못 그리는 형식(HEIC 등) — 사진마다 따로 기억한다.
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && count > 1) onChange((index - 1 + count) % count)
      else if (e.key === 'ArrowRight' && count > 1) onChange((index + 1) % count)
      else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, count, onChange, onClose])

  if (!root) return null
  return createPortal(
    <AnimatePresence>
      {current && index !== null && (
        <motion.div
          key="viewer"
          className="image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={current.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <header className="image-viewer__bar" onClick={(e) => e.stopPropagation()}>
            <p className="image-viewer__name">
              {current.name}
              {count > 1 && (
                <span>
                  {index + 1} / {count}
                </span>
              )}
            </p>
            <a className="image-viewer__action" href={current.url} target="_blank" rel="noreferrer">
              <ExternalLink size={15} aria-hidden />
              원본 열기
            </a>
            <button type="button" className="image-viewer__action" onClick={onClose} aria-label="닫기">
              <X size={18} aria-hidden />
            </button>
          </header>

          {broken.has(current.key) ? (
            <div className="image-viewer__fallback" onClick={(e) => e.stopPropagation()}>
              <ImageOff size={28} aria-hidden />
              <p>이 브라우저에서 미리 볼 수 없는 형식이에요.</p>
              <small>위의 "원본 열기"로 받아서 보세요.</small>
            </div>
          ) : (
            <motion.img
              key={current.key}
              className="image-viewer__img"
              src={current.url}
              alt={current.name}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              onError={() => setBroken((prev) => new Set(prev).add(current.key))}
            />
          )}

          {count > 1 && (
            <>
              <button
                type="button"
                className="image-viewer__nav image-viewer__nav--prev"
                aria-label="이전 사진"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange((index - 1 + count) % count)
                }}
              >
                <ChevronLeft size={22} aria-hidden />
              </button>
              <button
                type="button"
                className="image-viewer__nav image-viewer__nav--next"
                aria-label="다음 사진"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange((index + 1) % count)
                }}
              >
                <ChevronRight size={22} aria-hidden />
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    root,
  )
}
