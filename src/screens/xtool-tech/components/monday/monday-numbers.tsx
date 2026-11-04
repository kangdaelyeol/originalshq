import { ChevronDown } from 'lucide-react'
import { useCallback, useId, useState } from 'react'
import type { StatCardData } from '@/ohq-ui/types'
import { cx } from '@/ohq-ui/lib/cx'
import { usePeriod } from '../../context/period-context'
import { PERIOD_OPTIONS } from '../../data/period'
import type { TechBoardKey } from '../../data/tech-boards'

// 요약 줄을 접었는지 — 보드마다 이 브라우저에 기억한다(use-monday-prefs의 칸 너비·접은 그룹과 같은 방식).

const read = (key: string): boolean => {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? 'false') === true
  } catch {
    return false
  }
}

const write = (key: string, value: boolean) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 저장소를 못 쓰면 이번 방문 동안만 */
  }
}

function useCollapsed(boardKey: TechBoardKey): [boolean, (collapsed: boolean) => void] {
  const key = `xtool-tech:monday-numbers:${boardKey}`
  const [collapsed, setCollapsed] = useState(() => read(key))
  const set = useCallback(
    (next: boolean) => {
      setCollapsed(next)
      write(key, next)
    },
    [key],
  )
  return [collapsed, set]
}

interface MondayNumbersProps {
  /** 접은 상태를 기억할 보드 */
  boardKey: TechBoardKey
  /** 대시보드와 같은 숫자 카드(보드 정의의 kpis) — 이름·값·설명·색조만 쓴다 */
  cards: readonly StatCardData[]
  /** 보드를 불러오는 중 — 같은 칸 네 개를 빈 블록으로(다 불러온 순간 아래 표가 밀리지 않게, 스켈레톤이 쓴다) */
  loading?: boolean
}

// 불러오는 중에 그리는 칸 — 진짜 칸과 같은 글자 크기의 투명 글자라 높이가 같다
const GHOSTS = [0, 1, 2, 3]

/**
 * Monday 표 보드 위 요약 줄 — 대시보드 숫자 카드와 같은 숫자를 Monday 숫자 위젯처럼 작은 칸(이름 + 큰 숫자)으로
 * 늘어놓는다. 머리 줄(요약)을 누르면 접고 펴고, 접으면 숫자만 한 줄로 남긴다. Monday 표 상단바에는 기간이 없어서
 * 기간(오늘·7일·30일·1년)은 여기서 고른다 — "… 완료" 같은 칸이 이 기간을 센다(대시보드와 같은 기간).
 */
export function MondayNumbers({ boardKey, cards, loading = false }: MondayNumbersProps) {
  const [collapsed, setCollapsed] = useCollapsed(boardKey)
  const { period, setPeriod } = usePeriod()
  const listId = useId()

  return (
    <section className={cx('mon-numbers', collapsed && 'is-collapsed')} aria-label="요약">
      <div className="mon-numbers__head">
        <button
          type="button"
          className="mon-numbers__toggle"
          aria-expanded={!collapsed}
          aria-controls={collapsed ? undefined : listId}
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronDown size={16} aria-hidden />
          요약
        </button>

        {collapsed ? (
          <p className="mon-numbers__brief">
            {loading ? (
              <span className="mon-skel mon-numbers__ghost">요약 숫자 네 개 자리</span>
            ) : (
              cards.map((card) => (
                <span key={card.key}>
                  {card.title} <strong>{card.value}</strong>
                </span>
              ))
            )}
          </p>
        ) : (
          // 도구 줄의 상태 탭(내 업무)과 같은 밑줄 탭
          <span className="mon-tabs mon-numbers__period" role="radiogroup" aria-label="기간">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={period === option.value}
                className={cx('mon-tab', period === option.value && 'is-on')}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </span>
        )}
      </div>

      {!collapsed && (
        <ul id={listId} className="mon-numbers__list" aria-busy={loading || undefined}>
          {loading
            ? GHOSTS.map((i) => (
                <li key={i} className="mon-number" aria-hidden>
                  <span className="mon-number__label">
                    <span className="mon-skel mon-numbers__ghost">숫자 이름</span>
                  </span>
                  <span className="mon-number__value">
                    <span className="mon-skel mon-numbers__ghost">00건</span>
                  </span>
                  <span className="mon-number__caption">{'\u00a0'}</span>
                </li>
              ))
            : cards.map((card) => (
                <li key={card.key} className={cx('mon-number', `is-${card.tint ?? 'blue'}`)}>
                  <span className="mon-number__label">{card.title}</span>
                  <span className="mon-number__value">{card.value}</span>
                  {/* 설명이 없어도 줄 자리는 둔다 — 보드를 바꿔도 요약 줄 높이가 같게 */}
                  <span className="mon-number__caption" aria-hidden={!card.caption || undefined}>
                    {card.caption || '\u00a0'}
                  </span>
                </li>
              ))}
        </ul>
      )}
    </section>
  )
}
