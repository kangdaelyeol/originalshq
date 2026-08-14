import { useEffect, useState } from 'react'
import type { Lead } from '@/screens/xtool-lead-manager/types'
import '@/screens/xtool-lead-manager/styles/detail.scss'

const STATE_LABEL: Record<Lead['state'], string> = {
  new: '신규 유입',
  contacted: '상담 완료',
  purchased: '구매 완료',
}

const UTM_LABEL: Record<string, string> = {
  utm_source: '유입 채널',
  utm_medium: '매체',
  utm_campaign: '캠페인',
}

function formatDateTime(ts: number) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPrice(price: number) {
  if (!price) return '-'
  return `${price.toLocaleString('ko-KR')}원`
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  const isEmpty = !value || value === '-'
  return (
    <div className="info_row">
      <span className="label">{label}</span>
      <span
        className={['value', mono ? 'mono' : '', isEmpty ? 'empty' : ''].join(
          ' ',
        )}
      >
        {isEmpty ? '값 없음' : value}
      </span>
    </div>
  )
}

export const Detail = ({
  lead,
  onConfirm,
}: {
  lead: Lead
  onConfirm: () => void
}) => {
  const [uaExpanded, setUaExpanded] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onConfirm()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onConfirm])

  return (
    <div className="lead_manager_detail_modal" onClick={onConfirm}>
      <div className="detail_form" onClick={(e) => e.stopPropagation()}>
        <div className="header">
          <div className="header_title">
            <span className={['state_badge', lead.state].join(' ')}>
              {STATE_LABEL[lead.state]}
            </span>
            <span className="customer_name">{lead.fn || '이름 없음'}</span>
          </div>
          <button type="button" className="close_btn" onClick={onConfirm}>
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5 5 15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="body">
          <section className="section">
            <div className="section_title">기본 정보</div>
            <InfoRow label="고객명" value={lead.fn} />
            <InfoRow label="전화번호" value={lead.ph} mono />
            <InfoRow label="상담 기기" value={lead.device} />
            <InfoRow label="접수 시각" value={formatDateTime(lead.createdAt)} />
          </section>

          <section className="section">
            <div className="section_title">거래 정보</div>
            <InfoRow label="구매 금액" value={formatPrice(lead.price)} />
            <InfoRow
              label="구매 시각"
              value={formatDateTime(lead.purchasedAt)}
            />
          </section>

          <section className="section">
            <div className="section_title">유입 경로</div>
            <InfoRow label={UTM_LABEL.utm_source} value={lead.utm_source} />
            <InfoRow label={UTM_LABEL.utm_medium} value={lead.utm_medium} />
            <InfoRow label={UTM_LABEL.utm_campaign} value={lead.utm_campaign} />
          </section>

          <section className="section">
            <div className="section_title">추적 정보</div>
            <InfoRow label="IP 주소" value={lead.ip} mono />
            <InfoRow label="FBC" value={lead.fbc} mono />
            <InfoRow label="FBP" value={lead.fbp} mono />
            <div className="info_row column">
              <div className="row_head">
                <span className="label">User Agent</span>
                {lead.user_agent && (
                  <button
                    type="button"
                    className="expand_btn"
                    onClick={() => setUaExpanded((v) => !v)}
                  >
                    {uaExpanded ? '접기' : '전체 보기'}
                  </button>
                )}
              </div>
              <span
                className={[
                  'value mono ua',
                  uaExpanded ? 'expanded' : '',
                  !lead.user_agent ? 'empty' : '',
                ].join(' ')}
              >
                {lead.user_agent || '값 없음'}
              </span>
            </div>
          </section>
        </div>

        <div className="footer">
          <button type="button" className="btn confirm" onClick={onConfirm}>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
