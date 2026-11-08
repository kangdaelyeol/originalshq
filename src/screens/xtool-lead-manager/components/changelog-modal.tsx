import { X } from 'lucide-react'
import { useRef } from 'react'
import { useModal } from '@/screens/xtool-lead-manager/hooks/use-modal'
import { LM_CHANGELOG, LM_VERSION, type ChangeKind } from '@/screens/xtool-lead-manager/version'

const KIND_LABEL: Record<ChangeKind, string> = {
  new: '새 기능',
  improved: '개선',
  fixed: '고침',
}

/** 업데이트 기록 — 아래 띠의 버전 알약을 누르면 뜬다. 최근 버전부터, 버전마다 날짜·제목과 바뀐 것. */
export const ChangelogModal = ({ onClose }: { onClose: () => void }) => {
  const closeRef = useRef<HTMLButtonElement>(null)
  useModal(onClose, closeRef)
  return (
    <div className="lm_changelog" onClick={onClose}>
      <div
        className="lm_changelog__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lm-changelog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lm_changelog__head">
          <h2 id="lm-changelog-title">
            업데이트 기록
            <span className="lm_changelog__current">지금 v{LM_VERSION}</span>
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="lm_changelog__close"
            aria-label="업데이트 기록 닫기"
            onClick={onClose}
          >
            <X strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <ol className="lm_changelog__list">
          {LM_CHANGELOG.map((release) => (
            <li key={release.version} className="lm_changelog__release">
              <div className="lm_changelog__release_head">
                <b className="lm_changelog__version">v{release.version}</b>
                {release.title && <strong>{release.title}</strong>}
                <time dateTime={release.date}>{release.date.replace(/-/g, '.')}</time>
              </div>
              <ul>
                {release.changes.map((change, index) => (
                  <li key={index}>
                    <span className={`lm_changelog__kind is-${change.kind}`}>{KIND_LABEL[change.kind]}</span>
                    {change.text}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
