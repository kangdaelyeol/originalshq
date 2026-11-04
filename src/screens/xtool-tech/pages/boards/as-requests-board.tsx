import { useCallback } from 'react'
import { BarList, GlassCard, PhoneLink, RecordDrawer, RecordTable, StatCard } from '../../components/layout-parts'
import type { RecordColumn } from '../../components/board/record-table'
import { countBy } from '@/ohq-ui/charts/chart-utils'
import { usePeriod } from '../../context/period-context'
import type { AsRequestRecord, TechBoardDoc } from '../../data/tech-boards'
import { formatPhone } from '../../data/tech-stage'
import { byDateDesc, koreaToday, shortDate } from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'
import { asRequestsKpis } from './as-requests-kpis'
import type { BoardDrawerProps } from './registry'

type R = AsRequestRecord

const noAssignees = () => []
const searchOf = (r: R) => [r.name, r.phone, r.device, r.model, r.symptom, r.address].join(' ')
const deviceOf = (r: R) => [r.device, r.model].filter((v) => v && v !== '기타').join(' · ') || r.device

const COLUMNS: RecordColumn<R>[] = [
  {
    key: 'name',
    header: '신청자',
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="cell-person">
        <strong>{r.name || '(이름 없음)'}</strong>
        <small>{formatPhone(r.phone) ?? '연락처 없음'}</small>
      </span>
    ),
  },
  { key: 'device', header: '기기', sortValue: (r) => deviceOf(r), cell: (r) => deviceOf(r) ?? '—' },
  {
    key: 'symptom',
    header: '증상',
    sortValue: (r) => r.symptom,
    cell: (r) => <span className="cell-clip">{r.symptom ?? '—'}</span>,
    className: 'cell-wide',
  },
  { key: 'channel', header: '구매 경로', sortValue: (r) => r.purchaseChannel, cell: (r) => r.purchaseChannel ?? '—' },
  { key: 'purchased', header: '구매일', sortValue: (r) => r.purchasedAt, cell: (r) => shortDate(r.purchasedAt), className: 'table__muted' },
  { key: 'received', header: '접수일', sortValue: (r) => r.receivedAt, cell: (r) => shortDate(r.receivedAt), className: 'table__muted' },
  {
    key: 'agreed',
    header: '확인',
    sortValue: (r) => (r.agreed ? 1 : 0),
    cell: (r) => (r.agreed ? <span className="cell-ok">확인함</span> : <span className="table__muted">—</span>),
  },
]

/** AS 신청서 — 고객이 직접 낸 AS 신청(양식). 새로 들어온 신청을 보고 처리한다. */
export function AsRequestsBoard({ doc }: { doc: TechBoardDoc<'asRequests'> }) {
  const { period } = usePeriod()
  const [selectedId, setSelectedId] = useItemParam()
  const close = useCallback(() => setSelectedId(null), [setSelectedId])

  const records = doc.records

  return (
    <>
      <div className="grid grid--kpi">
        {asRequestsKpis(doc, period, koreaToday()).map(({ key, ...card }) => (
          <StatCard key={key} {...card} />
        ))}
      </div>

      <RecordTable
        title="신청 목록"
        records={records}
        columns={COLUMNS}
        assigneesOf={noAssignees}
        searchOf={searchOf}
        progress={false}
        sortDone={(a, b) => byDateDesc(a.receivedAt, b.receivedAt)}
        onSelect={(r) => setSelectedId(r.itemId)}
        selectedId={selectedId}
        searchPlaceholder="신청자·기기·증상·주소 검색"
      />

      <div className="grid grid--pair">
        <GlassCard title="기기별 신청" subtitle={`전체 ${records.length}건`}>
          <BarList items={countBy(records.map((r) => r.device))} ariaLabel="기기별 AS 신청" />
        </GlassCard>
        <GlassCard title="구매 경로" subtitle={`전체 ${records.length}건`}>
          <BarList items={countBy(records.map((r) => r.purchaseChannel))} ariaLabel="구매 경로별 AS 신청" />
        </GlassCard>
      </div>

      <AsRequestsDrawer doc={doc} selectedId={selectedId} onClose={close} />
    </>
  )
}

/** AS 신청서 상세 서랍 — 보드 화면과 내 업무(registry)가 같이 연다. eyebrow를 주면 보드 이름 대신 그것을 쓴다. */
export function AsRequestsDrawer({ doc, selectedId, onClose, eyebrow }: BoardDrawerProps<'asRequests'>) {
  const selected = doc.records.find((r) => r.itemId === selectedId) ?? null
  return (
    <RecordDrawer
      record={selected}
      eyebrow={eyebrow ?? doc.name}
      onClose={onClose}
      fields={
        selected
          ? [
              { label: '기기', value: selected.device },
              { label: '기종', value: selected.model },
              { label: '구매일', value: selected.purchasedAt ? shortDate(selected.purchasedAt) : null },
              { label: '구매 경로', value: selected.purchaseChannel },
              { label: '접수일', value: selected.receivedAt ? shortDate(selected.receivedAt) : null },
              { label: '연락처', value: selected.phone ? <PhoneLink phone={selected.phone} /> : null },
              { label: '주소', value: selected.address },
              { label: '확인사항', value: selected.agreed ? '확인함' : '체크 안 함' },
            ]
          : []
      }
      texts={selected ? [{ label: '증상 설명', text: selected.symptom }] : []}
    >
    </RecordDrawer>
  )
}
