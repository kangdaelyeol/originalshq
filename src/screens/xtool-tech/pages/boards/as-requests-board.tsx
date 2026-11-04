import { ClipboardPen, Inbox, Paperclip, SquareCheck } from 'lucide-react'
import { useCallback } from 'react'
import { BarList, GlassCard, PhoneLink, RecordDrawer, RecordTable, StatCard } from '../../components/layout-parts'
import type { RecordColumn } from '../../components/board/record-table'
import { countBy } from '@/ohq-ui/charts/chart-utils'
import { usePeriod } from '../../context/period-context'
import { PERIOD_COMPARE } from '../../data/period'
import type { AsRequestRecord, TechBoardDoc } from '../../data/tech-boards'
import { formatPhone } from '../../data/tech-stage'
import { byDateDesc, inRange, koreaToday, periodRange, shortDate } from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'

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
  const { current, previous } = periodRange(period, koreaToday())
  const names = PERIOD_COMPARE[period]

  const records = doc.records
  const received = records.filter((r) => inRange(r.receivedAt, current))
  const selected = records.find((r) => r.itemId === selectedId) ?? null

  return (
    <>
      <div className="grid grid--kpi">
        <StatCard title="전체 신청" value={`${records.length}건`} icon={ClipboardPen} tint="blue" caption="AS 신청서 보드 전체" />
        <StatCard
          title={`${names.current} 신청`}
          value={`${received.length}건`}
          icon={Inbox}
          tint="green"
          caption={`${names.previous} ${records.filter((r) => inRange(r.receivedAt, previous)).length}건`}
        />
        <StatCard title="확인사항 미체크" value={`${records.filter((r) => !r.agreed).length}건`} icon={SquareCheck} tint="amber" caption="신청자가 확인사항에 동의 안 함" />
        <StatCard title="첨부 있음" value={`${records.filter((r) => r.attachmentCount > 0).length}건`} icon={Paperclip} tint="violet" caption="사진·파일을 올린 신청" />
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

      <RecordDrawer
        record={selected}
        eyebrow={doc.name}
        onClose={close}
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
      />
    </>
  )
}
