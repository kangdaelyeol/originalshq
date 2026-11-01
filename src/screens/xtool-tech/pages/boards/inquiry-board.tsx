import {
  CircleCheck,
  Hourglass,
  MessageCircle,
  MessagesSquare,
} from 'lucide-react'
import { useCallback } from 'react'
import { Assignees, PhoneLink, StagePill } from '../../components/board/cells'
import { RecordDrawer } from '../../components/board/record-drawer'
import {
  RecordTable,
  type RecordColumn,
} from '../../components/board/record-table'
import { BarList } from '../../components/charts/bar-list'
import { countBy } from '../../components/charts/chart-utils'
import { GlassCard } from '../../components/ui/glass-card'
import { StatCard } from '../../components/ui/stat-card'
import { usePeriod } from '../../context/period-context'
import { PERIOD_COMPARE } from '../../data/period'
import type { InquiryRecord, TechBoardDoc } from '../../data/tech-boards'
import { formatPhone, isDone, splitNames } from '../../data/tech-stage'
import {
  byDateAsc,
  byDateDesc,
  inRange,
  koreaToday,
  periodRange,
  shortDate,
} from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'

type R = InquiryRecord

const assigneesOf = (r: R) => splitNames(r.assignee)
const searchOf = (r: R) =>
  [
    r.name,
    r.phone,
    r.deviceSeries,
    r.device,
    r.type,
    r.content,
    r.resolution,
    r.assignee,
  ].join(' ')
/** 기기 — 계열(F 시리즈)과 고객이 적은 이름, "기타"는 뺀다. */
const deviceOf = (r: R) =>
  [r.deviceSeries, r.device].filter((v) => v && v !== '기타').join(' · ') ||
  null
const isWaiting = (r: R) => /신규|1차/.test(r.stage ?? '')
const isLong = (r: R) => /장기/.test(r.stage ?? '')

const COLUMNS: RecordColumn<R>[] = [
  {
    key: 'name',
    header: '고객',
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="cell-person">
        <strong>{r.name || '(이름 없음)'}</strong>
        <small>{formatPhone(r.phone) ?? '연락처 없음'}</small>
      </span>
    ),
  },
  {
    key: 'device',
    header: '기기',
    sortValue: (r) => deviceOf(r),
    cell: (r) => deviceOf(r) ?? '—',
  },
  {
    key: 'type',
    header: '문의 종류',
    sortValue: (r) => r.type,
    cell: (r) => r.type ?? '—',
  },
  {
    key: 'content',
    header: '문의 내용',
    sortValue: (r) => r.content,
    cell: (r) => <span className="cell-clip">{r.content ?? '—'}</span>,
    className: 'cell-wide',
  },
  {
    key: 'received',
    header: '접수일',
    sortValue: (r) => r.receivedAt,
    cell: (r) => shortDate(r.receivedAt),
    className: 'table__muted',
  },
  {
    key: 'assignee',
    header: '담당자',
    sortValue: (r) => assigneesOf(r)[0],
    cell: (r) => <Assignees names={assigneesOf(r)} />,
  },
  {
    key: 'stage',
    header: '단계',
    sortValue: (r) => r.stage,
    cell: (r) => <StagePill stage={r.stage} status={r.status} />,
  },
]

/** 아톡문의 — 카카오톡 상담: 신규 접수 → 1차 안내 → 상담 진행중 → 장기 상담 → 완료. */
export function InquiryBoard({ doc }: { doc: TechBoardDoc<'techInquiry'> }) {
  const { period } = usePeriod()
  const [selectedId, setSelectedId] = useItemParam()
  const close = useCallback(() => setSelectedId(null), [setSelectedId])
  const { current } = periodRange(period, koreaToday())
  const names = PERIOD_COMPARE[period]

  const records = doc.records
  const open = records.filter((r) => !isDone(r))
  const received = records.filter((r) => inRange(r.receivedAt, current))
  const selected = records.find((r) => r.itemId === selectedId) ?? null

  return (
    <>
      <div className="grid grid--kpi">
        <StatCard
          title="응대 대기"
          value={`${open.filter(isWaiting).length}건`}
          icon={MessageCircle}
          tint="blue"
        />
        <StatCard
          title="상담 진행 중"
          value={`${open.filter((r) => !isWaiting(r) && !isLong(r)).length}건`}
          icon={MessagesSquare}
          tint="amber"
        />
        <StatCard
          title="장기 상담"
          value={`${open.filter(isLong).length}건`}
          icon={Hourglass}
          tint="violet"
        />
        <StatCard
          title={`${names.current} 접수`}
          value={`${received.length}건`}
          icon={CircleCheck}
          tint="green"
        />
      </div>

      <div className="grid grid--pair">
        <GlassCard
          title="문의 종류"
          subtitle={`${names.current} ${received.length}건`}
        >
          <BarList
            items={countBy(received.map((r) => r.type))}
            ariaLabel="문의 종류별 접수"
            empty="이 기간에 접수된 문의가 없어요."
          />
        </GlassCard>
        <GlassCard
          title="기기 계열"
          subtitle={`${names.current} ${received.length}건`}
        >
          <BarList
            items={countBy(received.map((r) => r.deviceSeries))}
            ariaLabel="기기 계열별 접수"
            empty="이 기간에 접수된 문의가 없어요."
          />
        </GlassCard>
      </div>

      <RecordTable
        title="문의 목록"
        records={records}
        columns={COLUMNS}
        assigneesOf={assigneesOf}
        searchOf={searchOf}
        sortOpen={(a, b) => byDateAsc(a.receivedAt, b.receivedAt)}
        sortDone={(a, b) => byDateDesc(a.receivedAt, b.receivedAt)}
        onSelect={(r) => setSelectedId(r.itemId)}
        selectedId={selectedId}
        searchPlaceholder="고객·기기·문의 내용 검색"
      />

      <RecordDrawer
        record={selected}
        eyebrow={doc.name}
        onClose={close}
        fields={
          selected
            ? [
                { label: '기기', value: deviceOf(selected) },
                { label: '문의 종류', value: selected.type },
                { label: '접수일', value: shortDate(selected.receivedAt) },
                {
                  label: '담당자',
                  value: assigneesOf(selected).join(', ') || null,
                },
                {
                  label: '연락처',
                  value: selected.phone ? (
                    <PhoneLink phone={selected.phone} />
                  ) : null,
                },
              ]
            : []
        }
        texts={
          selected
            ? [
                { label: '문의 내용', text: selected.content },
                { label: '해결 방안', text: selected.resolution },
              ]
            : []
        }
      />
    </>
  )
}
