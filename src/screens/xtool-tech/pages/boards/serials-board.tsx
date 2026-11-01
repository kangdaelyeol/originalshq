import { Barcode, Boxes, Link2, PackagePlus } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { MiniList } from '../../components/board/mini-list'
import { RecordDrawer } from '../../components/board/record-drawer'
import { RecordTable, type RecordColumn } from '../../components/board/record-table'
import { BarList } from '../../components/charts/bar-list'
import { countBy } from '../../components/charts/chart-utils'
import { GlassCard } from '../../components/ui/glass-card'
import { StatCard } from '../../components/ui/stat-card'
import { usePeriod } from '../../context/period-context'
import { PERIOD_COMPARE } from '../../data/period'
import type { SerialRecord, TechBoardDoc } from '../../data/tech-boards'
import { byDateDesc, inRange, koreaToday, periodRange, shortDate } from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'

type R = SerialRecord

// Monday 보드의 빈 템플릿 줄
const isTemplate = (r: R) => /^새로운\s*serial\s*number$/i.test(r.name.trim())
const linkCount = (r: R) => r.links.fieldService.length + r.links.repair.length + r.links.rental.length
const noAssignees = () => []
const searchOf = (r: R) =>
  [r.serialNumber, r.device, r.notes, ...r.links.fieldService, ...r.links.repair, ...r.links.rental].join(' ')

const linksText = (r: R) =>
  [
    r.links.fieldService.length && `출장 ${r.links.fieldService.length}`,
    r.links.repair.length && `AS ${r.links.repair.length}`,
    r.links.rental.length && `대여 ${r.links.rental.length}`,
  ]
    .filter(Boolean)
    .join(' · ')

const COLUMNS: RecordColumn<R>[] = [
  { key: 'name', header: 'SN', sortValue: (r) => r.serialNumber, cell: (r) => <strong className="table__mono">{r.serialNumber}</strong> },
  { key: 'device', header: '기기', sortValue: (r) => r.device, cell: (r) => r.device ?? '—' },
  { key: 'received', header: '입고일', sortValue: (r) => r.receivedAt, cell: (r) => shortDate(r.receivedAt), className: 'table__muted' },
  { key: 'links', header: '연결 기록', sortValue: (r) => linkCount(r), cell: (r) => linksText(r) || <span className="table__muted">—</span> },
  { key: 'notes', header: '비고', sortValue: (r) => r.notes, cell: (r) => <span className="cell-clip">{r.notes ?? '—'}</span>, className: 'cell-wide' },
]

/** 엑스툴 SN 관리 — 기기 시리얼 대장. 출장·AS·대여 기록과 이어져 기기 하나의 이력을 본다. */
export function SerialsBoard({ doc }: { doc: TechBoardDoc<'serials'> }) {
  const { period } = usePeriod()
  const [selectedId, setSelectedId] = useItemParam()
  const close = useCallback(() => setSelectedId(null), [setSelectedId])
  const { current } = periodRange(period, koreaToday())
  const names = PERIOD_COMPARE[period]

  const records = useMemo(() => doc.records.filter((r) => !isTemplate(r)), [doc.records])
  // 같은 SN이 둘 이상이면 중복 — 보드의 "중복 SN" 그룹도 함께 본다.
  const duplicates = useMemo(() => {
    const counts = countBy(records.map((r) => r.serialNumber))
    const repeated = new Set(counts.filter((c) => c.value > 1).map((c) => c.label))
    return records.filter((r) => repeated.has(r.serialNumber) || /중복/.test(r.stage ?? ''))
  }, [records])
  const selected = records.find((r) => r.itemId === selectedId) ?? null

  return (
    <>
      <div className="grid grid--kpi">
        <StatCard title="전체 SN" value={`${records.length}대`} icon={Barcode} tint="blue" />
        <StatCard title="기기 종류" value={`${new Set(records.map((r) => r.device).filter(Boolean)).size}종`} icon={Boxes} tint="violet" />
        <StatCard title={`${names.current} 입고`} value={`${records.filter((r) => inRange(r.receivedAt, current)).length}대`} icon={PackagePlus} tint="green" />
        <StatCard title="연결 기록 있음" value={`${records.filter((r) => linkCount(r) > 0).length}대`} icon={Link2} tint="amber" />
      </div>

      <div className="grid grid--pair">
        <GlassCard title="기기별 대수" subtitle={`전체 ${records.length}대`}>
          <BarList items={countBy(records.map((r) => r.device))} unit="대" ariaLabel="기기별 SN 수" />
        </GlassCard>
        <GlassCard title="중복 SN" subtitle={`${duplicates.length}건`}>
          <MiniList
            empty="중복된 SN이 없어요."
            items={duplicates.slice(0, 7).map((r) => ({
              key: r.itemId,
              title: r.serialNumber,
              meta: [r.device, r.notes].filter(Boolean).join(' · '),
              onSelect: () => setSelectedId(r.itemId),
            }))}
          />
        </GlassCard>
      </div>

      <RecordTable
        title="SN 목록"
        records={records}
        columns={COLUMNS}
        assigneesOf={noAssignees}
        searchOf={searchOf}
        progress={false}
        sortDone={(a, b) => byDateDesc(a.receivedAt, b.receivedAt)}
        onSelect={(r) => setSelectedId(r.itemId)}
        selectedId={selectedId}
        searchPlaceholder="SN·기기·고객 이름 검색"
      />

      <RecordDrawer
        record={selected}
        eyebrow={doc.name}
        onClose={close}
        fields={
          selected
            ? [
                { label: '기기', value: selected.device },
                { label: '입고일', value: selected.receivedAt ? shortDate(selected.receivedAt) : null },
                { label: '출장 기록', value: selected.links.fieldService.join(', ') || null },
                { label: 'AS 기록', value: selected.links.repair.join(', ') || null },
                { label: '대여품', value: selected.links.rental.join(', ') || null },
              ]
            : []
        }
        texts={selected ? [{ label: '비고', text: selected.notes }] : []}
      />
    </>
  )
}
