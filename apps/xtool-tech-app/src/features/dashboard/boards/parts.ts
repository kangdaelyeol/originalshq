import { isLow, isOut } from '@xtool-core/board-kpis/parts';
import { countBy, formatInt } from '../part-data';
import type { BoardRecord, DashboardBoardDef } from './types';
import { nameOf, pieces } from './util';

// 부품 마스터 — 부품 목록과 재고. AS 청구 부품도 여기서 고른다(웹 parts-board.tsx).

type R = BoardRecord<'parts'>;

const noAssignees = (): string[] => [];
const searchOf = (r: R) => [r.name, r.nameEn, r.sku, r.category, r.notes, r.usage].join(' ');
/** 분류는 여러 기종이 쉼표로 — 첫 기종으로 묶는다 */
const firstCategory = (r: R) => r.category?.split(',')[0]?.trim() || null;

export const partsDef: DashboardBoardDef<'parts'> = {
  key: 'parts',
  listTitle: '부품 목록',
  searchPlaceholder: '부품명·영문명·SKU·분류 검색',
  progress: false,
  records: doc => doc.records,
  assigneesOf: noAssignees,
  searchOf,
  columns: [
    { key: 'name', header: '부품', sortValue: r => r.name },
    { key: 'sku', header: 'SKU', sortValue: r => r.sku },
    { key: 'category', header: '분류', sortValue: r => r.category },
    { key: 'stock', header: '재고', sortValue: r => r.stock },
    { key: 'cost', header: '부품 비용', sortValue: r => r.cost },
    { key: 'usd', header: 'A/S가(USD)', sortValue: r => r.priceUsd },
  ],
  row: r => ({
    id: r.itemId,
    title: nameOf(r.name),
    subtitle: r.nameEn ?? '영문명 없음',
    // 재고 없음은 위험, 부족은 주의(웹 cell-alert·cell-warn)
    pill: isOut(r) ? { label: '재고 없음', tone: 'crit' } : isLow(r) ? { label: '재고 부족', tone: 'warn' } : null,
    meta: pieces(
      r.sku,
      r.category,
      r.cost === null ? null : `${formatInt(r.cost)}원`,
      r.priceUsd === null ? null : `$${r.priceUsd}`,
    ),
    value: r.stock === null ? null : { text: `재고 ${formatInt(r.stock)}`, alert: isOut(r) },
  }),
  side: (_doc, records, { open }) => {
    const out = records.filter(isOut);
    const low = records.filter(isLow);
    const shortage = [...out, ...low].sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
    return [
      {
        key: 'shortage',
        title: '재고 부족',
        subtitle: `${out.length + low.length}개`,
        body: {
          kind: 'mini',
          empty: '재고가 부족한 부품이 없어요.',
          items: shortage.slice(0, 7).map(r => ({
            key: r.itemId,
            title: r.name,
            meta: pieces(r.sku, r.category).join(' · '),
            value: `재고 ${r.stock}`,
            alert: isOut(r),
            onPress: () => open(r.itemId),
          })),
        },
      },
      {
        key: 'category',
        title: '분류별 부품',
        subtitle: `전체 ${records.length}개`,
        body: { kind: 'bars', items: countBy(records.map(firstCategory)), unit: '개' },
      },
    ];
  },
  detail: r => ({
    fields: [
      { key: 'nameEn', label: '영문명', value: r.nameEn },
      { key: 'sku', label: 'SKU', value: r.sku },
      { key: 'category', label: '분류', value: r.category },
      { key: 'stock', label: '재고', value: r.stock === null ? null : formatInt(r.stock) },
      { key: 'cost', label: '부품 비용', value: r.cost === null ? null : `${formatInt(r.cost)}원` },
      { key: 'usd', label: 'A/S가(USD)', value: r.priceUsd === null ? null : `$${r.priceUsd}` },
      { key: 'location', label: '재고 위치', value: r.location },
      {
        key: 'video',
        label: '교체 영상',
        value: null,
        link: r.videoUrl ? { url: r.videoUrl, label: '영상 열기' } : null,
      },
    ],
    texts: [
      { label: '사용내역', text: r.usage },
      { label: '특이사항', text: r.notes },
    ],
    lists: [],
  }),
};
