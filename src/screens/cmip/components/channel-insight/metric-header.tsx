import type { MetricField } from '../metric-fields'
import { InfoIcon, type SortDir, SortArrows } from '../icons'

/** 지표 컬럼 헤더 라벨 — field.note가 있으면(현재 frequency만) 옆에 "?" 아이콘을
 * 달아, 호버(또는 포커스, 키보드 접근성)하면 설명이 뜬다. 채널마다 그 지표를
 * 지원하는 범위가 달라(예: 네이버는 frequency 자체가 없고, Google은 캠페인
 * 단위에만 있음) 값만 보고는 헷갈릴 수 있는 지표를 위한 것 — 표 헤더 여러 곳
 * (전체 요약/캠페인·adset 교차표/전체 목록)이 이 컴포넌트를 공유한다.
 * label을 넘기면 field.label 대신 그걸 쓴다(단위가 붙은 "Frequency(회)" 같은
 * 표시용 텍스트를 쓰면서 note는 그대로 field 기준으로 가져오는 경우). */
export function MetricHeaderLabel({
  field,
  label,
}: {
  field: MetricField
  label?: string
}) {
  const text = label ?? field.label
  if (!field.note) return <>{text}</>
  return (
    <span className="channel-insight__metric-head">
      {text}
      <span className="channel-insight__info" tabIndex={0}>
        <InfoIcon />
        <span className="channel-insight__info-tooltip" role="tooltip">
          {field.note}
        </span>
      </span>
    </span>
  )
}

/** 정렬 가능한 지표 컬럼 헤더 — 정렬 버튼(라벨+화살표) 옆에, note가 있으면(현재
 * frequency만) "?" 아이콘을 버튼 밖에 따로 둔다(버튼 안에 넣으면 "?" 클릭이
 * 정렬 토글까지 같이 눌러버린다). MetricsTable/FullListTable 둘 다 공유. */
export function SortableMetricHeader({
  field,
  active,
  dir,
  onSort,
}: {
  field: MetricField
  active: boolean
  dir: SortDir
  onSort: () => void
}) {
  return (
    <>
      <button
        type="button"
        className="channel-insight__sort-head"
        onClick={onSort}
      >
        {field.label}
        <SortArrows active={active} dir={dir} />
      </button>
      {field.note && (
        <span className="channel-insight__info" tabIndex={0}>
          <InfoIcon />
          <span className="channel-insight__info-tooltip" role="tooltip">
            {field.note}
          </span>
        </span>
      )}
    </>
  )
}
