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
  toggleAllChecked: () => void
  toggleSort: (field: SortField) => void
  showDetail: (rowId: string) => void
  toggleTestRow: (rowId: string) => void
  updateTestEventCode: (rowId: string, code: string) => void
}

interface TableState {
  allChecked: boolean
  sortField: SortField
  sortDirection: SortDirection
  rows: Lead[]
  /** 행마다 "테스트" 체크 여부 + test_event_code 입력값 — 등록(contactLead/
   * purchaseLead)에 얹어 보낼 값이라 Lead 데이터와 별개로 rowId로만 관리한다. */
  testRows: Record<string, { checked: boolean; code: string }>
}

interface TableProps {
  state: TableState
  actions: TableActions
}

const latestAt = (records: { at: number }[]): number =>
  records.reduce((max, r) => Math.max(max, r.at), 0)

const intakeTitle = (records: IntakeRecord[]): string =>
  records
    .map((r) => `${formatTime(r.at)}${r.device ? ` · ${r.device}` : ''}`)
    .reverse()
    .join('\n')

const consultationTitle = (records: ConsultationRecord[]): string =>
  records
    .map((r) => `${formatTime(r.at)} · ${r.device}`)
    .reverse()
    .join('\n')

const purchaseTitle = (records: PurchaseRecord[]): string =>
  records
    .map(
      (r) =>
        `${formatTime(r.at)} · ${r.device} · ${r.price.toLocaleString('ko-KR')}원`,
    )
    .reverse()
    .join('\n')

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
 * 순수 조회용이고, 행을 누르면(체크박스·테스트 토글처럼 자기 클릭을 직접
 * 처리하는 칸은 제외) 그 모달이 열린다.
 */
export const Table = ({ state, actions }: TableProps) => {
  const { toggleAllChecked, toggleSort, showDetail, toggleTestRow, updateTestEventCode } =
    actions

  const { allChecked, sortField, sortDirection, rows, testRows } = state

  return (
    <div className="table_container">
      <div className="table">
        <div className="table_scroll">
          <table className="lead_table">
            <thead>
              <tr>
                <th className="col-cb">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={allChecked}
                    onClick={toggleAllChecked}
                    className={[allChecked ? 'checked' : '', 'check-btn'].join(
                      ' ',
                    )}
                  >
                    {allChecked && (
                      <svg viewBox="0 0 14 14" fill="none">
                        <path
                          pathLength={40}
                          d="M3 7.2 5.6 10 11 4"
                          stroke="#eeeeee"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray={40}
                        />
                      </svg>
                    )}
                  </button>
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
                <th className="col-fn">
                  고객명
                  <SortButton
                    columnKey={SortField.FIRST_NAME}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </th>
                <th className="col-ph">
                  전화번호
                  <SortButton
                    columnKey={SortField.PHONE}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </th>
                <th className="col-remarks">비고</th>
                <th className="col-status">상담 현황</th>
                <th className="col-status">구매 현황</th>
                <th className="col-test">테스트</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                // 마이그레이션 전의 옛 리드 문서엔 이 배열 필드 자체가 없을 수
                // 있어(Firestore에 값이 없던 필드는 undefined로 온다) 방어적으로
                // 기본값을 준다.
                const intakes = row.intakes ?? []
                const consultations = row.consultations ?? []
                const purchases = row.purchases ?? []

                return (
                  <tr
                    key={row.id}
                    className="row-clickable"
                    onClick={() => showDetail(row.id)}
                  >
                    {/* Checkbox Cell — 자기 클릭을 직접 처리하니 행 클릭(상세
                        모달 열기)으로 안 번지게 막는다. */}
                    <td className="col-cb" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        role="checkbox"
                        className={[
                          allChecked ? 'checked' : '',
                          'check-btn',
                        ].join(' ')}
                        aria-checked={false}
                      >
                        {allChecked && (
                          <svg viewBox="0 0 14 14" fill="none">
                            <path
                              pathLength={40}
                              d="M3 7.2 5.6 10 11 4"
                              stroke="#eeeeee"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray={40}
                            />
                          </svg>
                        )}
                      </button>
                    </td>

                    {/* Intake status cell */}
                    <td className="col-status" title={intakeTitle(intakes)}>
                      {intakes.length > 0 ? (
                        <div className="status_stack">
                          <span className="count">{intakes.length}건</span>
                          <span className="latest">
                            {formatTime(latestAt(intakes))}
                          </span>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>

                    {/* First name Cell */}
                    <td className="col-fn">
                      <span>{row.fn || '이름 없음'}</span>
                    </td>

                    {/* Phone number Cell */}
                    <td className="col-ph">
                      <span>{formatPhoneNumber(row.ph)}</span>
                    </td>

                    {/* Remarks cell — 회사명/직책/동반 구매자 등 내부 참고용 메모 */}
                    <td className="col-remarks">
                      <span>{row.remarks || '-'}</span>
                    </td>

                    {/* Consultation status cell */}
                    <td
                      className="col-status"
                      title={consultationTitle(consultations)}
                    >
                      {consultations.length > 0 ? (
                        <div className="status_stack">
                          <span className="count">
                            {consultations.length}건
                          </span>
                          <span className="latest">
                            {formatTime(latestAt(consultations))}
                          </span>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>

                    {/* Purchase status cell */}
                    <td className="col-status" title={purchaseTitle(purchases)}>
                      {purchases.length > 0 ? (
                        <div className="status_stack">
                          <span className="count">{purchases.length}건</span>
                          <span className="latest">
                            {formatTime(latestAt(purchases))}
                          </span>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>

                    {/* Test checkbox + test_event_code — 켜두면 상세 모달에서
                        다음 등록(상담/구매 무관) 클릭 때 Meta CAPI 호출에
                        test_event_code가 실려 나가 이벤트 관리자의 테스트
                        이벤트로 잡힌다. 자기 클릭을 직접 처리하니 행 클릭으로
                        안 번지게 막는다. */}
                    <td className="col-test" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={testRows[row.id]?.checked ?? false}
                        onClick={() => toggleTestRow(row.id)}
                        className={[
                          testRows[row.id]?.checked ? 'checked' : '',
                          'check-btn',
                        ].join(' ')}
                      >
                        {testRows[row.id]?.checked && (
                          <svg viewBox="0 0 14 14" fill="none">
                            <path
                              pathLength={40}
                              d="M3 7.2 5.6 10 11 4"
                              stroke="#eeeeee"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray={40}
                            />
                          </svg>
                        )}
                      </button>
                      {testRows[row.id]?.checked && (
                        <input
                          className="test-event-code-input"
                          placeholder="test_event_code"
                          value={testRows[row.id]?.code ?? ''}
                          onChange={(e) =>
                            updateTestEventCode(row.id, e.target.value)
                          }
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
