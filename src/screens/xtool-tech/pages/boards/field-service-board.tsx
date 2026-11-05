import { useCallback } from 'react'
import {
  Assignees,
  BarList,
  DrawerList,
  GlassCard,
  PhoneLink,
  RecordDrawer,
  RecordTable,
  StagePill,
  StatCard,
  UpcomingList,
} from '../../components/layout-parts'
import { countBy } from '@/ohq-ui/charts/chart-utils'
import type { RecordColumn } from '../../components/board/record-table'
import { usePeriod } from '../../context/period-context'
import { PERIOD_COMPARE } from '../../data/period'
import type { FieldServiceRecord, TechBoardDoc } from '../../data/tech-boards'
import { formatPhone, isDone, splitNames } from '../../data/tech-stage'
import {
  byDateAsc,
  byDateDesc,
  inRange,
  koreaToday,
  periodRange,
  relativeDay,
  shortDate,
} from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'
import { doneOn, fieldServiceKpis, upcomingVisits } from './field-service-kpis'
import type { BoardDrawerProps } from './registry'

type R = FieldServiceRecord

const assigneesOf = (r: R) => splitNames(r.assignee)
const searchOf = (r: R) =>
  [r.name, r.phone, r.type, r.region, r.address, r.notes, r.assignee].join(' ')

const COLUMNS: RecordColumn<R>[] = [
  {
    key: 'name',
    header: '고객명',
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
  const upcoming = upcomingVisits(records, today)
  const received = records.filter((r) => inRange(r.receivedAt, current))

  return (
    <>
      <div className="grid grid--kpi">
        {fieldServiceKpis(doc, period, today).map(({ key, ...card }) => (
          <StatCard key={key} {...card} />
        ))}
      </div>

      <div className="board-body">
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

        <div className="grid grid--pair board-body__side">
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
      </div>

      <FieldServiceDrawer doc={doc} selectedId={selectedId} onClose={close} />
    </>
  )
}

/** 출장업무 상세 서랍 — 보드 화면과 내 업무(registry)가 같이 연다. eyebrow를 주면 보드 이름 대신 그것을 쓴다. */
export function FieldServiceDrawer({ doc, selectedId, onClose, eyebrow }: BoardDrawerProps<'fieldService'>) {
  const selected = doc.records.find((r) => r.itemId === selectedId) ?? null
  const items = selected && selected.items.length > 0 && (
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
  )
  return (
    <RecordDrawer
      record={selected}
      eyebrow={eyebrow ?? doc.name}
      onClose={onClose}
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
      {items}
    </RecordDrawer>
  )
}
