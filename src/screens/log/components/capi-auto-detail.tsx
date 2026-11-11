// CAPI 자동 전송(capi-auto) 실행의 건별 표 — 결과(functions-xtool
// capi-auto/run.ts의 CapiAutoResult)를 보낸 것·보낼 것·건너뜀·실패로 나눠 한 줄씩.

type Entry = {
  itemId: string
  board: string
  kind: 'consultation' | 'purchase'
  name: string
  phone: string
  day: string
  device: string
  value: number
  existingLead: boolean
  reason?: string
}

const GROUPS = [
  { key: 'sent', label: '보냄' },
  { key: 'preview', label: '보낼 것' },
  { key: 'skipped', label: '건너뜀' },
  { key: 'failed', label: '실패' },
] as const

const KIND_LABEL: Record<Entry['kind'], string> = {
  consultation: '상담(Contact)',
  purchase: '구매(Purchase)',
}

/** 결과가 capi-auto 모양이 아니면 아무것도 그리지 않는다. */
export const CapiAutoDetail = ({ result }: { result: unknown }) => {
  if (!result || typeof result !== 'object') return null
  const data = result as Record<string, unknown>
  const rows = GROUPS.flatMap(({ key, label }) =>
    Array.isArray(data[key]) ? (data[key] as Entry[]).map((entry) => ({ ...entry, group: label })) : [],
  )
  const boards = Array.isArray(data.boards) ? (data.boards as { name: string }[]).map((board) => board.name) : []

  return (
    <>
      <h3>
        {data.live ? '보낸 기록' : '미리보기 — 실제로 켜면 보낼 기록'}
        {boards.length > 0 && <span className="batch-log__muted"> · 대상 보드 {boards.join(', ')}</span>}
      </h3>
      {rows.length === 0 ? (
        <p className="batch-log__muted">이번 실행에서 보낼 기록이 없었습니다.</p>
      ) : (
        <div className="batch-log__table-scroll">
          <table className="batch-log__table">
            <thead>
              <tr>
                <th>구분</th>
                <th>보드</th>
                <th>종류</th>
                <th>고객</th>
                <th>번호</th>
                <th>날짜</th>
                <th>기기</th>
                <th className="is-num">금액</th>
                <th>리드</th>
                <th>사유</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.group}:${row.itemId}`}>
                  <td>{row.group}</td>
                  <td>{row.board}</td>
                  <td>{KIND_LABEL[row.kind] ?? row.kind}</td>
                  <td>{row.name}</td>
                  <td className="batch-log__mono">{row.phone}</td>
                  <td>{row.day}</td>
                  <td>{row.device}</td>
                  <td className="is-num">{row.value.toLocaleString('ko-KR')}원</td>
                  <td>{row.existingLead ? '기존 리드에 더함' : '새 리드'}</td>
                  <td>{row.reason ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
