import { useLayoutEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { D16_T, EASE, play } from './d16-motion'

export interface TabData<K extends string> {
  key: K
  label: string
  count?: number
}

interface TabBarProps<K extends string> {
  tabs: readonly TabData<K>[]
  value: K
  onChange?: (next: K) => void
  /** 밑줄이 붙을 때 오른쪽 12px에서 미끄러져 온다(F78 +11.4 → F88 0, cubicOut 0.36초) — null이면 바로 */
  underlineDelay?: number | null
  className?: string
}

/**
 * 탭 줄 — 글자 6px·숫자 동그라미, 고른 탭 아래 1.5px 파란 밑줄, 줄 전체 아래 옅은 선.
 * 영상에서 탭을 바꾸면 밑줄이 옮겨 가지 않고 페이지가 다시 붙으면서 새 자리에서 미끄러져 들어온다.
 */
export function TabBar<K extends string>({ tabs, value, onChange, underlineDelay = 0, className }: TabBarProps<K>) {
  const lineRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    if (underlineDelay === null) return
    const a = play(
      lineRef.current,
      [{ translate: `calc(${D16_T.underlineFrom} * var(--d16-px)) 0` }, { translate: '0 0' }],
      { duration: D16_T.underline, delay: underlineDelay, easing: EASE.cubicOut },
    )
    return () => a?.cancel()
  }, [underlineDelay])

  return (
    <div className={cx('d16-tabs', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === value}
          className={cx('d16-tabs__tab', 'd16-hov', tab.key === value && 'is-on')}
          onClick={() => onChange?.(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="d16-tabs__count">{tab.count}</span>}
          {tab.key === value && <span className="d16-tabs__line" ref={lineRef} aria-hidden />}
        </button>
      ))}
    </div>
  )
}
