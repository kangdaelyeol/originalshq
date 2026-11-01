import { CircleCheck, PackageOpen, Send, Wrench } from 'lucide-react'
import { useCallback } from 'react'
import { Assignees, PhoneLink, StagePill } from '../../components/board/cells'
import { DrawerList, RecordDrawer } from '../../components/board/record-drawer'
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
import type { RepairRecord, TechBoardDoc } from '../../data/tech-boards'
import { formatPhone, isDone, isNew, splitNames } from '../../data/tech-stage'
import {
  byDateAsc,
  byDateDesc,
  daysBetween,
  inRange,
  isoToKoreaDate,
  koreaToday,
  periodRange,
  shortDate,
} from '../../lib/dates'
import { formatInt } from '../../lib/format'
import { useItemParam } from '../../lib/use-item-param'

type R = RepairRecord

const assigneesOf = (r: R) => splitNames(r.assignee)
const searchOf = (r: R) =>
  [
    r.name,
    r.phone,
    r.device,
    r.serialNumber,
    r.symptom,
    r.result,
    r.assignee,
  ].join(' ')
const doneOn = (r: R) => r.completedAt ?? isoToKoreaDate(r.updatedAt)
const isShipping = (r: R) => /발송/.test(r.stage ?? '')

/** 접수부터 지금(완료면 완료일)까지 날 수 */
const ageOf = (r: R, today: string): number | null =>
  r.receivedAt
    ? daysBetween(r.receivedAt, isDone(r) ? (doneOn(r) ?? today) : today)
    : null

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
    sortValue: (r) => r.device,
    cell: (r) => r.device ?? '—',
  },
  {
    key: 'symptom',
    header: '증상',
    sortValue: (r) => r.symptom,
    cell: (r) => <span className="cell-clip">{r.symptom ?? '—'}</span>,
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
    key: 'age',
    header: '경과',
    sortValue: (r) => ageOf(r, koreaToday()),
    cell: (r) => {
      const age = ageOf(r, koreaToday())
      if (age === null) return <span className="table__muted">—</span>
      return isDone(r) ? (
        <span className="table__muted">{age}일 걸림</span>
      ) : (
        <span className={age >= 14 ? 'cell-alert' : undefined}>{age}일째</span>
      )
    },
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

/** AS — 기기를 받아 수리해 돌려보내기까지: 입고 대기 → 수리 중 → 발송 대기 → 완료. */
export function RepairBoard({ doc }: { doc: TechBoardDoc<'repair'> }) {
  const { period } = usePeriod()
  const [selectedId, setSelectedId] = useItemParam()
  const close = useCallback(() => setSelectedId(null), [setSelectedId])
  const today = koreaToday()
  const { current } = periodRange(period, today)
  const names = PERIOD_COMPARE[period]

  const records = doc.records
  const open = records.filter((r) => !isDone(r))
  const waiting = open.filter(isNew)
  const shipping = open.filter(isShipping)
  const repairing = open.filter((r) => !isNew(r) && !isShipping(r))
  const doneInPeriod = records.filter(
    (r) => isDone(r) && inRange(doneOn(r), current),
  )
  const received = records.filter((r) => inRange(r.receivedAt, current))
  const selected = records.find((r) => r.itemId === selectedId) ?? null

  const workload = countBy(
    open.flatMap((r) => (assigneesOf(r).length ? assigneesOf(r) : [null])),
    '담당자 없음',
  )

  return (
    <>
      <div className="grid grid--kpi">
        <StatCard
          title="입고 대기"
          value={`${waiting.length}건`}
          icon={PackageOpen}
          tint="blue"
        />
        <StatCard
          title="수리 중"
          value={`${repairing.length}건`}
          icon={Wrench}
          tint="amber"
        />
        <StatCard
          title="발송 대기"
          value={`${shipping.length}건`}
          icon={Send}
          tint="green"
        />
        <StatCard
          title={`${names.current} 완료`}
          value={`${doneInPeriod.length}건`}
          icon={CircleCheck}
          tint="violet"
        />
      </div>

      <RecordTable
        title="AS 목록"
        records={records}
        columns={COLUMNS}
        assigneesOf={assigneesOf}
        searchOf={searchOf}
        sortOpen={(a, b) => byDateAsc(a.receivedAt, b.receivedAt)}
        sortDone={(a, b) => byDateDesc(doneOn(a), doneOn(b))}
        onSelect={(r) => setSelectedId(r.itemId)}
        selectedId={selectedId}
        searchPlaceholder="고객·기기·증상·SN 검색"
      />

      <div className="grid grid--pair">
        <GlassCard
          title="기기별 접수"
          subtitle={`${names.current} ${received.length}건`}
        >
          <BarList
            items={countBy(received.map((r) => r.device))}
            ariaLabel="기기별 AS 접수"
            empty="이 기간에 접수된 AS가 없어요."
          />
        </GlassCard>
        <GlassCard
          title="담당자별 진행 중"
          subtitle={`진행 중 ${open.length}건`}
        >
          <BarList
            items={workload}
            ariaLabel="담당자별 진행 중인 AS"
            empty="진행 중인 AS가 없어요."
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
                { label: '기기', value: selected.device },
                { label: 'SN', value: selected.serialNumber },
                { label: '접수일', value: shortDate(selected.receivedAt) },
                {
                  label: '완료일',
                  value: selected.completedAt
                    ? shortDate(selected.completedAt)
                    : null,
                },
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
                { label: '주소', value: selected.address },
              ]
            : []
        }
        texts={
          selected
            ? [
                { label: '증상', text: selected.symptom },
                { label: '수리 내역(결과)', text: selected.result },
              ]
            : []
        }
      >
        {selected && selected.parts.length > 0 && (
          <DrawerList
            title={`청구 부품·공임 — 합계 ${formatInt(selected.amount)}원`}
          >
            {selected.parts.map((part, i) => (
              <li key={i}>
                <span>
                  {part.part ?? part.name}
                  {part.sku && <small> · {part.sku}</small>}
                </span>
                <span className="drawer__list-meta">
                  {part.quantity !== null ? `${part.quantity}개 · ` : ''}
                  {formatInt(part.total)}원
                </span>
              </li>
            ))}
          </DrawerList>
        )}
      </RecordDrawer>
    </>
  )
}
