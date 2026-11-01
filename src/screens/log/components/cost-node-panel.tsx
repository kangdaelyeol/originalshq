import type { ApiCostReport } from '../client/api-cost-client'
import {
  COST_PART_LABEL,
  COST_RESOURCES,
  costByDate,
  formatBytes,
  formatCount,
  formatMs,
  formatUsd,
  type CostPart,
  type FnCost,
} from '../utils/api-cost'
import { formatDateTime } from '../utils/batch-run'
import {
  PanelBars,
  PanelCell,
  PanelList,
  PanelStats,
  PanelTitle,
  SidePanel,
} from './side-panel'

const TRIGGER_DESC: Record<string, string> = {
  http: '화면·외부에서 HTTP로 부르는 함수',
  callable: '로그인한 화면이 Firebase 호출형(onCall)으로 부르는 함수',
  schedule: '정해진 시각에 스스로 도는 예약 함수',
}

const usdRows = (rows: { key: string; name: string; value: number }[]) =>
  rows
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((row) => ({ ...row, text: formatUsd(row.value) }))

/**
 * 비용 지도의 노드 상세 — 오른쪽 패널.
 *   · 함수: 비용·사용량, 비용 구성, 날짜별, 외부 호출, 비싼 호출
 *   · 자원(읽기·쓰기 등): 그 자원에 돈을 쓴 함수 순위
 *   · 호출 방식: 그 방식의 함수 순위
 * 함수 순위의 줄을 누르면 그 함수로 옮긴다.
 */
