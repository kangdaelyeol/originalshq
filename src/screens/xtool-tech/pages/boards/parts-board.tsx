import { useCallback } from 'react'
import { BarList, GlassCard, MiniList, RecordDrawer, RecordTable, StatCard } from '../../components/layout-parts'
import type { RecordColumn } from '../../components/board/record-table'
import { countBy } from '@/ohq-ui/charts/chart-utils'
import type { PartRecord, TechBoardDoc } from '@xtool-core/tech-boards'
import { formatInt } from '@/ohq-ui/lib/format'
import { useItemParam } from '../../lib/use-item-param'
import { isLow, isOut, partsKpis } from './parts-kpis'
import type { BoardDrawerProps } from './registry'

type R = PartRecord

const noAssignees = () => []
const searchOf = (r: R) => [r.name, r.nameEn, r.sku, r.category, r.notes, r.usage].join(' ')
/** 분류는 여러 기종이 쉼표로 — 첫 기종으로 묶는다. */
const firstCategory = (r: R) => r.category?.split(',')[0]?.trim() || null

const COLUMNS: RecordColumn<R>[] = [
  {
    key: 'name',
    header: '부품',
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="cell-person">
        <strong>{r.name || '(이름 없음)'}</strong>
        <small>{r.nameEn ?? '영문명 없음'}</small>
      </span>
    ),
    className: 'cell-wide',
  },
  { key: 'sku', header: 'SKU', sortValue: (r) => r.sku, cell: (r) => <span className="table__mono">{r.sku ?? '—'}</span> },
  { key: 'category', header: '분류', sortValue: (r) => r.category, cell: (r) => r.category ?? '—' },
  {
    key: 'stock',
    header: '재고',
    sortValue: (r) => r.stock,
    cell: (r) =>
      r.stock === null ? <span className="table__muted">—</span> : <span className={isOut(r) ? 'cell-alert' : isLow(r) ? 'cell-warn' : undefined}>{formatInt(r.stock)}</span>,
  },
  { key: 'cost', header: '부품 비용', sortValue: (r) => r.cost, cell: (r) => (r.cost === null ? <span className="table__muted">—</span> : `${formatInt(r.cost)}원`) },
  { key: 'usd', header: 'A/S가(USD)', sortValue: (r) => r.priceUsd, cell: (r) => (r.priceUsd === null ? <span className="table__muted">—</span> : `$${r.priceUsd}`) },
]

/** 부품 마스터 — 부품 목록과 재고. AS 청구 부품도 여기서 고른다. */
export function PartsBoard({ doc }: { doc: TechBoardDoc<'parts'> }) {
  const [selectedId, setSelectedId] = useItemParam()
  const close = useCallback(() => setSelectedId(null), [setSelectedId])
  const records = doc.records
  const out = records.filter(isOut)
  const low = records.filter(isLow)
  const shortage = [...out, ...low].sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))

  return (
    <>
      <div className="grid grid--kpi">
        {partsKpis(doc).map(({ key, ...card }) => (
          <StatCard key={key} {...card} />
        ))}
      </div>

      <div className="board-body">
        <RecordTable
          title="부품 목록"
          records={records}
          columns={COLUMNS}
          assigneesOf={noAssignees}
          searchOf={searchOf}
          progress={false}
          onSelect={(r) => setSelectedId(r.itemId)}
          selectedId={selectedId}
          searchPlaceholder="부품명·영문명·SKU·분류 검색"
        />

        <div className="grid grid--pair board-body__side">
          <GlassCard title="재고 부족" subtitle={`${out.length + low.length}개`}>
            <MiniList
              empty="재고가 부족한 부품이 없어요."
              items={shortage.slice(0, 7).map((r) => ({
                key: r.itemId,
                title: r.name,
                meta: [r.sku, r.category].filter(Boolean).join(' · '),
                value: `재고 ${r.stock}`,
                alert: isOut(r),
                onSelect: () => setSelectedId(r.itemId),
              }))}
            />
          </GlassCard>
          <GlassCard title="분류별 부품" subtitle={`전체 ${records.length}개`}>
            <BarList items={countBy(records.map(firstCategory))} unit="개" ariaLabel="분류별 부품 수" />
          </GlassCard>
        </div>
      </div>

      <PartsDrawer doc={doc} selectedId={selectedId} onClose={close} />
    </>
  )
}

/** 부품 마스터 상세 서랍 — 보드 화면과 내 업무(registry)가 같이 연다. eyebrow를 주면 보드 이름 대신 그것을 쓴다. */
export function PartsDrawer({ doc, selectedId, onClose, eyebrow }: BoardDrawerProps<'parts'>) {
  const selected = doc.records.find((r) => r.itemId === selectedId) ?? null
  return (
    <RecordDrawer
      record={selected}
      eyebrow={eyebrow ?? doc.name}
      onClose={onClose}
      fields={
        selected
          ? [
              { label: '영문명', value: selected.nameEn },
              { label: 'SKU', value: selected.sku },
              { label: '분류', value: selected.category },
              { label: '재고', value: selected.stock === null ? null : formatInt(selected.stock) },
              { label: '부품 비용', value: selected.cost === null ? null : `${formatInt(selected.cost)}원` },
              { label: 'A/S가(USD)', value: selected.priceUsd === null ? null : `$${selected.priceUsd}` },
              { label: '재고 위치', value: selected.location },
              {
                label: '교체 영상',
                value: selected.videoUrl ? (
                  <a href={selected.videoUrl} target="_blank" rel="noreferrer">
                    영상 열기
                  </a>
                ) : null,
              },
            ]
          : []
      }
      texts={
        selected
          ? [
              { label: '사용내역', text: selected.usage },
              { label: '특이사항', text: selected.notes },
            ]
          : []
      }
    >
    </RecordDrawer>
  )
}
