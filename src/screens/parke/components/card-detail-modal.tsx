import { useEffect, useRef, type ReactNode } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useCardDetail } from '@/screens/parke/controller/use-card-detail'
import {
  formatCardPhone,
  MESSAGE_MAX,
  THEME_LABEL,
  type ParkeCard,
} from '@/screens/parke/entity/card'
import { downloadQrCode, getSerialUrl } from '@/screens/parke/utils'
import '@/screens/parke/styles/card-detail-modal.scss'

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="card-detail__field">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
)

/** 저장값이 규칙에 맞지 않아 바꿔 보여줄 때 붙이는 표시. */
const Replaced = ({ raw }: { raw: string | number | null }) =>
  raw === null ? null : (
    <span className="card-detail__replaced">저장값 “{raw}” → 기본값 표시</span>
  )

const formatDateTime = (ms: number) =>
  new Date(ms).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const CardFields = ({ card }: { card: ParkeCard }) => (
  <>
    <section className="card-detail__section">
      <h3>카드에 보이는 정보</h3>
      <dl>
        <Field label="카드 이름">
          {card.title || <span className="card-detail__empty">없음</span>}
        </Field>
        <Field label="휴대전화번호">
          {card.phone ? (
            <span className="card-detail__mono">
              {formatCardPhone(card.phone)}
            </span>
          ) : (
            <span className="card-detail__empty">없음</span>
          )}
        </Field>
        <Field label="메시지">
          {card.message ? (
            <span className="card-detail__message">{card.message}</span>
          ) : (
            <span className="card-detail__empty">없음</span>
          )}
          <span className="card-detail__hint">
            {card.message.length} / {MESSAGE_MAX}자
            {card.legacyMessage && ' · 예전 위치(최상위 message)에 저장됨'}
          </span>
        </Field>
      </dl>
    </section>

    <section className="card-detail__section">
      <h3>디자인</h3>
      <dl className="card-detail__grid">
        <Field label="테마">
          {THEME_LABEL[card.theme]}
          <Replaced raw={card.rawTheme} />
        </Field>
        <Field label="레이아웃">
          {card.layout.toUpperCase()}
          <Replaced raw={card.rawLayout} />
        </Field>
        <Field label="강조색">
          <span className="card-detail__accent">
            <span
              className="card-detail__swatch"
              style={{ backgroundColor: card.accent }}
              aria-hidden="true"
            />
            <span className="card-detail__mono">{card.accent}</span>
          </span>
          <Replaced raw={card.rawAccent} />
        </Field>
        <Field label="크기">
          <span className="card-detail__mono">×{card.scale.toFixed(2)}</span>
          {card.rawScale !== null && (
            <span className="card-detail__replaced">
              저장값 {card.rawScale} → 범위(0.85~1.3)에 맞춤
            </span>
          )}
        </Field>
      </dl>
    </section>

    <section className="card-detail__section">
      <h3>관리 정보</h3>
      <dl>
        <Field label="기기 ID">
          {card.deviceId ? (
            <span className="card-detail__mono">{card.deviceId}</span>
          ) : (
            <span className="card-detail__empty">연결된 기기 없음</span>
          )}
        </Field>
        <Field label={`소유자 ${card.owners.length}명`}>
          {card.owners.length > 0 ? (
            <span className="card-detail__mono card-detail__owners">
              {card.owners.join(', ')}
            </span>
          ) : (
            <span className="card-detail__empty">없음</span>
          )}
        </Field>
        <Field label="마지막 수정">
          {card.updatedAt !== null ? (
            formatDateTime(card.updatedAt)
          ) : (
            <span className="card-detail__empty">기록 없음</span>
          )}
        </Field>
      </dl>
    </section>
  </>
)

/**
 * 시리얼 목록에서 줄을 눌렀을 때 뜨는 카드 상세 — 왼쪽은 QR과 주소, 오른쪽은
 * DB(card/{시리얼})의 카드 정보. Esc·배경 클릭·× 버튼으로 닫는다.
 */
export const CardDetailModal = ({
  serial,
  onClose,
}: {
  serial: string
  onClose: () => void
}) => {
  const { status, card } = useCardDetail(serial)
  const url = getSerialUrl(serial)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div className="card-detail" onClick={onClose}>
      <div
        className="card-detail__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="card-detail__head">
          <div>
            <span className="card-detail__label">Serial</span>
            <h2 id="card-detail-title" className="card-detail__serial">
              {serial}
            </h2>
          </div>
          {status === 'ready' && (
            <span
              className={`card-detail__badge${card ? ' is-registered' : ''}`}
            >
              {card ? '등록됨' : '미등록'}
            </span>
          )}
          <button
            ref={closeRef}
            type="button"
            className="card-detail__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="card-detail__body">
          <aside className="card-detail__qr">
            <QRCodeCanvas value={url} size={176} marginSize={2} />
            <a
              className="card-detail__url"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              {url}
            </a>
            <button
              type="button"
              className="card-detail__download"
              // 목록 줄에 있는 다운로드용(300px) QR을 그대로 받는다.
              onClick={() =>
                downloadQrCode(serial, `.qr-canvas-hidden.${serial}`)
              }
            >
              QR 다운로드
            </button>
          </aside>

          <div className="card-detail__info">
            {status === 'loading' && (
              <div className="card-detail__skeleton" aria-label="불러오는 중">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} />
                ))}
              </div>
            )}
            {status === 'error' && (
              <p className="card-detail__notice is-error">
                카드 정보를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.
              </p>
            )}
            {status === 'ready' && !card && (
              <p className="card-detail__notice">
                등록되지 않은 Parké입니다.
                <span>
                  앱에서 이 QR을 등록하면 카드 정보가 여기에 보입니다.
                </span>
              </p>
            )}
            {status === 'ready' && card && <CardFields card={card} />}
          </div>
        </div>
      </div>
    </div>
  )
}
