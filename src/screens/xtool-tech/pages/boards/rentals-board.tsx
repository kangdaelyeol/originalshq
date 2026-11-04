import { useCallback } from 'react'
import { Assignees, BarList, GlassCard, PhoneLink, RecordDrawer, RecordTable, StatCard, StatusPill, UpcomingList } from '../../components/layout-parts'
import type { RecordColumn } from '../../components/board/record-table'
import { countBy } from '@/ohq-ui/charts/chart-utils'
import type { RentalRecord, TechBoardDoc } from '../../data/tech-boards'
import { formatPhone } from '../../data/tech-stage'
import { byDateAsc, koreaToday, shortDate } from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'
import type { BoardDrawerProps } from './registry'
import { PHASE, phaseOf, rentalsKpis } from './rentals-kpis'

type R = RentalRecord

const assigneesOf = (r: R) => r.assignees
const searchOf = (r: R) => [r.name, r.serialNumber, r.renter, r.renterPhone, ...r.assignees].join(' ')

const COLUMNS: RecordColumn<R>[] = [
  { key: 'name', header: '기기', sortValue: (r) => r.name, cell: (r) => <strong className="cell-title">{r.name || '(이름 없음)'}</strong> },
  { key: 'sn', header: 'SN', sortValue: (r) => r.serialNumber, cell: (r) => <span className="table__mono">{r.serialNumber ?? '—'}</span> },
  {
    key: 'renter',
    header: '대여자',
    sortValue: (r) => r.renter,
    cell: (r) =>
      r.renter ? (
        <span className="cell-person">
          <strong>{r.renter}</strong>
          <small>{formatPhone(r.renterPhone) ?? '연락처 없음'}</small>
        </span>
      ) : (
        <span className="table__muted">—</span>
      ),
  },
  { key: 'rented', header: '대여일', sortValue: (r) => r.rentedAt, cell: (r) => shortDate(r.rentedAt), className: 'table__muted' },
  { key: 'returned', header: '회수일', sortValue: (r) => r.returnedAt, cell: (r) => shortDate(r.returnedAt), className: 'table__muted' },
  { key: 'assignee', header: '담당자', sortValue: (r) => r.assignees[0], cell: (r) => <Assignees names={r.assignees} /> },
  {
    key: 'stage',
    header: '상태',
    sortValue: (r) => r.stage,
    cell: (r) => (
      <StatusPill tone={PHASE[phaseOf(r)].tone} dot>
        {r.status ?? PHASE[phaseOf(r)].label}
      </StatusPill>
    ),
  },
]

/** 대여품 관리 — 대여 기기가 지금 어디 있는지: 대여 가능 → 대여 중 → 회수 후 점검(→ 불량). */
export function RentalsBoard({ doc }: { doc: TechBoardDoc<'rentals'> }) {
  const [selectedId, setSelectedId] = useItemParam()
  const close = useCallback(() => setSelectedId(null), [setSelectedId])
  const today = koreaToday()
  const records = doc.records
  const rented = records.filter((r) => phaseOf(r) === 'rented' && r.rentedAt).sort((a, b) => byDateAsc(a.rentedAt, b.rentedAt))

  return (
    <>
      <div className="grid grid--kpi">
        {rentalsKpis(doc).map(({ key, ...card }) => (
          <StatCard key={key} {...card} />
        ))}
      </div>

      <RecordTable
        title="대여품 목록"
        records={records}
        columns={COLUMNS}
        assigneesOf={assigneesOf}
        searchOf={searchOf}
        progress={false}
        onSelect={(r) => setSelectedId(r.itemId)}
        selectedId={selectedId}
        searchPlaceholder="기기·SN·대여자 검색"
      />

      <div className="grid grid--pair">
        <GlassCard title="오래 나가 있는 대여품" subtitle={`${rented.length}대`}>
          <UpcomingList
            mode="since"
            today={today}
            empty="대여 중인 기기가 없어요."
            items={rented.slice(0, 6).map((r) => ({
              key: r.itemId,
              date: r.rentedAt!,
              title: r.name || '(이름 없음)',
              meta: [r.renter, r.serialNumber].filter(Boolean).join(' · '),
              onSelect: () => setSelectedId(r.itemId),
            }))}
          />
        </GlassCard>
        <GlassCard title="기기별 대여품" subtitle={`전체 ${records.length}대`}>
          <BarList items={countBy(records.map((r) => r.name))} unit="대" ariaLabel="기기별 대여품 수" />
        </GlassCard>
      </div>

      <RentalsDrawer doc={doc} selectedId={selectedId} onClose={close} />
    </>
  )
}

/** 대여품 상세 서랍 — 보드 화면과 내 업무(registry)가 같이 연다. eyebrow를 주면 보드 이름 대신 그것을 쓴다. */
export function RentalsDrawer({ doc, selectedId, onClose, eyebrow }: BoardDrawerProps<'rentals'>) {
  const selected = doc.records.find((r) => r.itemId === selectedId) ?? null
  return (
    <RecordDrawer
      record={selected}
      eyebrow={eyebrow ?? doc.name}
      onClose={onClose}
      fields={
        selected
          ? [
              { label: 'SN', value: selected.serialNumber },
              { label: '상태', value: selected.status },
              { label: '담당자', value: selected.assignees.join(', ') || null },
              { label: '대여자', value: selected.renter },
              { label: '연락처', value: selected.renterPhone ? <PhoneLink phone={selected.renterPhone} /> : null },
              { label: '대여일', value: selected.rentedAt ? shortDate(selected.rentedAt) : null },
              { label: '발송 예정일', value: selected.shipAt ? shortDate(selected.shipAt) : null },
              { label: '회수일', value: selected.returnedAt ? shortDate(selected.returnedAt) : null },
            ]
          : []
      }
    >
    </RecordDrawer>
  )
}
