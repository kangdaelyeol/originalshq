import { useEffect, useState, type CSSProperties } from 'react'
import { LOOP } from './data'
import { Engine, useEngine } from './engine'
import { CaseHeader, MetricRow, TopBar } from './hud'
import { Network } from './network'
import { Footer, Panels } from './panels'
import './perceptron.scss'

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap'

/** ?t=12.3 이면 그 시점부터, ?pause 가 있으면 거기 멈춰서(화면 확인용). */
const engineFromUrl = () => {
  const q = new URLSearchParams(window.location.search)
  const t = Number(q.get('t') ?? 0)
  return new Engine(Number.isFinite(t) ? t : 0, q.has('pause'))
}

/**
 * 프롬프트 퍼셉트론 — 입력 신호가 특징·인코더·게이트 층을 지나 마지막 노드
 * 하나에서 AI 프롬프트가 되는 모습을 다층 신경망처럼 보여 준다(목업 데이터).
 */
export default function PerceptronScreen() {
  const [engine] = useState(engineFromUrl)
  const slot = useEngine(engine, (s) => s.slot)

  useEffect(() => {
    engine.start()
    // 시험용 — 개발자 도구에서 __pn.seek(12.3, true)로 그 장면을 본다.
    ;(window as unknown as { __pn?: Engine }).__pn = engine
    return () => engine.stop()
  }, [engine])

  useEffect(() => {
    const previousTitle = document.title
    const previousBackground = document.body.style.backgroundColor
    document.title = 'Prompt Perceptron · CMIP'
    document.body.style.backgroundColor = '#0c0b10'
    // 이 화면에서만 쓰는 고정폭 글꼴.
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
      className="pn"
      style={{ '--pn-accent': LOOP[slot].color } as CSSProperties}
    >
      <TopBar />
      <MetricRow engine={engine} />
      <CaseHeader engine={engine} />
      <Network engine={engine} />
      <Panels engine={engine} />
      <Footer engine={engine} />
    </div>
  )
}
