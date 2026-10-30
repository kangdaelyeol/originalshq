import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MondayCustomerListItem } from '@/screens/xtool-lead-manager/entity'
import { useSideListKeys } from '@/screens/xtool-lead-manager/hooks/use-side-list-keys'
import { formatMondayPhone } from '@/screens/xtool-lead-manager/utils'

// 줄 높이(고정) — 보이는 줄만 그리려고 위치를 높이로 계산한다(styles/monday.scss의
// .monday_side_list 줄 높이와 같아야 한다).
const ROW_HEIGHT = 34
// 보이는 범위 위아래로 더 그려 둘 줄 수 — 빠르게 스크롤해도 빈칸이 안 보이게.
const OVERSCAN = 10

/**
 * Monday 고객 상세 왼쪽의 고객 목록 — 지금 검색·분류·정렬이 걸린 전체 고객
 * (표와 같은 순서, 페이지 나누기 전)을 번호·이름·최근 상담 상태만 간략히.
 * 줄을 누르거나 위/아래 방향키로 그 고객의 상세로 넘어간다(리드 상세의
 * detail-side-list.tsx와 같은 모양·동작).
 *
 * 고객이 수천 명이라 보이는 줄(과 위아래 조금)만 그리고, 나머지 자리는 빈
 * 줄의 높이로 채운다. 위쪽 빈 줄은 늘 하나 두고 시작 줄을 짝수로 맞춰, 한 줄
 * 걸러 칠하는 줄무늬가 스크롤해도 바뀌지 않게 한다.
 */
export const MondaySideList = ({
  customers,
  activePhone,
  onSelect,
  keysEnabled,
}: {
  customers: MondayCustomerListItem[]
  activePhone: string
  onSelect: (phone: string) => void
  /** 위에 다른 모달(CAPI 전송)이 떠 있으면 방향키를 듣지 않는다. */
  keysEnabled: boolean
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLTableSectionElement>(null)
  const [view, setView] = useState({ top: 0, height: 0 })

  const phones = useMemo(
    () => customers.map((customer) => customer.phone),
    [customers],
  )
  useSideListKeys(phones, activePhone, onSelect, keysEnabled)

  // 보이는 범위 — 스크롤하거나 상자 크기가 바뀔 때.
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const measure = () =>
      setView({ top: element.scrollTop, height: element.clientHeight })
    measure()
    element.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [])

  // 고른 고객이 보이는 범위 밖이면 끌어온다(머리글 밑에 가리지 않게).
  useLayoutEffect(() => {
    const element = scrollRef.current
    const index = phones.indexOf(activePhone)
    if (!element || index === -1) return
    const head = headRef.current?.offsetHeight ?? 0
    const rowTop = index * ROW_HEIGHT
    if (rowTop < element.scrollTop) {
      element.scrollTop = rowTop
    } else if (
      head + rowTop + ROW_HEIGHT >
      element.scrollTop + element.clientHeight
    ) {
      element.scrollTop = head + rowTop + ROW_HEIGHT - element.clientHeight
    }
  }, [activePhone, phones])

  const first = Math.max(0, Math.floor(view.top / ROW_HEIGHT) - OVERSCAN)
  const start = first - (first % 2)
  const end = Math.min(
    customers.length,
    Math.ceil((view.top + view.height) / ROW_HEIGHT) + OVERSCAN,
  )

  return (
    <div className="detail_side_list monday_side_list">
      <div className="detail_side_list_head">
        <span className="title">검색된 고객</span>
        <span className="count">
          {customers.length.toLocaleString('ko-KR')}명
        </span>
      </div>
      <div className="detail_side_list_scroll" ref={scrollRef}>
        <table className="detail_side_list_table">
          <thead ref={headRef}>
            <tr>
              <th className="col-ph">전화번호</th>
              <th>이름</th>
              <th>최근 상담</th>
            </tr>
          </thead>
          <tbody>
            <tr
              className="monday_side_list_spacer"
              style={{ height: start * ROW_HEIGHT }}
              aria-hidden="true"
            />
            {customers.slice(start, end).map((customer) => (
              <tr
                key={customer.phone}
                className={customer.phone === activePhone ? 'active' : ''}
                onClick={() => onSelect(customer.phone)}
              >
                <td className="col-ph">{formatMondayPhone(customer.phone)}</td>
                <td>{customer.names[0] ?? '이름 없음'}</td>
                <td>{customer.summary.latestConsultationStatus ?? '-'}</td>
              </tr>
            ))}
            <tr
              className="monday_side_list_spacer"
              style={{ height: (customers.length - end) * ROW_HEIGHT }}
              aria-hidden="true"
            />
          </tbody>
        </table>
      </div>
    </div>
  )
}
