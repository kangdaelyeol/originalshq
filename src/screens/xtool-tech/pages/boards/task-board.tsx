import { CircleCheck, CircleDashed, ListTodo, OctagonAlert } from 'lucide-react'
import { useCallback } from 'react'
import { Assignees, StagePill } from '../../components/board/cells'
import { RecordDrawer } from '../../components/board/record-drawer'
import {
  RecordTable,
  type RecordColumn,
} from '../../components/board/record-table'
import { UpcomingList } from '../../components/board/upcoming-list'
import { BarList } from '@/ohq-ui/charts/bar-list'
import { countBy } from '@/ohq-ui/charts/chart-utils'
import { GlassCard } from '@/ohq-ui/components/glass-card'
import { StatCard } from '@/ohq-ui/components/stat-card'
import { usePeriod } from '../../context/period-context'
import { PERIOD_COMPARE } from '../../data/period'
import type { TaskRecord, TechBoardDoc } from '../../data/tech-boards'
import { isBlocked, isDone, isNew, splitNames } from '../../data/tech-stage'
import {
  byDateAsc,
  byDateDesc,
  inRange,
  isoToKoreaDate,
  koreaToday,
  periodRange,
  shortDate,
} from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'

type R = TaskRecord

const assigneesOf = (r: R) => splitNames(r.assignee)
const searchOf = (r: R) =>
  [r.name, r.requester, r.assignee, r.details].join(' ')
const doneOn = (r: R) => r.completedAt ?? isoToKoreaDate(r.updatedAt)

const COLUMNS: RecordColumn<R>[] = [
  {
    key: 'name',
    header: '업무',
    sortValue: (r) => r.name,
    cell: (r) => (
      <strong className="cell-title">{r.name || '(이름 없음)'}</strong>
    ),
    className: 'cell-wide',
  },
  {
    key: 'requester',
    header: '요청',
    sortValue: (r) => splitNames(r.requester)[0],
    cell: (r) => <Assignees names={splitNames(r.requester)} />,
  },
  {
    key: 'assignee',
    header: '담당자',
    sortValue: (r) => assigneesOf(r)[0],
    cell: (r) => <Assignees names={assigneesOf(r)} />,
  },
  {
    key: 'requested',
    header: '요청일',
    sortValue: (r) => r.requestedAt,
    cell: (r) => shortDate(r.requestedAt),
    className: 'table__muted',
  },
  {
    key: 'due',
    header: '마감일',
    sortValue: (r) => r.dueAt,
    cell: (r) =>
      r.dueAt ? (
        <span
          className={
            !isDone(r) && r.dueAt < koreaToday() ? 'cell-alert' : undefined
          }
        >
          {shortDate(r.dueAt)}
        </span>
      ) : (
        <span className="table__muted">—</span>
      ),
  },
  {
    key: 'stage',
    header: '단계',
    sortValue: (r) => r.stage,
    cell: (r) => <StagePill stage={r.stage} status={r.status} />,
  },
]

/** 기타업무 — 출장·AS·문의 밖의 일(샘플 테스트, 회수품 점검 등): 진행전 → 진행 중 → 막힘 → 완료. */
export function TaskBoard({ doc }: { doc: TechBoardDoc<'techTask'> }) {
  const { period } = usePeriod()
  const [selectedId, setSelectedId] = useItemParam()
  const close = useCallback(() => setSelectedId(null), [setSelectedId])
  const today = koreaToday()
  const { current } = periodRange(period, today)
  const names = PERIOD_COMPARE[period]

  const records = doc.records
  const open = records.filter((r) => !isDone(r))
  const blocked = open.filter(isBlocked)
  const working = open.filter((r) => !isNew(r) && !isBlocked(r))
  const doneInPeriod = records.filter(
    (r) => isDone(r) && inRange(doneOn(r), current),
  )
  // 마감일은 거의 안 적어서(45건 중 6건) 요청일이 오래된 순으로 챙긴다.
  const oldest = open
    .filter((r) => r.requestedAt)
    .sort((a, b) => byDateAsc(a.requestedAt, b.requestedAt))
  const selected = records.find((r) => r.itemId === selectedId) ?? null

  return (
    <>
      <div className="grid grid--kpi">
        <StatCard
          title="진행 전"
          value={`${open.filter(isNew).length}건`}
          icon={CircleDashed}
          tint="blue"
        />
        <StatCard
          title="진행 중"
          value={`${working.length}건`}
          icon={ListTodo}
          tint="amber"
        />
        <StatCard
          title="막힘"
          value={`${blocked.length}건`}
          icon={OctagonAlert}
          tint="violet"
        />
        <StatCard
          title={`${names.current} 완료`}
          value={`${doneInPeriod.length}건`}
          icon={CircleCheck}
          tint="green"
        />
      </div>

      <RecordTable
        title="업무 목록"
        records={records}
        columns={COLUMNS}
        assigneesOf={assigneesOf}
        searchOf={searchOf}
        sortOpen={(a, b) =>
          byDateAsc(a.dueAt, b.dueAt) || byDateAsc(a.requestedAt, b.requestedAt)
        }
        sortDone={(a, b) => byDateDesc(doneOn(a), doneOn(b))}
        onSelect={(r) => setSelectedId(r.itemId)}
        selectedId={selectedId}
        searchPlaceholder="업무·사람·상세내용 검색"
      />

      <div className="grid grid--pair">
        <GlassCard
          title="오래 걸리는 업무"
          subtitle={`${oldest.length}건`}
        >
          <UpcomingList
            mode="since"
            today={today}
            empty="진행 중인 업무가 없어요."
            items={oldest.slice(0, 6).map((r) => ({
              key: r.itemId,
              date: r.requestedAt!,
              title: r.name || '(이름 없음)',
              meta: [
                assigneesOf(r).join(', ') || '담당자 없음',
                r.dueAt ? `마감 ${shortDate(r.dueAt)}` : null,
              ]
                .filter(Boolean)
                .join(' · '),
              onSelect: () => setSelectedId(r.itemId),
            }))}
          />
        </GlassCard>
        <GlassCard
          title="담당자별 진행 중"
          subtitle={`진행 중 ${open.length}건`}
        >
          <BarList
            items={countBy(
              open.flatMap((r) =>
                assigneesOf(r).length ? assigneesOf(r) : [null],
              ),
              '담당자 없음',
            )}
            ariaLabel="담당자별 진행 중인 업무"
            empty="진행 중인 업무가 없어요."
          />
        </GlassCard>
      </div>

      <RecordDrawer
        record={selected}
        eyebrow={doc.name}
        onClose={close}
        fields={
          selected
            ? [
                {
                  label: '요청',
                  value: splitNames(selected.requester).join(', ') || null,
                },
                {
                  label: '담당자',
                  value: assigneesOf(selected).join(', ') || null,
                },
                {
                  label: '요청일',
                  value: selected.requestedAt
                    ? shortDate(selected.requestedAt)
                    : null,
                },
                {
                  label: '시작일',
                  value: selected.startedAt
                    ? shortDate(selected.startedAt)
                    : null,
                },
                {
                  label: '마감일',
                  value: selected.dueAt ? shortDate(selected.dueAt) : null,
                },
                {
                  label: '완료일',
                  value: selected.completedAt
                    ? shortDate(selected.completedAt)
                    : null,
                },
              ]
            : []
        }
        texts={selected ? [{ label: '상세내용', text: selected.details }] : []}
      />
    </>
  )
}
