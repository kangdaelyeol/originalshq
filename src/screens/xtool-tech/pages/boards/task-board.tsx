import { useCallback } from 'react'
import {
  Assignees,
  BarList,
  GlassCard,
  RecordDrawer,
  RecordTable,
  StagePill,
  StatCard,
  UpcomingList,
} from '../../components/layout-parts'
import type { RecordColumn } from '../../components/board/record-table'
import { countBy } from '@/ohq-ui/charts/chart-utils'
import { usePeriod } from '../../context/period-context'
import type { TaskRecord, TechBoardDoc } from '../../data/tech-boards'
import { isDone, splitNames } from '../../data/tech-stage'
import { byDateAsc, byDateDesc, koreaToday, shortDate } from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'
import type { BoardDrawerProps } from './registry'
import { doneOn, taskKpis } from './task-kpis'

type R = TaskRecord

const assigneesOf = (r: R) => splitNames(r.assignee)
const searchOf = (r: R) =>
  [r.name, r.requester, r.assignee, r.details].join(' ')

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

  const records = doc.records
  const open = records.filter((r) => !isDone(r))
  // 마감일은 거의 안 적어서(45건 중 6건) 요청일이 오래된 순으로 챙긴다.
  const oldest = open
    .filter((r) => r.requestedAt)
    .sort((a, b) => byDateAsc(a.requestedAt, b.requestedAt))

  return (
    <>
      <div className="grid grid--kpi">
        {taskKpis(doc, period, today).map(({ key, ...card }) => (
          <StatCard key={key} {...card} />
        ))}
      </div>

      <div className="board-body">
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

        <div className="grid grid--pair board-body__side">
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
      </div>

      <TaskDrawer doc={doc} selectedId={selectedId} onClose={close} />
    </>
  )
}

/** 기타업무 상세 서랍 — 보드 화면과 내 업무(registry)가 같이 연다. eyebrow를 주면 보드 이름 대신 그것을 쓴다. */
export function TaskDrawer({ doc, selectedId, onClose, eyebrow }: BoardDrawerProps<'techTask'>) {
  const selected = doc.records.find((r) => r.itemId === selectedId) ?? null
  return (
    <RecordDrawer
      record={selected}
      eyebrow={eyebrow ?? doc.name}
      onClose={onClose}
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
    >
    </RecordDrawer>
  )
}
