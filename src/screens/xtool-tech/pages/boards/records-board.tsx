import { CircleCheck, FileText, ListTodo, Timer } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Assignees, StagePill } from '../../components/board/cells'
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
import type { DocTaskRecord, TechBoardDoc } from '../../data/tech-boards'
import { isDone } from '../../data/tech-stage'
import {
  byDateDesc,
  daysBetween,
  inRange,
  koreaToday,
  periodRange,
  shortDate,
} from '../../lib/dates'

type R = DocTaskRecord

const assigneesOf = (r: R) => r.assignees
const searchOf = (r: R) => [r.name, ...r.assignees, r.details].join(' ')

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
    key: 'assignee',
    header: '담당자',
    sortValue: (r) => r.assignees[0],
    cell: (r) => <Assignees names={r.assignees} />,
  },
  {
    key: 'requested',
    header: '요청일',
    sortValue: (r) => r.requestedAt,
    cell: (r) => shortDate(r.requestedAt),
    className: 'table__muted',
  },
  {
    key: 'completed',
    header: '완료일',
    sortValue: (r) => r.completedAt,
    cell: (r) => shortDate(r.completedAt),
    className: 'table__muted',
  },
  {
    key: 'stage',
    header: '단계',
    sortValue: (r) => r.stage,
    cell: (r) => <StagePill stage={r.stage} status={r.status} />,
  },
]

/** 자료정리 — 매뉴얼·카테고리 정리 같은 문서 작업. 건수가 적어 목록 위주로. */
export function RecordsBoard({ doc }: { doc: TechBoardDoc<'records'> }) {
  const { period } = usePeriod()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const close = useCallback(() => setSelectedId(null), [])
  const { current } = periodRange(period, koreaToday())
  const names = PERIOD_COMPARE[period]

  const records = doc.records
  const open = records.filter((r) => !isDone(r))
  const done = records.filter(isDone)
  const spans = done
    .filter((r) => r.requestedAt && r.completedAt)
    .map((r) => daysBetween(r.requestedAt!, r.completedAt!))
  const avgDays = spans.length
    ? spans.reduce((sum, n) => sum + n, 0) / spans.length
    : null
  const selected = records.find((r) => r.itemId === selectedId) ?? null

  return (
    <>
      <div className="grid grid--kpi">
        <StatCard
          title="진행 중"
          value={`${open.length}건`}
          icon={ListTodo}
          tint="amber"
          caption="작업 중인 자료"
        />
        <StatCard
          title="완료"
          value={`${done.length}건`}
          icon={CircleCheck}
          tint="green"
          caption="전체 기간"
        />
        <StatCard
          title={`${names.current} 요청`}
          value={`${records.filter((r) => inRange(r.requestedAt, current)).length}건`}
          icon={FileText}
          tint="blue"
          caption={`같은 기간 완료 ${done.filter((r) => inRange(r.completedAt, current)).length}건`}
        />
        <StatCard
          title="평균 소요"
          value={avgDays !== null ? `${avgDays.toFixed(1)}일` : '—'}
          icon={Timer}
          tint="violet"
          caption="요청일 → 완료일"
        />
      </div>

      <div className="grid grid--main-side">
        <RecordTable
          title="자료 목록"
          records={records}
          columns={COLUMNS}
          assigneesOf={assigneesOf}
          searchOf={searchOf}
          sortDone={(a, b) => byDateDesc(a.completedAt, b.completedAt)}
          onSelect={(r) => setSelectedId(r.itemId)}
          selectedId={selectedId}
          searchPlaceholder="업무·담당자 검색"
        />
        <div className="side-stack">
          <GlassCard
            title="담당자별 업무"
            subtitle={`전체 ${records.length}건`}
          >
            <BarList
              items={countBy(
                records.flatMap((r) =>
                  r.assignees.length ? r.assignees : [null],
                ),
                '담당자 없음',
              )}
              ariaLabel="담당자별 자료정리 업무"
            />
          </GlassCard>
        </div>
      </div>

      <RecordDrawer
        record={selected}
        eyebrow={doc.name}
        onClose={close}
        fields={
          selected
            ? [
                {
                  label: '담당자',
                  value: selected.assignees.join(', ') || null,
                },
                {
                  label: '요청일',
                  value: selected.requestedAt
                    ? shortDate(selected.requestedAt)
                    : null,
                },
                {
                  label: '완료일',
                  value: selected.completedAt
                    ? shortDate(selected.completedAt)
                    : null,
                },
                {
                  label: '노션',
                  value: selected.notionUrl ? (
                    <a
                      href={selected.notionUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      문서 열기
                    </a>
                  ) : null,
                },
              ]
            : []
        }
        texts={selected ? [{ label: '상세내용', text: selected.details }] : []}
      />
    </>
  )
}
