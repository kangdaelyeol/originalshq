import { memo, useMemo } from 'react'
import { SortField, type SortDirection } from '@/screens/xtool-lead-manager/types'
import { formatPhoneNumber, formatTime } from '@/screens/xtool-lead-manager/utils'
import { SortButton } from '@/screens/xtool-lead-manager/components'
import type {
  ConsultationRecord,
  IntakeRecord,
  Lead,
  PurchaseRecord,
} from '@/screens/xtool-lead-manager/entity'

interface TableActions {
  toggleSort: (field: SortField) => void
  showDetail: (rowId: string) => void
}

interface TableState {
  sortField: SortField
  sortDirection: SortDirection
  rows: Lead[]
}

interface TableProps {
  state: TableState
  actions: TableActions
}

// row.intakes 등이 undefined인 레코드(마이그레이션 전 리드)에서 매번
// `?? []`로 새 배열을 만들면 그 자체가 매 렌더 새 참조가 되어, 아래
// LeadRow의 useMemo가 매번 무효화된다 — 하나로 고정해 재사용한다.
const EMPTY_RECORDS: readonly never[] = []

const latestAt = (records: { at: number }[]): number =>
  records.reduce((max, r) => Math.max(max, r.at), 0)

const intakeTitle = (records: readonly IntakeRecord[]): string =>
  records
    .map((r) => `${formatTime(r.at)}${r.device ? ` · ${r.device}` : ''}`)
    .reverse()
    .join('\n')

const consultationTitle = (records: readonly ConsultationRecord[]): string =>
  records
    .map((r) => `${formatTime(r.at)} · ${r.device}`)
    .reverse()
    .join('\n')

const purchaseTitle = (records: readonly PurchaseRecord[]): string =>
  records
    .map(
      (r) =>
        `${formatTime(r.at)} · ${r.device} · ${r.price.toLocaleString('ko-KR')}원`,
    )
    .reverse()
    .join('\n')

interface LeadRowProps {
  row: Lead
  onShowDetail: (rowId: string) => void
}

/**
 * 표 행 하나 — 예전엔 Table의 .map() 콜백 안에서 바로 JSX를 만들었는데,
 * 검색어를 한 글자 칠 때마다 표 전체(모든 행)가 다시 그려지면서 각 행의
 * intakeTitle/consultationTitle/purchaseTitle(이력 배열을 map·reverse·join)
 * 까지 매번 다시 계산돼 타이핑이 버벅였다. 이제 행을 별도 컴포넌트로 뽑아
 * React.memo로 감싸고, 이력 문자열도 그 배열 자체(참조)가 안 바뀌면
 * useMemo가 재계산을 건너뛴다 — 검색·정렬·기기 필터로 표가 다시 그려져도
 * 실제 이력이 안 바뀐 행은(객체 참조가 그대로 유지되므로) 통째로 스킵된다.
 */
