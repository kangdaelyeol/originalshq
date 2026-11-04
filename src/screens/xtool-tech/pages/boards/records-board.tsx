import { useCallback } from 'react'
import {
  Assignees,
  BarList,
  GlassCard,
  RecordDrawer,
  RecordTable,
  StagePill,
  StatCard,
} from '../../components/layout-parts'
import type { RecordColumn } from '../../components/board/record-table'
import { countBy } from '@/ohq-ui/charts/chart-utils'
import { usePeriod } from '../../context/period-context'
import type { DocTaskRecord, TechBoardDoc } from '../../data/tech-boards'
import { byDateDesc, koreaToday, shortDate } from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'
import { recordsKpis } from './records-kpis'
import type { BoardDrawerProps } from './registry'

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
  const [selectedId, setSelectedId] = useItemParam()
  const close = useCallback(() => setSelectedId(null), [setSelectedId])

  const records = doc.records

  return (
    <>
      <div className="grid grid--kpi">
        {recordsKpis(doc, period, koreaToday()).map(({ key, ...card }) => (
          <StatCard key={key} {...card} />
        ))}
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

      <RecordsDrawer doc={doc} selectedId={selectedId} onClose={close} />
    </>
  )
}

/** 자료정리 상세 서랍 — 보드 화면과 내 업무(registry)가 같이 연다. eyebrow를 주면 보드 이름 대신 그것을 쓴다. */
export function RecordsDrawer({ doc, selectedId, onClose, eyebrow }: BoardDrawerProps<'records'>) {
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
    >
    </RecordDrawer>
  )
}