export const CostNodePanel = ({
  open,
  nodeId,
  nodeIds,
  fns,
  report,
  onSelect,
  onClose,
}: {
  open: boolean
  nodeId: string
  /** 그림의 노드 순서 — ←/→로 옮길 때. */
  nodeIds: string[]
  fns: FnCost[]
  report: ApiCostReport
  onSelect: (nodeId: string) => void
  onClose: () => void
}) => {
  const index = nodeIds.indexOf(nodeId)
  const heading =
    index === -1
      ? 'NODE'
      : `NODE ${String(index + 1).padStart(2, '0')}/${String(nodeIds.length).padStart(2, '0')}`
  const step = (delta: -1 | 1) =>
    onSelect(
      nodeIds[(Math.max(0, index) + delta + nodeIds.length) % nodeIds.length],
    )
  const [kind, ...rest] = nodeId.split(':')
  const key = rest.join(':')
  const shell = {
    open,
    heading,
    contentKey: nodeId,
    onClose,
    onStep: step,
  }

  if (kind === 'fn') {
    const fn = fns.find((each) => each.fn === key)
    if (!fn) return null
    const daily = costByDate(report.byDay, fn.fn)
    const hosts = Object.entries(report.external[fn.fn] ?? {})
    const calls = [...report.topReads, ...report.topSlow]
      .filter((call) => call.fn === fn.fn)
      .filter(
        (call, i, list) =>
          list.findIndex((other) => other.at === call.at) === i,
      )
      .sort((a, b) => b.reads - a.reads || b.durationMs - a.durationMs)
      .slice(0, 8)
    return (
      <SidePanel
        {...shell}
        tone={fn.errors > 0 ? 'partial' : 'accent'}
        idLine={`${fn.trigger} · ${fn.memoryMb ? `${fn.memoryMb}MB` : '메모리 모름'}`}
        label={`${fn.fn} 비용 상세`}
      >
        <PanelTitle
          title={fn.fn}
          tag={fn.trigger}
          desc={`기간 어림 비용의 ${(fn.share * 100).toFixed(1)}%`}
        />
        <PanelCell title="SUMMARY" index={1}>
          <PanelStats
            items={[
              { label: '어림 비용', value: formatUsd(fn.cost) },
              { label: '호출', value: `${formatCount(fn.calls)}회` },
              {
                label: '평균 · p95',
                value: `${formatMs(fn.avgMs)} · ${formatMs(fn.p95Ms)}`,
              },
              {
                label: '오류 · 콜드 스타트',
                value: `${fn.errors} · ${fn.coldStarts}`,
                tone: fn.errors ? 'warn' : undefined,
              },
              {
                label: '읽기 (호출당)',
                value: `${formatCount(fn.reads)} (${fn.calls ? Math.round(fn.reads / fn.calls) : 0})`,
              },
              { label: '한 번에 최대 읽기', value: formatCount(fn.maxReads) },
              {
                label: '쓰기 · 삭제',
                value: `${formatCount(fn.writes)} · ${formatCount(fn.deletes)}`,
              },
              { label: '응답 합계', value: formatBytes(fn.responseBytes) },
            ]}
          />
        </PanelCell>
        <PanelCell title="COST BREAKDOWN" index={2}>
          <PanelBars
            rows={usdRows(
              (Object.keys(fn.parts) as CostPart[]).map((part) => ({
                key: `res:${part}`,
                name: COST_PART_LABEL[part],
                value: fn.parts[part],
              })),
            )}
            empty="비용이 없습니다."
            onPick={onSelect}
          />
        </PanelCell>
        <PanelCell title="DAILY" index={3}>
          <PanelBars
            rows={daily.map((day) => ({
              key: day.date,
              name: `${day.date.slice(5)} · ${formatCount(day.calls)}회`,
              value: day.cost,
              text: formatUsd(day.cost),
            }))}
            empty="기록이 없습니다."
          />
        </PanelCell>
        {hosts.length > 0 && (
          <PanelCell title="EXTERNAL" index={4}>
            <PanelBars
              rows={hosts
                .sort((a, b) => b[1] - a[1])
                .map(([host, count]) => ({
                  key: host,
                  name: host,
                  value: count,
                  text: `${formatCount(count)}회`,
                }))}
              empty="외부 호출이 없습니다."
            />
          </PanelCell>
        )}
        <PanelCell title="HEAVY CALLS" index={5}>
          <PanelList
            items={calls.map((call) => ({
              key: `${call.at}`,
              title: `${call.method} ${call.status} · ${formatMs(call.durationMs)}`,
              meta: `${formatDateTime(call.at)}${call.coldStart ? ' · 콜드 스타트' : ''}`,
              side: `R${formatCount(call.reads)} W${call.writes}`,
            }))}
            empty="기간의 상위 호출에 들지 않았습니다."
          />
        </PanelCell>
      </SidePanel>
    )
  }

  // 자원 노드 또는 호출 방식 노드 — 함수 순위.
  const resource = COST_RESOURCES.find((each) => each.id === key)
  const isResource = kind === 'res' && resource
  const ranked = usdRows(
    fns
      .filter((each) => isResource || each.trigger === key)
      .map((each) => ({
        key: `fn:${each.fn}`,
        name: each.fn,
        value: isResource ? each.parts[resource.id] : each.cost,
      })),
  ).slice(0, 15)
  const sum = ranked.reduce((total, row) => total + row.value, 0)

  return (
    <SidePanel
      {...shell}
      tone="accent"
      idLine={isResource ? `resource · ${key}` : `trigger · ${key}`}
      label={`${isResource ? resource.label : key} 상세`}
    >
      <PanelTitle
        title={isResource ? resource.label : key.toUpperCase()}
        tag={isResource ? 'resource' : 'trigger'}
        desc={
          isResource
            ? `이 자원에 쓴 어림 비용 ${formatUsd(sum)} — 함수별`
            : (TRIGGER_DESC[key] ?? '')
        }
      />
      <PanelCell title="BY FUNCTION" index={1}>
        <PanelBars
          rows={ranked}
          empty="비용을 쓴 함수가 없습니다."
          onPick={onSelect}
        />
      </PanelCell>
    </SidePanel>
  )
}