const LeadRow = memo(function LeadRow({ row, onShowDetail }: LeadRowProps) {
  const intakes = row.intakes ?? EMPTY_RECORDS
  const consultations = row.consultations ?? EMPTY_RECORDS
  const purchases = row.purchases ?? EMPTY_RECORDS

  const intakeTitleText = useMemo(() => intakeTitle(intakes), [intakes])
  const consultationTitleText = useMemo(
    () => consultationTitle(consultations),
    [consultations],
  )
  const purchaseTitleText = useMemo(
    () => purchaseTitle(purchases),
    [purchases],
  )

  return (
    <tr className="row-clickable" onClick={() => onShowDetail(row.id)}>
      {/* Phone number Cell */}
      <td className="col-ph">
        <span>{formatPhoneNumber(row.ph)}</span>
      </td>

      {/* First name Cell */}
      <td className="col-fn">
        <span>{row.fn || '이름 없음'}</span>
      </td>

      {/* Remarks cell — 회사명/직책/동반 구매자 등 내부 참고용 메모 */}
      <td className="col-remarks">
        <span>{row.remarks || '-'}</span>
      </td>

      {/* Intake status cell */}
      <td className="col-status" title={intakeTitleText}>
        {intakes.length > 0 ? (
          <div className="status_stack">
            <span className="count">{intakes.length}건</span>
            <span className="latest">{formatTime(latestAt(intakes))}</span>
          </div>
        ) : (
          <span>-</span>
        )}
      </td>

      {/* Consultation status cell */}
      <td className="col-status" title={consultationTitleText}>
        {consultations.length > 0 ? (
          <div className="status_stack">
            <span className="count">{consultations.length}건</span>
            <span className="latest">
              {formatTime(latestAt(consultations))}
            </span>
          </div>
        ) : (
          <span>-</span>
        )}
      </td>

      {/* Purchase status cell */}
      <td className="col-status" title={purchaseTitleText}>
        {purchases.length > 0 ? (
          <div className="status_stack">
            <span className="count">{purchases.length}건</span>
            <span className="latest">{formatTime(latestAt(purchases))}</span>
          </div>
        ) : (
          <span>-</span>
        )}
      </td>
    </tr>
  )
})

/**
 * 예전엔 div + flex로 "표처럼 보이게만" 짠 구조라, 헤더와 행의 칸 개수·폭을
 * 수동으로 맞춰야 했다(실제로 register/delete/detail 헤더 칸이 통째로 빠져있던
 * 버그, 표마다 필요한 폭이 다른데 min-width 하나를 공유해 칸이 찌그러지던
 * 버그가 둘 다 여기서 비롯됐다). cmip처럼 진짜 <table>로 바꾸면 브라우저가
 * 헤더·행의 컬럼 폭을 항상 같은 기준으로 맞춰주므로 이 종류의 버그 자체가
 * 안 생긴다.
 *
 * 상담/구매를 다건으로 지원하면서 신규유입/상담완료/구매완료 3개 보드로
 * 나눌 이유가 없어져 표 하나로 통합했다. 상담 등록/구매 등록/삭제, 그리고
 * 셀 인라인 수정까지 전부 표에서 빼고 고객 상세 모달로 옮겼다 — 표는 이제
 * 순수 조회용이고, 행을 누르면 그 모달이 열린다. 체크박스(선택)·테스트
 * 토글 칸도 실제로 쓰는 일괄 동작이 없어 제거했다 — 테스트 이벤트 전송은
 * 상담/구매 등록 확인 모달과 상세 모달의 ↻(재전송) 버튼에서 그 자리에서
 * 바로 켜고 코드를 입력하도록 옮겼다. 페이지네이션 컨트롤은 상단 nav로
 * 옮겼다(PaginationBar) — rows는 여기 넘어오는 시점에 이미 한 페이지 분량만
 * 걸러져 있다.
 */
export const Table = ({ state, actions }: TableProps) => {
  const { toggleSort, showDetail } = actions
  const { sortField, sortDirection, rows } = state

  return (
    <div className="table_container">
      <div className="table">
        <div className="table_scroll">
          <table className="lead_table">
            <thead>
              <tr>
                <th className="col-ph">
                  전화번호
                  <SortButton
                    columnKey={SortField.PHONE}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </th>
                <th className="col-fn">
                  고객명
                  <SortButton
                    columnKey={SortField.FIRST_NAME}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </th>
                <th className="col-remarks">
                  비고
                  <SortButton
                    columnKey={SortField.REMARKS}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </th>
                <th className="col-status">
                  접수 현황
                  <SortButton
                    columnKey={SortField.CREATED_AT}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </th>
                <th className="col-status">
                  상담 현황
                  <SortButton
                    columnKey={SortField.CONSULTATION_AT}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </th>
                <th className="col-status">
                  구매 현황
                  <SortButton
                    columnKey={SortField.PURCHASE_AT}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <LeadRow key={row.id} row={row} onShowDetail={showDetail} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
