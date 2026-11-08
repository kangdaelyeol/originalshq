import { PHASE, phaseOf } from '@xtool-core/board-kpis/rentals';
import { byDateAsc, shortDate } from '@xtool-core/dates';
import { formatPhone } from '@xtool-core/tech-stage';
import { countBy } from '../part-data';
import type { BoardRecord, DashboardBoardDef } from './types';
import { dated, dateOrNull, nameOf, pieces } from './util';

// 대여품 관리 — 대여 기기가 지금 어디 있는지: 대여 가능 → 대여 중 → 회수 후 점검(→ 불량)(웹 rentals-board.tsx).

type R = BoardRecord<'rentals'>;

const assigneesOf = (r: R) => r.assignees;
const searchOf = (r: R) => [r.name, r.serialNumber, r.renter, r.renterPhone, ...r.assignees].join(' ');
/** 상태 알약 — 상태 글이 있으면 그것, 색은 단계(대여 가능·대여 중·점검·불량) */
const pillOf = (r: R) => ({ label: r.status ?? PHASE[phaseOf(r)].label, tone: PHASE[phaseOf(r)].tone, dot: true });

export const rentalsDef: DashboardBoardDef<'rentals'> = {
  key: 'rentals',
  listTitle: '대여품 목록',
  searchPlaceholder: '기기·SN·대여자 검색',
  progress: false,
  records: doc => doc.records,
  assigneesOf,
  searchOf,
  columns: [
    { key: 'name', header: '기기', sortValue: r => r.name },
    { key: 'sn', header: 'SN', sortValue: r => r.serialNumber },
    { key: 'renter', header: '대여자', sortValue: r => r.renter },
    { key: 'rented', header: '대여일', sortValue: r => r.rentedAt },
    { key: 'returned', header: '회수일', sortValue: r => r.returnedAt },
    { key: 'assignee', header: '담당자', sortValue: r => r.assignees[0] },
    { key: 'stage', header: '상태', sortValue: r => r.stage },
  ],
  row: (r, today) => ({
    id: r.itemId,
    title: nameOf(r.name),
    subtitle: r.serialNumber ? `SN ${r.serialNumber}` : null,
    pill: pillOf(r),
    meta: pieces(
      r.renter ? `${r.renter} ${formatPhone(r.renterPhone) ?? '연락처 없음'}` : null,
      dated('회수', r.returnedAt, today),
    ),
    assignees: r.assignees,
    date: r.rentedAt ? { text: `대여 ${shortDate(r.rentedAt, today)}`, tone: 'muted' } : null,
  }),
  side: (_doc, records, { today, open }) => {
    const rented = records
      .filter(r => phaseOf(r) === 'rented' && r.rentedAt)
      .sort((a, b) => byDateAsc(a.rentedAt, b.rentedAt));
    return [
      {
        key: 'rented',
        title: '오래 나가 있는 대여품',
        subtitle: `${rented.length}대`,
        body: {
          kind: 'upcoming',
          mode: 'since',
          empty: '대여 중인 기기가 없어요.',
          items: rented.slice(0, 6).map(r => ({
            key: r.itemId,
            date: r.rentedAt ?? today,
            title: nameOf(r.name),
            meta: pieces(r.renter, r.serialNumber).join(' · '),
            onPress: () => open(r.itemId),
          })),
        },
      },
      {
        key: 'device',
        title: '기기별 대여품',
        subtitle: `전체 ${records.length}대`,
        body: { kind: 'bars', items: countBy(records.map(r => r.name)), unit: '대' },
      },
    ];
  },
  detail: (r, today) => ({
    fields: [
      { key: 'sn', label: 'SN', value: r.serialNumber },
      { key: 'status', label: '상태', value: r.status },
      { key: 'assignee', label: '담당자', value: r.assignees.join(', ') || null },
      { key: 'renter', label: '대여자', value: r.renter },
      { key: 'phone', label: '연락처', value: null, phone: r.renterPhone },
      { key: 'rented', label: '대여일', value: dateOrNull(r.rentedAt, today) },
      { key: 'ship', label: '발송 예정일', value: dateOrNull(r.shipAt, today) },
      { key: 'returned', label: '회수일', value: dateOrNull(r.returnedAt, today) },
    ],
    texts: [],
    lists: [],
  }),
  pill: pillOf,
};
