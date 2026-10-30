import './segmented.scss'
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

/** 유리 알약의 자리 — 상자 왼쪽·오른쪽 끝에서 떨어진 거리(px). */
type Thumb = { left: number; right: number }

/**
 * 알약 안의 알약 — 여럿 중 하나를 고르는 버튼 묶음. 카드 머리의 [그래프 | 표],
 * 정렬 기준 [건수 순 | 비율 순], 메뉴 줄의 소주제·단위가 다 이것이다. 고른
 * 값은 부르는 쪽(view-model)이 기억한다.
 *
 *   role  tabs    — 보이는 내용을 바꾼다(탭: tablist / aria-selected)
 *         buttons — 같은 내용의 방식을 바꾼다(버튼 묶음: group / aria-pressed)
 *   size  sm      — 카드 머리(기본)
 *         md      — 메뉴 줄(기간 선택 버튼과 같은 높이)
 *
 * 고른 버튼 뒤에 유리 알약(thumb) 하나를 깔고, 고른 것이 바뀌면 그 알약이
 * 미끄러져 간다. value가 null(또는 options에 없는 값)이면 아무것도 켜지지
 * 않는다(cmip 기간 단위처럼 날짜를 직접 고른 경우). 가는 쪽 끝이 먼저, 반대쪽 끝이 조금 늦게 따라가서 움직이는
 * 동안 살짝 늘어난다(물방울처럼). 자리는 버튼을 재서 정하고, 처음 그릴
 * 때는 움직이지 않고 바로 그 자리에 둔다.
 */
export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  label,
  role = 'tabs',
  size = 'sm',
  className,
  disabled = false,
  disabledOptions,
  optionTitles,
}: {
  /** 버튼 이름 — 글자 또는 건수 등을 붙인 내용. */
  options: Record<T, ReactNode>
  value: T | null
  onChange: (next: T) => void
  /** 읽어 주는 이름 — "보드 현황 보기" 등. */
  label: string
  role?: 'tabs' | 'buttons'
  size?: 'sm' | 'md'
  /** 화면 쪽 배치용 클래스(여백 등). */
  className?: string
  /** 조회 중 등 — 버튼을 누를 수 없게. */
  disabled?: boolean
  /** 이 버튼들만 누를 수 없게(고를 거리가 없을 때 등). 이유는 optionTitles로. */
  disabledOptions?: readonly T[]
  /** 버튼마다 마우스를 올리면 보이는 설명. */
  optionTitles?: Partial<Record<T, string>>
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<Thumb | null>(null)
  // 오른쪽으로 가는지 왼쪽으로 가는지 — 어느 끝이 먼저 움직일지 정한다.
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)
  // 마지막으로 둔 자리 — 다음 자리와 견줘 방향을 정한다.
  const placed = useRef<Thumb | null>(null)

  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const place = () => {
      const active = box.querySelector<HTMLButtonElement>('button.active')
      if (!active) {
        // 고른 것이 없으면 알약을 치운다 — 다음에 고르면 그 자리에 바로 놓인다.
        placed.current = null
        setThumb(null)
        return
      }
      const next = {
        left: active.offsetLeft,
        right: box.clientWidth - active.offsetLeft - active.offsetWidth,
      }
      const prev = placed.current
      if (prev && prev.left !== next.left) {
        setDirection(next.left > prev.left ? 'right' : 'left')
      }
      placed.current = next
      setThumb(next)
    }
    place()
    // 글꼴이 늦게 들어오거나 상자 폭이 바뀌어도 버튼에 맞춘다.
    const observer = new ResizeObserver(place)
    observer.observe(box)
    return () => observer.disconnect()
  }, [value])

  return (
    <div
      ref={ref}
      className={[
        'glass_segmented',
        `is-${size}`,
        thumb ? 'has-thumb' : '',
        className ?? '',
      ]
        .join(' ')
        .trim()}
      data-direction={direction ?? undefined}
      role={role === 'tabs' ? 'tablist' : 'group'}
      aria-label={label}
    >
      {thumb && (
        <span
          className="glass_segmented_thumb"
          style={
            {
              '--thumb-left': `${thumb.left}px`,
              '--thumb-right': `${thumb.right}px`,
            } as CSSProperties
          }
          aria-hidden="true"
        />
      )}
      {(Object.keys(options) as T[]).map((each) => (
        <button
          key={each}
          type="button"
          {...(role === 'tabs'
            ? { role: 'tab', 'aria-selected': each === value }
            : { 'aria-pressed': each === value })}
          className={each === value ? 'active' : ''}
          disabled={disabled || disabledOptions?.includes(each)}
          title={optionTitles?.[each]}
          onClick={() => onChange(each)}
        >
          {options[each]}
        </button>
      ))}
    </div>
  )
}
