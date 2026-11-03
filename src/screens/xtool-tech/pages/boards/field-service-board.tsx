import { CalendarClock, CircleCheck, Inbox, Truck } from 'lucide-react'
import { useCallback } from 'react'
import { BarList } from '@/ohq-ui/charts/bar-list'
import { countBy } from '@/ohq-ui/charts/chart-utils'
import { RecordDrawer, DrawerList } from '../../components/board/record-drawer'
import {
  RecordTable,
  type RecordColumn,
} from '../../components/board/record-table'
import { Assignees, PhoneLink, StagePill } from '../../components/board/cells'
import { UpcomingList } from '../../components/board/upcoming-list'
import { GlassCard } from '@/ohq-ui/components/glass-card'
import { StatCard } from '@/ohq-ui/components/stat-card'
import { usePeriod } from '../../context/period-context'
import { PERIOD_COMPARE } from '../../data/period'
import type { FieldServiceRecord, TechBoardDoc } from '../../data/tech-boards'
import { formatPhone, isDone, isNew, splitNames } from '../../data/tech-stage'
import {
  byDateAsc,
  byDateDesc,
  inRange,
  isoToKoreaDate,
  koreaToday,
  periodRange,
  relativeDay,
  shortDate,
} from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'

type R = FieldServiceRecord

const assigneesOf = (r: R) => splitNames(r.assignee)
const searchOf = (r: R) =>
  [r.name, r.phone, r.type, r.region, r.address, r.notes, r.assignee].join(' ')
const doneOn = (r: R) => r.visitAt ?? isoToKoreaDate(r.updatedAt)

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
    key: 'type',
    header: '출장 종류',
    sortValue: (r) => r.type,
    cell: (r) => r.type ?? '—',
  },
  {
    key: 'region',
    header: '지역',
    sortValue: (r) => r.region,
    cell: (r) => r.region ?? '—',
  },
  {
    key: 'received',
    header: '접수일',
    sortValue: (r) => r.receivedAt,
    cell: (r) => shortDate(r.receivedAt),
    className: 'table__muted',
  },
  {
    key: 'visit',
    header: '방문 일정',
    sortValue: (r) => (r.visitAt ? `${r.visitAt} ${r.visitTime ?? ''}` : null),
    cell: (r) =>
      r.visitAt ? (
        <span className="cell-date">
          {shortDate(r.visitAt)}
          {r.visitTime && <span className="table__muted">{r.visitTime}</span>}
          {!isDone(r) && r.visitAt >= koreaToday() && (
            <small>{relativeDay(r.visitAt)}</small>
          )}
        </span>
      ) : (
        <span className="table__muted">미정</span>
      ),
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

/** 출장업무 — 방문 일정이 중심: 신규 → 일정 조율 → 일정 확정 → 완료. */
export function FieldServiceBoard({
  doc,
}: {
  doc: TechBoardDoc<'fieldService'>
}) {
  const { period } = usePeriod()
  const [selectedId, setSelectedId] = useItemParam()
  const close = useCallback(() => setSelectedId(null), [setSelectedId])
  const today = koreaToday()
  const { current } = periodRange(period, today)
  const names = PERIOD_COMPARE[period]

  const records = doc.records
  const open = records.filter((r) => !isDone(r))
  const upcoming = open
    .filter((r) => r.visitAt && r.visitAt >= today)
    .sort((a, b) => byDateAsc(a.visitAt, b.visitAt))
  const received = records.filter((r) => inRange(r.receivedAt, current))
  const doneInPeriod = records.filter(
    (r) => isDone(r) && inRange(doneOn(r), current),
  )
  const selected = records.find((r) => r.itemId === selectedId) ?? null

  return (
    <>
      <div className="grid grid--kpi">
        <StatCard
          title="신규 출장"
          value={`${open.filter(isNew).length}건`}
          icon={Inbox}
          tint="blue"
        />
        <StatCard
          title="일정 조율 중"
          value={`${open.filter((r) => /조율/.test(r.stage ?? '')).length}건`}
          icon={CalendarClock}
          tint="amber"
        />
        <StatCard
          title="방문 예정"
          value={`${upcoming.length}건`}
          icon={Truck}
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
        title="출장 목록"
        records={records}
        columns={COLUMNS}
        assigneesOf={assigneesOf}
        searchOf={searchOf}
        sortOpen={(a, b) =>
          byDateAsc(a.visitAt, b.visitAt) ||
          byDateAsc(a.receivedAt, b.receivedAt)
        }
        sortDone={(a, b) => byDateDesc(doneOn(a), doneOn(b))}
        onSelect={(r) => setSelectedId(r.itemId)}
        selectedId={selectedId}
        searchPlaceholder="고객·주소·비고 검색"
      />

      <div className="grid grid--pair">
        <GlassCard title="다가오는 방문" subtitle={`${upcoming.length}건`}>
          <UpcomingList
            today={today}
            empty="잡힌 방문 일정이 없어요."
            items={upcoming.slice(0, 6).map((r) => ({
              key: r.itemId,
              date: r.visitAt!,
              title: r.name || '(이름 없음)',
              meta: [
                r.visitTime,
                r.region,
                r.type,
                splitNames(r.assignee).join(', '),
              ]
                .filter(Boolean)
                .join(' · '),
              onSelect: () => setSelectedId(r.itemId),
            }))}
          />
        </GlassCard>
        <GlassCard
          title="지역별 접수"
          subtitle={`${names.current} ${received.length}건`}
        >
          <BarList
            items={countBy(received.map((r) => r.region))}
            ariaLabel="지역별 출장 접수"
            empty="이 기간에 접수된 출장이 없어요."
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
                { label: '출장 종류', value: selected.type },
                { label: '지역', value: selected.region },
                {
                  label: '방문 일정',
                  value: selected.visitAt
                    ? `${shortDate(selected.visitAt)}${selected.visitTime ? ` ${selected.visitTime}` : ''} (${relativeDay(selected.visitAt)})`
                    : '미정',
                },
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
                { label: '주소', value: selected.address },
              ]
            : []
        }
        texts={selected ? [{ label: '비고', text: selected.notes }] : []}
      >
        {selected && selected.items.length > 0 && (
          <DrawerList title={`설치 품목 ${selected.items.length}`}>
            {selected.items.map((item, i) => (
              <li key={i}>
                <span>{item.name}</span>
                <span className="drawer__list-meta">
                  {item.quantity !== null ? `${item.quantity}개` : ''}
                </span>
              </li>
            ))}
          </DrawerList>
        )}
      </RecordDrawer>
    </>
  )
}
