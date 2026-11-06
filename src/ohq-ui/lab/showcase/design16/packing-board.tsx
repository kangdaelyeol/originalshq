import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { startCardDrag } from './board-drag'
import { BoardLane } from './board-lane'
import { D16_T, EASE, play, prefersReducedMotion } from './d16-motion'
import { D16_ORDER_BY_ID, type LaneData, type OrderStatus } from './design16-data'
import { OrderCard } from './order-card'

interface PackingBoardProps {
  lanes: readonly LaneData[]
  columns: Record<OrderStatus, string[]>
  /** 주문을 다른 레인으로 — 앱이 상태를 바꾼다(숫자·토스트도 거기서) */
  onMove: (id: string, from: OrderStatus, to: OrderStatus) => void
  /** 유령을 띄울 층(창 안) — 없으면 칸반 자신 */
  floatLayer?: RefObject<HTMLElement | null>
  /** 붙을 때 레인이 0.05초씩 오르고 카드가 레인마다 차례로 나타난다(F110~F129) */
  intro?: boolean
}

/** 놓기 전 카드 자리 — 상태를 바꾼 뒤 그 차이만큼 거꾸로 밀었다가 expo.out으로 돌려놓는다(FLIP) */
type Rects = Map<string, DOMRect>

/** "Packing board" — 레인 넷(120px, 틈 8.7px). 카드를 끌어 다른 레인에 놓는다. */
export function PackingBoard({ lanes, columns, onMove, floatLayer, intro = true }: PackingBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const flipRef = useRef<{ rects: Rects; arrive: string } | null>(null)
  const [hot, setHot] = useState<OrderStatus | null>(null)
  const [lifted, setLifted] = useState<string | null>(null)

  // 처음 — 레인이 오르고 카드가 나타난다
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !intro) return
    const anims: (Animation | null)[] = []
    root.querySelectorAll<HTMLElement>('.d16-lane').forEach((lane, i) => {
      anims.push(
        play(
          lane,
          [
            { opacity: 0, translate: '0 calc(12 * var(--d16-px))' },
            { opacity: 1, translate: '0 0' },
          ],
          { duration: D16_T.lane, delay: D16_T.laneDelay + i * D16_T.laneStagger, easing: EASE.cubicOut },
        ),
      )
      lane.querySelectorAll<HTMLElement>('.d16-ocard').forEach((card, j) =>
        anims.push(
          play(
            card,
            [
              { opacity: 0, translate: '0 calc(5 * var(--d16-px))' },
              { opacity: 1, translate: '0 0' },
            ],
            {
              duration: D16_T.cardsFade,
              delay: D16_T.cardsDelay + i * D16_T.cardsLaneStagger + j * D16_T.cardsStagger,
              easing: EASE.cubicOut,
            },
          ),
        ),
      )
    })
    return () => anims.forEach((a) => a?.cancel())
  }, [intro])

  // 놓은 뒤 — 카드들이 새 자리로 미끄러진다(F161 시작, 0.5초 expo.out), 옮긴 카드는 유령이 사라질 때 나타난다
  useLayoutEffect(() => {
    const flip = flipRef.current
    const root = rootRef.current
    if (!flip || !root) return
    flipRef.current = null
    const reduced = prefersReducedMotion()
    root.querySelectorAll<HTMLElement>('.d16-ocard[data-id]').forEach((card) => {
      const id = card.dataset.id ?? ''
      if (id === flip.arrive) {
        play(card, [{ opacity: 0 }, { opacity: 1 }], { duration: D16_T.ghostFade, delay: D16_T.ghostHold })
        return
      }
      const before = flip.rects.get(id)
      if (!before || reduced) return
      const after = card.getBoundingClientRect()
      const dx = before.left - after.left
      const dy = before.top - after.top
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
      card.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], {
        duration: D16_T.flip * 1000,
        easing: EASE.expoOut,
      })
    })
  }, [columns])

  const onCardDown = (e: ReactPointerEvent<HTMLElement>) => {
    const layer = floatLayer?.current ?? rootRef.current
    if (!layer) return
    e.preventDefault()
    startCardDrag(e.nativeEvent, e.currentTarget, {
      layer,
      setHot,
      setLifted,
      drop: (id, from, to) => {
        const rects: Rects = new Map()
        rootRef.current
          ?.querySelectorAll<HTMLElement>('.d16-ocard[data-id]')
          .forEach((card) => rects.set(card.dataset.id ?? '', card.getBoundingClientRect()))
        flipRef.current = { rects, arrive: id }
        setLifted(null)
        onMove(id, from, to)
      },
    })
  }

  return (
    <div className="d16-board" ref={rootRef}>
      {lanes.map((lane) => {
        const ids = columns[lane.key]
        return (
          <BoardLane
            key={lane.key}
            col={lane.key}
            title={lane.title}
            sub={lane.sub}
            tone={lane.tone}
            count={lane.hidden + ids.length}
            hot={hot === lane.key}
          >
            {ids.map((id) => (
              <OrderCard
                key={id}
                order={D16_ORDER_BY_ID[id]}
                state={lifted === id ? 'lifted' : 'rest'}
                onPointerDown={onCardDown}
              />
            ))}
          </BoardLane>
        )
      })}
    </div>
  )
}
