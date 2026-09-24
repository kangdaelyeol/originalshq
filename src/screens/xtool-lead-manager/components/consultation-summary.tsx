import { useMemo, useRef, useState } from 'react'
import { useOutsideClick } from '@/screens/xtool-lead-manager/hooks'
import { Device, type Lead } from '@/screens/xtool-lead-manager/entity'
import type { SortDirection } from '@/screens/xtool-lead-manager/types'
import {
  buildConsultationSummaryRows,
  ConsultationSummarySortField,
  formatPhoneNumber,
  formatTime,
  sortConsultationSummaryRows,
} from '@/screens/xtool-lead-manager/utils'
import { SortButton } from '@/screens/xtool-lead-manager/components'
import '@/screens/xtool-lead-manager/styles/consultation-summary.scss'

const ALL_DEVICES = Object.values(Device)

/** 상담 완료건을 상담 기기 기준으로 필터링해 보여주는 서머리 표 — 메인 표의
 * 기기 필터(단일 선택, 상담+구매 통틀어 필터)와 달리 상담 기록만, 다중
 * 선택으로 본다. 접수/구매와 무관하게 "이 기기들 중 하나라도 상담한 이력"만
 * 모아 보여주는 별도 리포트다. */
export const ConsultationSummary = ({ leads }: { leads: Lead[] }) => {
  const [open, setOpen] = useState(false)
  // 기본은 미선택 — 필요한 기기만 골라서 보는 용도라, 열자마자 전체를
  // 보여주기보다 사용자가 직접 고르게 한다.
  const [selectedDevices, setSelectedDevices] = useState<ReadonlySet<Device>>(
    () => new Set(),
  )
  const wrapRef = useRef<HTMLDivElement>(null)
  useOutsideClick(wrapRef, () => setOpen(false))

  // 기본 정렬은 상담 일시 내림차순(최신순) — 정렬 버튼 추가 전의 기존 동작과 동일.
  const [sortField, setSortField] = useState<ConsultationSummarySortField>(
    ConsultationSummarySortField.AT,
  )
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const toggleSort = (field: ConsultationSummarySortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const toggleDevice = (device: Device) => {
    setSelectedDevices((prev) => {
      const next = new Set(prev)
      if (next.has(device)) next.delete(device)
      else next.add(device)
      return next
    })
  }

  const rows = useMemo(
    () =>
      sortConsultationSummaryRows(
        buildConsultationSummaryRows(leads, selectedDevices),
        sortField,
        sortDirection,
      ),
    [leads, selectedDevices, sortField, sortDirection],
  )

  const triggerLabel =
    selectedDevices.size === 0
      ? '기기 선택'
      : selectedDevices.size === ALL_DEVICES.length
        ? '전체 기기'
        : `${selectedDevices.size}개 기기`

  return (
    <div className="consultation_summary">
      <div className="consultation_summary_head">
        <span className="title">상담 기기 서머리</span>
        <span className="count">{rows.length}건</span>

        <div className="device_multiselect" ref={wrapRef}>
          <button
            type="button"
            className={[
              'device_multiselect_btn',
              open ? 'open' : '',
              selectedDevices.size < ALL_DEVICES.length ? 'active' : '',
            ].join(' ')}
            onClick={() => setOpen((v) => !v)}
          >
            <span>상담기기: {triggerLabel}</span>
            <div className="chevron_box">
              <svg viewBox="0 0 20 20" fill="none" className="chevron">
                <path
                  d="M5 7.5 10 12.5 15 7.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>

          {open && (
            <div className="device_multiselect_menu">
              {ALL_DEVICES.map((device) => (
                <label key={device} className="device_multiselect_item">
                  <input
                    type="checkbox"
                    checked={selectedDevices.has(device)}
                    onChange={() => toggleDevice(device)}
                  />
                  <span>{device}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="consultation_summary_table_wrap">
        <table className="consultation_summary_table">
          <thead>
            <tr>
              <th>
                고객명
                <SortButton
                  columnKey={ConsultationSummarySortField.FIRST_NAME}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
              </th>
              <th>
                전화번호
                <SortButton
                  columnKey={ConsultationSummarySortField.PHONE}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
              </th>
              <th>
                상담 기기
                <SortButton
                  columnKey={ConsultationSummarySortField.DEVICE}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
              </th>
              <th>
                상담 일시
                <SortButton
                  columnKey={ConsultationSummarySortField.AT}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
              </th>
              <th>
                비고
                <SortButton
                  columnKey={ConsultationSummarySortField.REMARKS}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="empty" colSpan={5}>
                  {selectedDevices.size === 0
                    ? '상담기기를 선택해주세요.'
                    : '해당 기기로 상담한 이력이 없습니다.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.recordId}>
                  <td>{row.fn}</td>
                  <td>{formatPhoneNumber(row.ph)}</td>
                  <td>{row.device}</td>
                  <td>{formatTime(row.at)}</td>
                  <td>{row.remarks}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
