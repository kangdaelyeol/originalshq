import {
  formatSpan,
  viewLabel,
  type Transition,
  type UsageApp,
  type UsageSummary,
  type ViewUsage,
} from '../utils/usage'
import {
  PanelBars,
  PanelCell,
  PanelStats,
  PanelTitle,
  SidePanel,
} from './side-panel'

const keyOf = (app: UsageApp, view: string) => `${app}|${view}`

/**
 * 사용 분석 흐름 그림의 노드 상세 — 오른쪽 패널. 접속 노드는 처음 본 탭들,
 * 탭 노드는 그 탭의 사용량과 들어온 곳·나간 곳(탭 이동 전부 기준). 들어온 곳·
 * 나간 곳의 줄을 누르면 그 탭으로 옮긴다.
 */
export const UsageNodePanel = ({
  open,
  nodeId,
  nodeIds,
  summary,
  byView,
  allFlows,
  entries,
  onSelect,
  onClose,
}: {
  open: boolean
  nodeId: string
  /** 그림의 노드 순서 — ←/→로 옮길 때. */
  nodeIds: string[]
  summary: UsageSummary
  byView: ViewUsage[]
  allFlows: Transition[]
  entries: { app: UsageApp; view: string; count: number }[]
  onSelect: (nodeId: string) => void
  onClose: () => void
}) => {
  const index = nodeIds.indexOf(nodeId)
  const heading =
    index === -1
      ? 'TAB'
      : `NODE ${String(index + 1).padStart(2, '0')}/${String(nodeIds.length).padStart(2, '0')}`
  const step = (delta: -1 | 1) =>
    onSelect(
      nodeIds[(Math.max(0, index) + delta + nodeIds.length) % nodeIds.length],
    )
  // 앱은 짧은 이름(xtool·cmip)으로 — 탭 이름이 잘리지 않게.
  const label = (app: UsageApp, view: string) =>
    `${app} · ${viewLabel(app, view)}`
  const flowRow = (key: string, name: string, count: number) => ({
    key,
    name,
    value: count,
    text: `${count}회`,
  })

  if (nodeId === 'entry') {
    const sessions = entries.reduce((sum, each) => sum + each.count, 0)
    return (
      <SidePanel
        open={open}
        tone="accent"
        heading={heading}
        idLine="entry · 세션의 첫 탭"
        contentKey={nodeId}
        label="접속 상세"
        onClose={onClose}
        onStep={step}
      >
        <PanelTitle
          title="접속"
          tag="entry"
          desc="화면에 들어와 처음 본 탭 — 세션 하나가 한 번 센다."
        />
        <PanelCell title="SUMMARY" index={1}>
          <PanelStats
            items={[
              { label: '세션', value: `${sessions}회` },
              { label: '방문자', value: `${summary.visitors}명` },
              { label: '총 사용 시간', value: formatSpan(summary.visibleMs) },
              {
                label: '세션당 평균',
                value: formatSpan(summary.averageSessionMs),
              },
            ]}
          />
        </PanelCell>
        <PanelCell title="FIRST TAB" index={2}>
          <PanelBars
            rows={entries.map((each) =>
              flowRow(
                keyOf(each.app, each.view),
                label(each.app, each.view),
                each.count,
              ),
            )}
            empty="기록이 없습니다."
            onPick={onSelect}
          />
        </PanelCell>
      </SidePanel>
    )
  }

  const [app, view] = nodeId.split('|') as [UsageApp, string]
  const usage = byView.find((each) => each.app === app && each.view === view)
  const entered = entries.find((each) => each.app === app && each.view === view)
  const incoming = [
    ...(entered ? [flowRow('entry', '접속 (처음 본 탭)', entered.count)] : []),
    ...allFlows
      .filter((flow) => flow.app === app && flow.to === view)
      .map((flow) =>
        flowRow(keyOf(app, flow.from), viewLabel(app, flow.from), flow.count),
      ),
  ]
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
  const outgoing = allFlows
    .filter((flow) => flow.app === app && flow.from === view)
    .map((flow) =>
      flowRow(keyOf(app, flow.to), viewLabel(app, flow.to), flow.count),
    )
    .slice(0, 8)

  return (
    <SidePanel
      open={open}
      tone="accent"
      heading={heading}
      idLine={`${app} · ${view}`}
      contentKey={nodeId}
      label={`${viewLabel(app, view)} 상세`}
      onClose={onClose}
      onStep={step}
    >
      <PanelTitle
        title={viewLabel(app, view)}
        tag={app}
        desc="이 탭을 얼마나 봤는지와, 어디서 들어와 어디로 나갔는지."
      />
      <PanelCell title="USAGE" index={1}>
        {usage ? (
          <PanelStats
            items={[
              { label: '방문', value: `${usage.visits}회` },
              { label: '방문자', value: `${usage.visitors}명` },
              { label: '총 시간', value: formatSpan(usage.visibleMs) },
              { label: '평균 머문 시간', value: formatSpan(usage.averageMs) },
              {
                label: '전체 중 비중',
                value: `${(usage.share * 100).toFixed(1)}%`,
              },
              { label: '처음 본 탭으로', value: `${entered?.count ?? 0}회` },
            ]}
          />
        ) : (
          <p className="log-insp__empty">이 기간에 기록이 없습니다.</p>
        )}
      </PanelCell>
      <PanelCell title="CAME FROM" index={2}>
        <PanelBars
          rows={incoming}
          empty="다른 탭에서 들어온 기록이 없습니다."
          onPick={onSelect}
        />
      </PanelCell>
      <PanelCell title="WENT TO" index={3}>
        <PanelBars
          rows={outgoing}
          empty="이 탭에서 다른 탭으로 간 기록이 없습니다."
          onPick={onSelect}
        />
      </PanelCell>
    </SidePanel>
  )
}
