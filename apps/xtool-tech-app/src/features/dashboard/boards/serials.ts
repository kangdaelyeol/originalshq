import { linkCount, visibleSerials } from '@xtool-core/board-kpis/serials';
import { byDateDesc, shortDate } from '@xtool-core/dates';
import { countBy } from '../part-data';
import type { BoardRecord, DashboardBoardDef } from './types';
import { dateOrNull, pieces } from './util';

// 엑스툴 SN 관리 — 기기 시리얼 대장. 출장·AS·대여 기록과 이어져 기기 하나의 이력을 본다(웹 serials-board.tsx).
// 빈 템플릿 줄("새로운 serial number")은 목록·상세에서 뺀다.

type R = BoardRecord<'serials'>;

const noAssignees = (): string[] => [];
const searchOf = (r: R) =>
  [r.serialNumber, r.device, r.notes, ...r.links.fieldService, ...r.links.repair, ...r.links.rental].join(' ');
const linksText = (r: R) =>
  pieces(
    r.links.fieldService.length > 0 && `출장 ${r.links.fieldService.length}`,
    r.links.repair.length > 0 && `AS ${r.links.repair.length}`,
    r.links.rental.length > 0 && `대여 ${r.links.rental.length}`,
  ).join(' · ');

export const serialsDef: DashboardBoardDef<'serials'> = {
  key: 'serials',
  listTitle: 'SN 목록',
  searchPlaceholder: 'SN·기기·고객 이름 검색',
  progress: false,
  records: doc => visibleSerials(doc.records),
  assigneesOf: noAssignees,
  searchOf,
  sortDone: (a, b) => byDateDesc(a.receivedAt, b.receivedAt),
  columns: [
    { key: 'name', header: 'SN', sortValue: r => r.serialNumber },
    { key: 'device', header: '기기', sortValue: r => r.device },
    { key: 'received', header: '입고일', sortValue: r => r.receivedAt },
    { key: 'links', header: '연결 기록', sortValue: r => linkCount(r) },
    { key: 'notes', header: '비고', sortValue: r => r.notes },
  ],
  row: (r, today) => ({
    id: r.itemId,
    title: r.serialNumber,
    subtitle: r.device,
    meta: pieces(linksText(r), r.notes),
    date: r.receivedAt ? { text: shortDate(r.receivedAt, today), tone: 'muted' } : null,
  }),
  side: (_doc, records, { open }) => {
    // 같은 SN이 둘 이상이면 중복 — 보드의 "중복 SN" 그룹도 함께 본다
    const counts = countBy(records.map(r => r.serialNumber));
    const repeated = new Set(counts.filter(c => c.value > 1).map(c => c.label));
    const duplicates = records.filter(r => repeated.has(r.serialNumber) || /중복/.test(r.stage ?? ''));
    return [
      {
        key: 'device',
        title: '기기별 대수',
        subtitle: `전체 ${records.length}대`,
        body: { kind: 'bars', items: countBy(records.map(r => r.device)), unit: '대' },
      },
      {
        key: 'duplicates',
        title: '중복 SN',
        subtitle: `${duplicates.length}건`,
        body: {
          kind: 'mini',
          empty: '중복된 SN이 없어요.',
          items: duplicates.slice(0, 7).map(r => ({
            key: r.itemId,
            title: r.serialNumber,
            meta: pieces(r.device, r.notes).join(' · '),
            onPress: () => open(r.itemId),
          })),
        },
      },
    ];
  },
  detail: (r, today) => ({
    fields: [
      { key: 'device', label: '기기', value: r.device },
      { key: 'received', label: '입고일', value: dateOrNull(r.receivedAt, today) },
      { key: 'field', label: '출장 기록', value: r.links.fieldService.join(', ') || null },
      { key: 'repair', label: 'AS 기록', value: r.links.repair.join(', ') || null },
      { key: 'rental', label: '대여품', value: r.links.rental.join(', ') || null },
    ],
    texts: [{ label: '비고', text: r.notes }],
    lists: [],
  }),
};
