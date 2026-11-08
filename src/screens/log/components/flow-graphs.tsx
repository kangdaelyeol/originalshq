import { useRef } from 'react'
import { INQUIRY_DEVICES } from '../client/inquiry-client'
import {
  COST_RESOURCES,
  formatCount,
  formatMs,
  formatUsd,
  type CostPart,
  type FnCost,
} from '../utils/api-cost'
import { MAX_FLOW_VIEWS as MAX_VIEWS, SCHEDULE_HOURS } from '../constants'
import {
  formatAgo,
  formatDateTime,
  nextScheduledAt,
  STATUS_LABEL,
  summarizeRun,
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
import { GRAPH_SCALE, useElementWidth } from './graph-size'
import {
  SignalGraph,
  type SignalColumn,
  type SignalEdge,
  type SignalNode,
  type SignalTone,
} from './signal-graph'

// 열 색 — 퍼셉트론 기둥 색(청록·분홍·보라·노랑) 순서.
const COL = {
  cyan: '#55d6e2',
  pink: '#ff5f8f',
  purple: '#9d8cff',
  yellow: '#f2cf5b',
} as const

// 열 이름 — 영상의 "TYPES / QUESTIONS"처럼 두 낱말.
const INQUIRY_COLUMNS: SignalColumn[] = [
  { x: 82, width: 140, label: 'FORM / IN', color: COL.cyan },
  { x: 262, width: 168, label: 'FUNCTION / API', color: COL.pink },
  { x: 466, width: 190, label: 'DELIVERY / SEND', color: COL.purple },
  { x: 771, width: 348, label: 'BOARDS / OUT', color: COL.yellow },
]
const USAGE_COLUMNS: SignalColumn[] = [
  { x: 100, width: 150, label: 'ENTRY / IN', color: COL.cyan },
  { x: 580, width: 620, label: 'TABS / VIEW', color: COL.pink },
]
const COST_COLUMNS: SignalColumn[] = [
  { x: 92, width: 150, label: 'TRIGGER / IN', color: COL.cyan },
  { x: 430, width: 250, label: 'FUNCTION / RUN', color: COL.pink },
  { x: 860, width: 200, label: 'RESOURCE / BILL', color: COL.purple },
]

// 작업 카드 격자 — 작업이 스무 개 가까워 한 줄로 쌓으면 그림이 너무 길어서,
// 줄 하나 카드(높이 62.5)를 여러 열로 놓는다. 고른 카드의 결과 띠가 아랫줄과
// 겹치지 않게 줄 간격을 넉넉히 둔다.
const JOB_CARD_W = 160
const JOB_PITCH = 166
const JOB_ROW_GAP = 80
const JOB_TOP = 50
const JOB_GRID_LEFT = 190
const STORE_W = 120
// 그림 틀이 좁아지면 줄이는 열 수 — 노드 크기는 그대로 두고 열을 줄인다. 열을
// 줄이기 전에 이만큼까지는 그림을 줄여 버틴다(조금 좁아졌다고 바로 줄이 늘지
// 않게).
const JOB_GRID_COLUMNS = [3, 2, 1] as const
const JOB_GRID_MIN_SCALE = 0.85

/** 작업 격자 열 수에 따른 배치 — 스케줄러 | 작업 격자 | 뒤따르는 작업 | 저장소.
 * 열 사이 기둥(spines)은 카드 사이 틈에 둔다. */
const batchLayout = (gridColumns: number) => {
  const gridX = Array.from(
    { length: gridColumns },
    (_, i) => JOB_GRID_LEFT + JOB_CARD_W / 2 + i * JOB_PITCH,
  )
  const gridEnd = JOB_GRID_LEFT + gridColumns * JOB_PITCH - 6
  const followSpine = gridEnd + 8
  const followX = followSpine + 8 + JOB_CARD_W / 2
  const storeSpine = followSpine + JOB_CARD_W + 8
  const storeX = storeSpine + 8 + STORE_W / 2
  const columns: SignalColumn[] = [
    { x: 80, width: 150, label: 'SCHEDULE / IN', color: COL.cyan },
    {
      x: (JOB_GRID_LEFT + gridEnd) / 2,
      width: gridEnd - JOB_GRID_LEFT,
      label: 'JOBS / RUN',
      color: COL.pink,
    },
    { x: followX, width: JOB_CARD_W, label: 'FOLLOW / UP', color: COL.purple },
    { x: storeX, width: STORE_W, label: 'STORE / OUT', color: COL.yellow },
  ]
  return {
    gridX,
    followX,
    storeX,
    width: storeX + STORE_W / 2 + 6,
    columns,
    spines: [172, followSpine, storeSpine],
  }
}
// 카드 사이 세로 간격 — 줄 하나 카드(62.5)에 맞춘다(사용 흐름).
const ROW_GAP = 70

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
  // 그림 틀 폭에 들어가는 가장 많은 열 — 노드 크기(GRAPH_SCALE)는 그대로라
  // 좁아지면 열을 줄여 겹치지 않게 한다. 재기 전에는 가장 넓게.
  const frameRef = useRef<HTMLDivElement>(null)
  const framePx = useElementWidth(frameRef)
  const layout = batchLayout(
    JOB_GRID_COLUMNS.find(
      (count) =>
        framePx === 0 ||
        batchLayout(count).width * GRAPH_SCALE * JOB_GRID_MIN_SCALE <= framePx,
    ) ?? 1,
  )
  const primary = jobs.filter((view) => !FOLLOWS[view.job.id])
  // 작업 자리 — 왼쪽에서 오른쪽, 위에서 아래로 3열.
  const placeOf = (index: number) => ({
    x: layout.gridX[index % layout.gridX.length],
    y: JOB_TOP + Math.floor(index / layout.gridX.length) * JOB_ROW_GAP,
  })
  const placeById = new Map(
    primary.map((view, index) => [view.job.id, placeOf(index)]),
  )
  const yById = new Map([...placeById].map(([id, place]) => [id, place.y]))
  const rowCount = Math.ceil(primary.length / layout.gridX.length)
  const height = JOB_TOP + Math.max(0, rowCount - 1) * JOB_ROW_GAP + JOB_TOP
  // 저장소는 그 저장소에 쓰는 작업들의 가운데 높이.
  const storeY = (codebase: string) => {
    const ys = primary
      .filter((view) => view.job.codebase === codebase)
      .map((view) => yById.get(view.job.id) ?? 0)
    return ys.length
      ? ys.reduce((sum, y) => sum + y, 0) / ys.length
      : height / 2
  }

  // 작업 카드 — 상태와 마지막 실행 한 줄(소요 등은 누르면 열리는 작업 상세에),
  // 켜지면(고른 작업·실패) 결과 요약 띠.
  const jobNode = (
    view: (typeof jobs)[number],
    x: number,
    y: number,
  ): SignalNode => {
    const tone = toneOf(view.latestStatus)
    return {
      id: view.job.id,
      x,
      y,
      // 저장소(xtool·cmip)는 오른쪽 선이 보여 줘서 이름 자리를 넓게 쓴다.
      label: view.job.label,
      rows: [
        {
          label: view.latestStatus
            ? STATUS_LABEL[view.latestStatus]
            : '기록 없음',
          value: view.latest ? formatAgo(view.latest.startedAt, now) : '-',
          tone,
        },
      ],
      result: view.latest ? summarizeRun(view.latest) : undefined,
      tone,
      width: JOB_CARD_W,
      active: jobFilter === view.job.id,
      onClick: () => onSelectJob(view.job.id),
    }
  }

  const nodes: SignalNode[] = [
    {
      id: 'scheduler',
      x: 80,
      y: height / 2,
      label: 'SCHEDULER',
      rows: [
        {
          label: '시각',
          value: SCHEDULE_HOURS.map((h) => String(h).padStart(2, '0')).join(
            '·',
          ),
        },
        {
          label: '다음',
          value: formatDateTime(nextScheduledAt(now)).slice(-8, -3),
          tone: 'accent',
        },
      ],
      tone: 'accent',
      width: 150,
    },
    ...primary.map((view) => {
      const place = placeById.get(view.job.id)
      return jobNode(view, place?.x ?? layout.gridX[0], place?.y ?? height / 2)
    }),
    ...jobs
      .filter((view) => FOLLOWS[view.job.id])
      .map((view) =>
        jobNode(
          view,
          layout.followX,
          yById.get(FOLLOWS[view.job.id]) ?? height / 2,
        ),
      ),
    {
      id: 'store:xtool',
      x: layout.storeX,
      y: storeY('xtool'),
      label: 'xtool DB',
      rows: [
        { label: '종류', value: 'Firestore' },
        { label: '내용', value: '고객·통계' },
      ],
      tone: 'idle',
      width: STORE_W,
    },
    {
      id: 'store:cmip',
      x: layout.storeX,
      y: storeY('cmip'),
      label: 'cmip DB',
      rows: [
        { label: '종류', value: 'Firestore' },
        { label: '내용', value: '채널 성과' },
      ],
      tone: 'idle',
      width: STORE_W,
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
        // 뒤따르는 작업으로 가는 선은 점선(FOLLOW / UP 열이 뜻을 말한다).
        dashed: from !== 'scheduler',
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
    <div ref={frameRef}>
      <SignalGraph
        width={layout.width}
        height={height}
        nodes={nodes}
        edges={edges}
        label="배치 파이프라인 — 스케줄러에서 작업, 저장소까지"
        columns={layout.columns}
        spines={layout.spines}
        focus={jobFilter === 'all' ? null : jobFilter}
      />
    </div>
  )
}

// ── 문의 접수 ────────────────────────────────────────────────────────────

/** 문의 접수 흐름 — 웹 폼 → 접수 함수 → Monday 보드(기기별, 들어온 보드 전부)·
 * 접수 안내 문자. */
export const InquiryFlow = ({
  summary,
  deviceCounts,
  selected,
  onSelect,
}: {
  summary: {
    total: number
    mondayOk: number
    mondayFailed: number
    smsOk: number
    smsFailed: number
  }
  deviceCounts: Map<string, number>
  /** 고른 노드 id — 그 노드와 이어진 것만 밝게. */
  selected: string | null
  onSelect: (nodeId: string) => void
}) => {
  const boards = INQUIRY_DEVICES.map((each) => ({
    ...each,
    count: deviceCounts.get(each.device) ?? 0,
  }))
    .filter((each) => each.count > 0)
    .sort((a, b) => b.count - a.count)
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
  // 보드는 들어온 것 전부를 2열로(많은 순으로 왼쪽·오른쪽 번갈아) — 이름과
  // 건수만 있는 낮은 카드(높이 40). 오른쪽 열은 반 줄 내려, 그쪽으로 가는 선이
  // 왼쪽 열 카드 사이 틈을 가로로 곧게 지나가게 한다(bus). 문자 줄은 그 아래.
  const ROW = 52
  const BOARD_W = 158
  const COLUMN_X = [676, 866]
  const boardPos = (index: number) => ({
    x: COLUMN_X[index % 2],
    y: 30 + Math.floor(index / 2) * ROW + (index % 2) * (ROW / 2),
  })
  const boardsBottom = boards.length > 0 ? boardPos(boards.length - 1).y : 110
  const mondayY = boards.length > 0 ? (30 + boardsBottom) / 2 : 110
  const smsY = boardsBottom + 84
  const height = smsY + 48
  const middleY = (mondayY + smsY) / 2
  // 오른쪽 열로 가는 선이 꺾는 곳 — 왼쪽 열 노드의 바로 앞.
  const turnX = COLUMN_X[0] - BOARD_W / 2 - 14

  const nodes: SignalNode[] = [
    {
      id: 'form',
      x: 82,
      y: middleY,
      label: '웹사이트 폼',
      rows: [{ label: '신청', value: `${summary.total}건` }],
      tone: 'accent',
      width: 140,
    },
    {
      id: 'fn',
      x: 262,
      y: middleY,
      label: 'submitInquiry',
      rows: [{ label: '위치', value: 'functions-xtool' }],
      tone: has ? 'ok' : 'idle',
      width: 168,
    },
    {
      id: 'monday',
      x: 466,
      y: mondayY,
      label: 'Monday 등록',
      rows: [
        { label: '등록', value: `${summary.mondayOk}건`, tone: 'ok' },
        {
          label: '미등록',
          value: `${summary.mondayFailed}건`,
          tone: summary.mondayFailed > 0 ? 'fail' : undefined,
        },
      ],
      result:
        summary.mondayFailed > 0
          ? `미등록 ${summary.mondayFailed}건 — 눌러서 확인`
          : `보드 ${boards.length}곳에 등록`,
      tone: mondayTone,
      width: 190,
    },
    {
      id: 'sms',
      x: 466,
      y: smsY,
      label: '접수 안내 문자',
      rows: [
        { label: '발송', value: `${summary.smsOk}건`, tone: 'ok' },
        {
          label: '실패',
          value: `${summary.smsFailed}건`,
          tone: summary.smsFailed > 0 ? 'fail' : undefined,
        },
      ],
      result:
        summary.smsFailed > 0
          ? `발송 실패 ${summary.smsFailed}건 — 눌러서 확인`
          : 'SOLAPI로 발송',
      tone: smsTone,
      width: 190,
    },
    ...boards.map((each, index) => ({
      id: `board:${each.device}`,
      ...boardPos(index),
      label: each.label,
      tag: `${each.count}건`,
      tone: 'idle' as const,
      width: BOARD_W,
    })),
    {
      id: 'phone',
      x: COLUMN_X[0],
      y: smsY,
      label: '고객 휴대폰',
      rows: [{ label: '경로', value: 'SOLAPI' }],
      tone: smsTone === 'fail' ? 'warn' : 'idle',
      width: BOARD_W,
    },
  ]
  // 노드마다 누르면 상세 패널(inquiry-node-panel.tsx).
  const clickable = nodes.map((node) => ({
    ...node,
    active: node.id === selected,
    onClick: () => onSelect(node.id),
  }))
  const edges: SignalEdge[] = [
    { from: 'form', to: 'fn', tone: 'accent', flow: has, weight: 2 },
    { from: 'fn', to: 'monday', tone: mondayTone, flow: has, weight: 2 },
    { from: 'fn', to: 'sms', tone: smsTone, flow: summary.smsOk > 0 },
    ...boards.map((each, index) => ({
      from: 'monday',
      to: `board:${each.device}`,
      tone: 'accent' as const,
      flow: true,
      weight: 1 + (each.count / max) * 3,
      // 오른쪽 열은 왼쪽 열 노드 사이 틈으로 가로질러 들어간다.
      ...(index % 2 === 1 ? { route: 'bus' as const, turnX } : {}),
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
      height={height}
      nodes={clickable}
      edges={edges}
      label="문의 접수 흐름 — 웹 폼에서 Monday·문자까지"
      columns={INQUIRY_COLUMNS}
      spines={[364, 579]}
      focus={selected}
    />
  )
}

// ── 사용 분석 ────────────────────────────────────────────────────────────

// 탭 격자 — 3열(사용 시간 순으로 왼쪽 위부터), 열 사이마다 기둥. 선은 기둥을
// 따라 세로로, 카드 줄 사이 틈을 따라 가로로 꺾어 간다(카드를 가로지르지 않게).
const TAB_COLS = [360, 580, 800]
const TAB_W = 180
const TAB_H = 87.5
const TAB_GAP = 112
const USAGE_SPINES = [250, 470, 690, 910]

type Rect = { x: number; y: number; w: number; h: number }

/** 탭 이동 흐름 — 접속 → 처음 본 탭, 탭 → 탭. 탭은 사용 시간이 많은 순으로
 * 3열 격자에 놓고(MAX_VIEWS개), 선 굵기는 횟수다. 처음 본 횟수는 카드 줄에,
 * 탭끼리 오간 횟수는 탭을 고르면 그 선 위에 나온다. */
export const UsageFlow = ({
  byView,
  flows,
  entries,
  showApp,
  selected,
  onSelect,
}: {
  byView: ViewUsage[]
  flows: Transition[]
  entries: { app: UsageApp; view: string; count: number }[]
  showApp: boolean
  /** 고른 노드 id('entry' 또는 'app|view'). */
  selected: string | null
  onSelect: (nodeId: string) => void
}) => {
  const views = byView.slice(0, MAX_VIEWS)
  const key = (app: UsageApp, view: string) => `${app}|${view}`
  const shown = new Set(views.map((each) => key(each.app, each.view)))
  const rowCount = Math.max(1, Math.ceil(views.length / TAB_COLS.length))
  const rowY = (row: number) => 56 + row * TAB_GAP
  const height = rowY(rowCount - 1) + 56
  const firstCount = new Map(
    entries.map((entry) => [key(entry.app, entry.view), entry.count]),
  )

  const nodes: SignalNode[] = [
    {
      id: 'entry',
      x: 100,
      y: height / 2,
      label: '접속',
      rows: [
        {
          label: '세션',
          value: `${entries.reduce((sum, each) => sum + each.count, 0)}회`,
        },
      ],
      tone: 'accent',
      width: 150,
      height: 62.5,
    },
    ...views.map((each, index) => {
      const first = firstCount.get(key(each.app, each.view)) ?? 0
      return {
        id: key(each.app, each.view),
        x: TAB_COLS[index % TAB_COLS.length],
        y: rowY(Math.floor(index / TAB_COLS.length)),
        label: viewLabel(each.app, each.view),
        tag: showApp ? each.app : undefined,
        rows: [
          {
            label: '사용',
            value: `${formatSpan(each.visibleMs)} · ${(each.share * 100).toFixed(0)}%`,
            tone: (index === 0 ? 'accent' : undefined) as
              SignalTone | undefined,
          },
          { label: '방문', value: `${each.visits}회 · ${each.visitors}명` },
          { label: '처음', value: first ? `${first}회` : '-' },
        ],
        result: `평균 ${formatSpan(each.averageMs)} 머묾`,
        tone: (index === 0 ? 'accent' : 'idle') as SignalTone,
        width: TAB_W,
        height: TAB_H,
      }
    }),
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
  const touches = (from: string, to: string) =>
    selected !== null && (from === selected || to === selected)
  const raw: SignalEdge[] = [
    ...firsts.map((entry) => ({
      from: 'entry',
      to: key(entry.app, entry.view),
      tone: 'accent' as const,
      flow: true,
      weight: 1 + (entry.count / maxFirst) * 3,
    })),
    ...between.map((flow) => {
      const from = key(flow.app, flow.from)
      const to = key(flow.app, flow.to)
      return {
        from,
        to,
        tone: (flow.count / maxFlow > 0.5 ? 'accent' : 'idle') as SignalTone,
        flow: flow.count / maxFlow > 0.25,
        weight: 1 + (flow.count / maxFlow) * 3,
        // 고른 탭의 선에만 횟수 — 상대 카드 옆에 붙인다.
        ...(touches(from, to)
          ? {
              label: `${flow.count}`,
              labelAt: to === selected ? ('start' as const) : ('end' as const),
            }
          : {}),
      }
    }),
  ]

  // 꺾은선 길 — 카드마다 들어오는 선은 왼쪽, 나가는 선은 오른쪽 가장자리에
  // 나눠 붙이고(상대 카드 높이 순), 기둥 → 줄 사이 틈 → 기둥 → 카드로 간다.
  // 선마다 몇 픽셀씩 비켜 세워 다발처럼 보이게. 점은 늘 여섯 개(넘어가기용).
  const rects = new Map<string, Rect>(
    nodes.map((node) => [
      node.id,
      { x: node.x, y: node.y, w: node.width!, h: node.height! },
    ]),
  )
  const ins = new Map<string, SignalEdge[]>()
  const outs = new Map<string, SignalEdge[]>()
  for (const edge of raw) {
    ins.set(edge.to, [...(ins.get(edge.to) ?? []), edge])
    outs.set(edge.from, [...(outs.get(edge.from) ?? []), edge])
  }
  const yOf = (id: string) => rects.get(id)?.y ?? 0
  for (const list of ins.values())
    list.sort((a, b) => yOf(a.from) - yOf(b.from))
  for (const list of outs.values()) list.sort((a, b) => yOf(a.to) - yOf(b.to))
  const port = (rect: Rect, list: SignalEdge[], edge: SignalEdge) => {
    const index = list.indexOf(edge)
    const step = Math.min(9, (rect.h - 26) / Math.max(1, list.length - 1))
    return rect.y + (index - (list.length - 1) / 2) * step
  }
  const gaps = Array.from(
    { length: rowCount + 1 },
    (_, row) => rowY(row) - TAB_GAP / 2,
  )
  const edges = raw.map((edge, index) => {
    const a = rects.get(edge.from)!
    const b = rects.get(edge.to)!
    const lane = ((index % 5) - 2) * 2
    const rightSpine = USAGE_SPINES.find((x) => x > a.x + a.w / 2)!
    const leftSpine = [...USAGE_SPINES]
      .reverse()
      .find((x) => x < b.x - b.w / 2)!
    const start = { x: a.x + a.w / 2, y: port(a, outs.get(edge.from)!, edge) }
    const end = { x: b.x - b.w / 2, y: port(b, ins.get(edge.to)!, edge) }
    const middle = (start.y + end.y) / 2
    const gapY =
      rightSpine === leftSpine
        ? end.y
        : gaps.reduce((best, y) =>
            Math.abs(y - middle) < Math.abs(best - middle) ? y : best,
          ) +
          lane * 1.2
    return {
      ...edge,
      via: [
        start,
        { x: rightSpine + lane, y: start.y },
        { x: rightSpine + lane, y: gapY },
        { x: leftSpine + lane, y: gapY },
        { x: leftSpine + lane, y: end.y },
        end,
      ],
    }
  })

  return (
    <SignalGraph
      width={1000}
      height={height}
      nodes={nodes.map((node) => ({
        ...node,
        active: node.id === selected,
        onClick: () => onSelect(node.id),
      }))}
      edges={edges}
      label="탭 이동 흐름 — 접속에서 처음 본 탭, 탭에서 탭으로"
      columns={USAGE_COLUMNS}
      spines={USAGE_SPINES}
      focus={selected}
    />
  )
}

// ── 비용 분석 ────────────────────────────────────────────────────────────

const TRIGGER_LABEL: Record<string, string> = {
  http: 'HTTP',
  callable: 'CALLABLE',
  schedule: 'SCHEDULE',
}

/** 비용 지도 — 호출 방식 → 함수(비싼 순 MAX_VIEWS개) → 자원. 선 굵기는 그
 * 함수가 그 자원에 쓴 금액. 노드를 누르면 오른쪽 상세 패널. */
export const CostFlow = ({
  fns,
  selected,
  onSelect,
}: {
  fns: FnCost[]
  selected: string | null
  onSelect: (nodeId: string) => void
}) => {
  const top = fns.slice(0, MAX_VIEWS)
  const rowY = (index: number, count: number, height: number) =>
    count === 1 ? height / 2 : 40 + (index * (height - 80)) / (count - 1)
  const height = Math.max(340, 40 + Math.max(0, top.length - 1) * ROW_GAP + 40)
  const triggers = [...new Set(top.map((each) => each.trigger))]
  const total = fns.reduce((sum, each) => sum + each.cost, 0)
  const partTotal = (part: CostPart) =>
    fns.reduce((sum, each) => sum + each.parts[part], 0)
  const maxPart = Math.max(
    1e-12,
    ...top.flatMap((each) => Object.values(each.parts)),
  )

  const nodes: SignalNode[] = [
    ...triggers.map((trigger, index) => ({
      id: `trigger:${trigger}`,
      x: 92,
      y: rowY(index, triggers.length, height),
      label: TRIGGER_LABEL[trigger] ?? trigger,
      rows: [
        {
          label: '함수',
          value: `${fns.filter((each) => each.trigger === trigger).length}개`,
        },
      ],
      tone: 'accent' as const,
      width: 150,
    })),
    ...top.map((each, index) => ({
      id: `fn:${each.fn}`,
      x: 430,
      y: rowY(index, top.length, height),
      label: each.fn,
      rows: [
        {
          label: '비용',
          value: `${formatUsd(each.cost)} · ${(each.share * 100).toFixed(1)}%`,
          tone: (index === 0 ? 'accent' : undefined) as SignalTone | undefined,
        },
      ],
      tag: `${formatCount(each.calls)}회`,
      result: `읽기 ${formatCount(each.reads)} · 평균 ${formatMs(each.avgMs)}`,
      tone: (index === 0 ? 'accent' : 'idle') as SignalTone,
      width: 250,
    })),
    ...COST_RESOURCES.map((resource, index) => {
      const cost = partTotal(resource.id)
      return {
        id: `res:${resource.id}`,
        x: 860,
        y: rowY(index, COST_RESOURCES.length, height),
        label: resource.label,
        rows: [
          {
            label: '비용',
            value: `${formatUsd(cost)} · ${total ? ((cost / total) * 100).toFixed(0) : 0}%`,
          },
        ],
        tone: 'idle' as const,
        width: 200,
      }
    }),
  ]
  const edges: SignalEdge[] = [
    ...top.map((each) => ({
      from: `trigger:${each.trigger}`,
      to: `fn:${each.fn}`,
      tone: 'accent' as const,
      flow: true,
      weight: 1 + each.share * 3,
    })),
    ...top.flatMap((each) =>
      COST_RESOURCES.filter((resource) => each.parts[resource.id] > 0).map(
        (resource) => {
          const ratio = each.parts[resource.id] / maxPart
          return {
            from: `fn:${each.fn}`,
            to: `res:${resource.id}`,
            tone: (ratio > 0.3 ? 'accent' : 'idle') as SignalTone,
            flow: ratio > 0.1,
            weight: 1 + ratio * 3,
          }
        },
      ),
    ),
  ]

  return (
    <SignalGraph
      width={1000}
      height={height}
      nodes={nodes.map((node) => ({
        ...node,
        active: node.id === selected,
        onClick: () => onSelect(node.id),
      }))}
      edges={edges}
      label="비용 지도 — 호출 방식에서 함수, 함수가 돈을 쓰는 자원까지"
      columns={COST_COLUMNS}
      spines={[236, 657]}
      focus={selected}
    />
  )
}
