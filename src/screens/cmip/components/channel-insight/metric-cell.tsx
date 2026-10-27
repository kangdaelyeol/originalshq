

type DeltaDir = 'up' | 'down' | 'flat'

const DELTA_ARROW: Record<DeltaDir, string> = { up: '▲', down: '▼', flat: '—' }

/** 두 값 사이의 증감/등락률 — prev가 없으면(첫 행 등) null. 화면에 나열된 순서상
 * "바로 윗 행"과 비교하는 데 쓴다 — 기본 정렬(시간순)이면 일별 표에선 전일대비,
 * 주차별 표에선 전주대비가 되고, 요일별 표는 월~일 순서상 바로 앞 요일과
 * 비교한다. 컬럼 정렬을 바꾸면 그 정렬 순서의 윗 행과 비교한다.
 * 메인 행뿐 아니라 채널별 펼침 행(각 채널의 이전 행 값)에도 그대로 쓴다. */
function computeMetricDelta(
  now: number,
  prev: number | null,
): { delta: number; pct: number | null; dir: DeltaDir } | null {
  if (prev == null) return null
  // 신규 고객 ROAS처럼 값을 모르는(NaN) 칸은 증감을 낼 수 없다.
  if (!Number.isFinite(now) || !Number.isFinite(prev)) return null
  const delta = now - prev
  const pct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : null
  const dir: DeltaDir = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  return { delta, pct, dir }
}

/** 지표 한 칸의 내용 — 대비 표시가 꺼져 있거나 비교할 이전 값이 없으면 값만,
 * 켜져 있으면 왼쪽에 증감/등락률, 오른쪽에 값을 같이 보여준다. 메인 행과 채널별
 * 펼침 행이 이 렌더링을 공유한다. */
export function MetricCell({
  value,
  prevValue,
  format,
  showCompare,
}: {
  value: number
  prevValue: number | null
  format: (v: number) => string
  showCompare: boolean
}) {
  const cmp = showCompare ? computeMetricDelta(value, prevValue) : null
  if (!cmp) return <>{format(value)}</>
  return (
    <span className="channel-insight__metric-cell">
      <span className={`channel-insight__metric-delta is-${cmp.dir}`}>
        {DELTA_ARROW[cmp.dir]} {format(Math.abs(cmp.delta))}
        {cmp.pct != null &&
          ` (${cmp.delta >= 0 ? '+' : '-'}${Math.abs(cmp.pct).toFixed(1)}%)`}
      </span>
      <span className="channel-insight__metric-value">{format(value)}</span>
    </span>
  )
}
