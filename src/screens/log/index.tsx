import { useEffect, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BatchLogPanel } from './components/batch-log-panel'
import { InquiryPanel } from './components/inquiry-panel'
import { UsagePanel } from './components/usage-panel'
import './styles/index.scss'

type LogTab = 'batch' | 'inquiry' | 'usage'

const TABS: readonly {
  id: LogTab
  label: string
  code: string
  accent: string
}[] = [
  { id: 'batch', label: '배치 로그', code: 'BATCH', accent: '#49dae4' },
  { id: 'inquiry', label: '문의 접수', code: 'INTAKE', accent: '#a48bff' },
  { id: 'usage', label: '사용 분석', code: 'USAGE', accent: '#ec5069' },
]

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap'

/** 맨 위 줄의 한국 시각 — 1초마다. */
const useKstClock = () => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return new Date(now + 9 * 3_600_000).toISOString().slice(11, 19)
}

/**
 * 로그(/log) — 세 탭.
 *   · 배치 로그: 예약 실행 함수가 제때 돌았는지(batchRuns).
 *   · 문의 접수: 웹사이트 상담 신청이 Monday·문자까지 처리됐는지(inquiries).
 *   · 사용 분석: xtool-lead-manager·cmip를 어떤 탭에서 얼마나 봤는지
 *     (usageSegments).
 * 어느 탭인지는 주소의 ?tab= 에 둬서 새로고침·공유해도 같은 탭이 열린다.
 *
 * 모양은 프롬프트 퍼셉트론(/perceptron)과 같은 말 — 검은 바탕, 고정폭 글꼴,
 * 탭마다 바뀌는 강조색, 얇은 선 카드, 빛 점이 흐르는 노드 그래프.
 */
export default function LogScreen() {
  const [searchParams, setSearchParams] = useSearchParams()
  const param = searchParams.get('tab')
  const current = TABS.find((each) => each.id === param) ?? TABS[0]
  const clock = useKstClock()

  useEffect(() => {
    const previousTitle = document.title
    const previousBackground = document.body.style.backgroundColor
    document.title = 'Ops Log · ORIGINALS'
    document.body.style.backgroundColor = '#0c0b10'
    // 이 화면에서 쓰는 고정폭 글꼴(퍼셉트론과 같은 것).
    if (!document.head.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = FONT_HREF
      document.head.append(link)
    }
    return () => {
      document.title = previousTitle
      document.body.style.backgroundColor = previousBackground
    }
  }, [])

  return (
    <div
      className="batch-log"
      style={{ '--log-accent': current.accent } as CSSProperties}
    >
      <header className="log-top">
        <span className="log-top__brand">
          ORIGINALS<i>/</i>OPS LOG
        </span>
        <nav className="log-top__tabs" role="tablist" aria-label="로그">
          {TABS.map((each, index) => (
            <button
              key={each.id}
              type="button"
              role="tab"
              aria-selected={each.id === current.id}
              className={each.id === current.id ? 'is-active' : ''}
              style={{ '--tab-accent': each.accent } as CSSProperties}
              onClick={() =>
                setSearchParams(each.id === 'batch' ? {} : { tab: each.id })
              }
            >
              <small>{String(index + 1).padStart(2, '0')}</small>
              {each.label}
            </button>
          ))}
        </nav>
        <span className="log-top__live">
          <i aria-hidden="true" />
          LIVE <b>{clock}</b> KST
        </span>
      </header>

      <main className="log-main">
        {current.id === 'batch' && <BatchLogPanel />}
        {current.id === 'inquiry' && <InquiryPanel />}
        {current.id === 'usage' && <UsagePanel />}
      </main>

      <footer className="log-foot">
        <span>
          <b>ORIGINALS HQ</b> · {current.code} TELEMETRY
        </span>
        <span>functions-xtool · functions-cmip · Firestore</span>
      </footer>
    </div>
  )
}
