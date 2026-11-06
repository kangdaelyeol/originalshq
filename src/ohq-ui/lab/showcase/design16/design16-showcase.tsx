import { Play, RotateCcw, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../../components/button'
import { cx } from '../../../lib/cx'
import { ShowcaseStage } from '../showcase-stage'
import { CirrelApp } from './cirrel-app'
import { useD16ReducedMotion } from './d16-motion'
import { Design16Parts } from './design16-parts'

// 영상 글꼴 Urbanist — 글자 폭으로 골랐다("Orders" 잉크 폭 50px = 16.8px, 쉼표가 마침표처럼 작다).
// 이 탭이 열려 있을 때만 불러오고, 못 불러오면 --font-sans로 그린다.
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700&display=swap'

function useSceneFont() {
  useEffect(() => {
    if (document.head.querySelector(`link[href="${FONT_HREF}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    document.head.append(link)
    return () => link.remove()
  }, [])
}

const ACCENTS = [
  { key: 'blue', label: '파랑' },
  { key: 'violet', label: '보라' },
  { key: 'amber', label: '호박' },
] as const
type AccentKey = (typeof ACCENTS)[number]['key']

/** Design 16 — sample/design16-admin.mp4: 유리 관리 앱 "Cirrel"(대시보드 · 주문 칸반 끌어 놓기) */
export function Design16Showcase() {
  useSceneFont()
  const reduced = useD16ReducedMotion()
  // 처음엔 저절로 둘러본다(움직임 줄이기면 꺼진 채) — 직접 누르면 멈춘다
  const [tour, setTour] = useState<boolean | null>(null)
  const touring = tour ?? !reduced
  // 앱을 처음 모습으로 다시 붙이는 열쇠(처음부터 · 둘러보기 한 바퀴 끝)
  const [run, setRun] = useState(0)
  const [accent, setAccent] = useState<AccentKey>('blue')

  return (
    <ShowcaseStage
      title="Design 16 — 유리 관리 앱"
      note="sample/design16-admin.mp4 · 영상 순서(기간 30D → Orders → Packing board → KL-49959 끌어 놓기)를 저절로 둘러봐요 · 직접 누르면 멈추고, 카드를 끌어 다른 레인에 놓을 수 있어요"
      className="showcase-stage--d16"
      actions={
        <>
          <div className="d16-accents" role="radiogroup" aria-label="강조색">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                role="radio"
                aria-checked={accent === a.key}
                aria-label={a.label}
                className={cx('d16-accents__dot', `is-${a.key}`, accent === a.key && 'is-on')}
                onClick={() => setAccent(a.key)}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={() => {
              setRun((r) => r + 1)
              setTour(true)
            }}
          >
            처음부터
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={touring ? Square : Play}
            onClick={() => {
              if (!touring) setRun((r) => r + 1)
              setTour(!touring)
            }}
          >
            {touring ? '둘러보기 멈추기' : '저절로 둘러보기'}
          </Button>
        </>
      }
    >
      <div className={cx('d16', `d16--${accent}`)}>
        <div className="d16-scene">
          <CirrelApp
            key={run}
            tour={touring}
            onTourEnd={() => setRun((r) => r + 1)}
            onUserInteract={() => setTour(false)}
          />
        </div>
        <Design16Parts />
      </div>
    </ShowcaseStage>
  )
}
