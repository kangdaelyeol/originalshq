import { INQUIRY_DEVICES } from '../client/inquiry-client'
import { SCHEDULE_HOURS } from '../constants'
import {
  formatAgo,
  formatDateTime,
  formatDuration,
  nextScheduledAt,
  STATUS_LABEL,
  type SlotState,
} from '../utils/batch-run'
import {
  formatSpan,
  viewLabel,
  type Transition,
  type UsageApp,
  type ViewUsage,
} from '../utils/usage'
import type { useBatchLogViewModel } from '../view-model/use-batch-log-view-model'
import {
  SignalGraph,
  type SignalEdge,
  type SignalNode,
  type SignalTone,
} from './signal-graph'

// 탭마다 맨 위에 두는 흐름 그림 — 데이터가 어디서 어디로 가는지와 지금 상태를
// 퍼셉트론의 신경망처럼 노드와 빛 점으로 보여 준다.

const toneOf = (state: SlotState | null): SignalTone => {
  switch (state) {
    case 'success':
      return 'ok'
    case 'partial':
      return 'warn'
    case 'failed':
    case 'timeout':
    case 'missing':
      return 'fail'
    case 'running':
      return 'run'
    default:
      return 'idle'
  }
}

// ── 배치 ─────────────────────────────────────────────────────────────────

type BatchState = ReturnType<typeof useBatchLogViewModel>['state']

// 뒤따르는 작업 — 앞 작업이 끝난 직후에 같은 함수 안에서 돈다.
const FOLLOWS: Record<string, string> = {
  'ga-events': 'monday-sync',
  'meta-ads': 'meta-insights',
}

/** 배치 파이프라인 — 스케줄러 → 작업(→ 뒤따르는 작업) → 저장소. 작업을 누르면
 * 아래 실행 내역이 그 작업으로 걸러진다(다시 누르면 전체). */
export const BatchFlow = ({
  state,
  onSelectJob,
}: {
  state: BatchState
  onSelectJob: (jobId: string) => void
}) => {
  const { jobs, now, jobFilter } = state
  const primary = jobs.filter((view) => !FOLLOWS[view.job.id])
  const rowY = (index: number, count: number) =>
    count === 1 ? 190 : 46 + (index * (380 - 92)) / (count - 1)
  const yById = new Map(
    primary.map((view, index) => [view.job.id, rowY(index, primary.length)]),
  )

  const jobNode = (view: (typeof jobs)[number], x: number, y: number) => ({
    id: view.job.id,
    x,
    y,
    label: view.job.label,
    sub: view.latest
      ? `${STATUS_LABEL[view.latestStatus ?? 'no-data']} · ${formatAgo(view.latest.startedAt, now)}`
      : '기록 없음',
    tag: view.latest ? formatDuration(view.latest.durationMs) : undefined,
    tone: toneOf(view.latestStatus),
    width: 210,
    active: jobFilter === view.job.id,
    onClick: () => onSelectJob(view.job.id),
  })

  const nodes: SignalNode[] = [
    {
      id: 'scheduler',
      x: 98,
      y: 190,
      label: 'SCHEDULER',
      sub: SCHEDULE_HOURS.map((h) => String(h).padStart(2, '0')).join('·'),
      tag: formatDateTime(nextScheduledAt(now)).slice(-8, -3),
      tone: 'accent',
      width: 170,
    },
    ...primary.map((view) => jobNode(view, 390, yById.get(view.job.id) ?? 190)),
    ...jobs
      .filter((view) => FOLLOWS[view.job.id])
      .map((view) =>
        jobNode(view, 660, yById.get(FOLLOWS[view.job.id]) ?? 190),
      ),
    {
      id: 'store:xtool',
      x: 912,
      y: yById.get('monday-sync') ?? 100,
      label: 'xtool DB',
      sub: 'Firestore · mondayStats',
      tone: 'idle',
      width: 160,
    },
    {
      id: 'store:cmip',
      x: 912,
      y: 280,
      label: 'cmip DB',
      sub: 'Firestore · 채널 성과',
      tone: 'idle',
      width: 160,
    },
  ]

  const flowing = (tone: SignalTone) => tone === 'ok' || tone === 'run'
  const edges: SignalEdge[] = jobs.flatMap((view) => {
    const tone = toneOf(view.latestStatus)
    const from = FOLLOWS[view.job.id] ?? 'scheduler'
    return [
      {
        from,
        to: view.job.id,
        tone,
        flow: flowing(tone),
        dashed: from !== 'scheduler',
        label: from !== 'scheduler' ? '직후' : undefined,
      },
      {
        from: view.job.id,
        to: `store:${view.job.codebase}`,
        tone: tone === 'ok' ? 'idle' : tone,
        flow: tone === 'ok',
      },
    ]
  })

  return (
    <SignalGraph
      width={1000}
      height={380}
      nodes={nodes}
      edges={edges}
      label="배치 파이프라인 — 스케줄러에서 작업, 저장소까지"
    />
  )
}

// ── 문의 접수 ────────────────────────────────────────────────────────────

/** 문의 접수 흐름 — 웹 폼 → 접수 함수 → Monday 보드(기기별)·접수 안내 문자. */
export const InquiryFlow = ({
  summary,
  deviceCounts,
}: {
  summary: {
    total: number
    mondayOk: number
    mondayFailed: number
    smsOk: number
    smsFailed: number
  }
  deviceCounts: Map<string, number>
}) => {
  const boards = INQUIRY_DEVICES.map((each) => ({
    ...each,
    count: deviceCounts.get(each.device) ?? 0,
  }))
    .filter((each) => each.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const max = Math.max(1, ...boards.map((each) => each.count))
  const has = summary.total > 0
  const mondayTone: SignalTone = !has
    ? 'idle'
    : summary.mondayFailed > 0
      ? 'fail'
      : 'ok'
  const smsTone: SignalTone = !has
    ? 'idle'
    : summary.smsFailed > 0
      ? 'fail'
      : summary.smsOk > 0
        ? 'ok'
        : 'idle'
  // 보드 노드는 노드 높이(46)보다 넓게 띄워 겹치지 않게.
  const boardY = (index: number) => 32 + index * 54
  const mondayY =
    boards.length > 0 ? (boardY(0) + boardY(boards.length - 1)) / 2 : 110

  const nodes: SignalNode[] = [
    {
      id: 'form',
      x: 96,
      y: 190,
      label: '웹사이트 폼',
      sub: `상담 신청 ${summary.total}건`,
      tone: 'accent',
      width: 160,
    },
    {
      id: 'fn',
      x: 330,
      y: 190,
      label: 'submitInquiry',
      sub: 'functions-xtool',
      tone: has ? 'ok' : 'idle',
      width: 180,
    },
    {
      id: 'monday',
      x: 590,
      y: mondayY,
      label: 'Monday 등록',
      sub: `등록 ${summary.mondayOk} · 미등록 ${summary.mondayFailed}`,
      tone: mondayTone,
      width: 190,
    },
    {
      id: 'sms',
      x: 590,
      y: 318,
      label: '접수 안내 문자',
      sub: `발송 ${summary.smsOk} · 실패 ${summary.smsFailed}`,
      tone: smsTone,
      width: 190,
    },
    ...boards.map((each, index) => ({
      id: `board:${each.device}`,
      x: 880,
      y: boardY(index),
      label: each.label,
      tag: `${each.count}건`,
      tone: 'idle' as const,
      width: 190,
    })),
    {
      id: 'phone',
      x: 880,
      y: 318,
      label: '고객 휴대폰',
      sub: 'SOLAPI',
      tone: smsTone === 'fail' ? 'warn' : 'idle',
      width: 190,
    },
  ]
  const edges: SignalEdge[] = [
    { from: 'form', to: 'fn', tone: 'accent', flow: has, weight: 2 },
    { from: 'fn', to: 'monday', tone: mondayTone, flow: has, weight: 2 },
    { from: 'fn', to: 'sms', tone: smsTone, flow: summary.smsOk > 0 },
    ...boards.map((each) => ({
      from: 'monday',
      to: `board:${each.device}`,
      tone: 'accent' as const,
      flow: true,
      weight: 1 + (each.count / max) * 3,
    })),
    {
      from: 'sms',
      to: 'phone',
      tone: smsTone,
      flow: summary.smsOk > 0,
    },
  ]

  return (
    <SignalGraph
      width={1000}
      height={356}
      nodes={nodes}
      edges={edges}
      label="문의 접수 흐름 — 웹 폼에서 Monday·문자까지"
    />
  )
}

// ── 사용 분석 ────────────────────────────────────────────────────────────

// 그림에 올리는 탭 수 — 많으면 선이 엉킨다.
const MAX_VIEWS = 8

/** 탭 이동 흐름 — 접속 → 처음 본 탭(왼쪽 부채꼴), 탭 → 탭(오른쪽 호). 탭은
 * 사용 시간이 많은 순으로 한 줄로 세우고(MAX_VIEWS개), 선 굵기는 횟수다. */
export const UsageFlow = ({
  byView,
  flows,
  entries,
  showApp,
}: {
  byView: ViewUsage[]
  flows: Transition[]
  entries: { app: UsageApp; view: string; count: number }[]
  showApp: boolean
}) => {
  const views = byView.slice(0, MAX_VIEWS)
  const key = (app: UsageApp, view: string) => `${app}|${view}`
  const shown = new Set(views.map((each) => key(each.app, each.view)))
  const rowY = (index: number) => 34 + index * 56
  const height = rowY(Math.max(0, views.length - 1)) + 34
  const nodes: SignalNode[] = [
    {
      id: 'entry',
      x: 100,
      y: height / 2,
      label: '접속',
      sub: `세션 ${entries.reduce((sum, each) => sum + each.count, 0)}회`,
      tone: 'accent',
      width: 150,
    },
    ...views.map((each, index) => ({
      id: key(each.app, each.view),
      x: 470,
      y: rowY(index),
      label: `${showApp ? `${each.app} · ` : ''}${viewLabel(each.app, each.view)}`,
      sub: `${formatSpan(each.visibleMs)} · ${(each.share * 100).toFixed(0)}%`,
      tag: `${each.visits}회`,
      tone: (index === 0 ? 'accent' : 'idle') as SignalTone,
      width: 250,
    })),
  ]
  const between = flows.filter(
    (flow) =>
      shown.has(key(flow.app, flow.from)) && shown.has(key(flow.app, flow.to)),
  )
  const firsts = entries.filter((entry) =>
    shown.has(key(entry.app, entry.view)),
  )
  const maxFirst = Math.max(1, ...firsts.map((entry) => entry.count))
  const maxFlow = Math.max(1, ...between.map((flow) => flow.count))
  const edges: SignalEdge[] = [
    ...firsts.map((entry) => ({
      from: 'entry',
      to: key(entry.app, entry.view),
      tone: 'accent' as const,
      flow: true,
      weight: 1 + (entry.count / maxFirst) * 3,
      label: `${entry.count}`,
    })),
    ...between.map((flow) => ({
      from: key(flow.app, flow.from),
      to: key(flow.app, flow.to),
      tone: (flow.count / maxFlow > 0.5 ? 'accent' : 'idle') as SignalTone,
      flow: flow.count / maxFlow > 0.25,
      weight: 1 + (flow.count / maxFlow) * 3,
      label: `${flow.count}`,
      route: 'arc' as const,
    })),
  ]

  return (
    <SignalGraph
      width={1000}
      height={height}
      nodes={nodes}
      edges={edges}
      label="탭 이동 흐름 — 접속에서 처음 본 탭, 탭에서 탭으로"
    />
  )
}
