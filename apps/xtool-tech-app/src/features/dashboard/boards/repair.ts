import { doneOn } from '@xtool-core/board-kpis/repair';
import { byDateAsc, byDateDesc, daysBetween, inRange, koreaToday, periodRange, shortDate } from '@xtool-core/dates';
import { PERIOD_COMPARE } from '@xtool-core/period';
import { formatPhone, isDone, splitNames } from '@xtool-core/tech-stage';
import { countBy, formatInt } from '../part-data';
import type { BoardRecord, DashboardBoardDef } from './types';
import { dateOrNull, nameOf, pieces } from './util';

// AS — 기기를 받아 수리해 돌려보내기까지: 입고 대기 → 수리 중 → 발송 대기 → 완료(웹 repair-board.tsx).

type R = BoardRecord<'repair'>;

const assigneesOf = (r: R) => splitNames(r.assignee);
const searchOf = (r: R) => [r.name, r.phone, r.device, r.serialNumber, r.symptom, r.result, r.assignee].join(' ');
/** 접수부터 지금(완료면 완료일)까지 날 수 */
const ageOf = (r: R, today: string): number | null =>
  r.receivedAt ? daysBetween(r.receivedAt, isDone(r) ? doneOn(r) ?? today : today) : null;

export const repairDef: DashboardBoardDef<'repair'> = {
  key: 'repair',
  listTitle: 'AS 목록',
  searchPlaceholder: '고객·기기·증상·SN 검색',
  progress: true,
  records: doc => doc.records,
  assigneesOf,
  searchOf,
  sortOpen: (a, b) => byDateAsc(a.receivedAt, b.receivedAt),
  sortDone: (a, b) => byDateDesc(doneOn(a), doneOn(b)),
  columns: [
    { key: 'name', header: '고객명', sortValue: r => r.name },
    { key: 'device', header: '기기', sortValue: r => r.device },
    { key: 'symptom', header: '증상', sortValue: r => r.symptom },
    { key: 'received', header: '접수일', sortValue: r => r.receivedAt },
    // 웹 표처럼 오늘 기준 경과 — 정렬할 때마다 다시 센다
    { key: 'age', header: '경과', sortValue: r => ageOf(r, koreaToday()) },
    { key: 'assignee', header: '담당자', sortValue: r => assigneesOf(r)[0] },
    { key: 'stage', header: '단계', sortValue: r => r.stage },
  ],
  row: (r, today) => {
    const age = ageOf(r, today);
    const done = isDone(r);
    return {
      id: r.itemId,
      title: nameOf(r.name),
      subtitle: formatPhone(r.phone) ?? '연락처 없음',
      stage: { stage: r.stage, status: r.status },
      meta: pieces(r.device, r.symptom),
      assignees: assigneesOf(r),
      // 접수일 + 경과 — 진행 중 14일 넘으면 위험 색(웹 cell-alert)
      date: {
        text: shortDate(r.receivedAt, today),
        hint: age === null ? null : done ? `${age}일 걸림` : `${age}일째`,
        tone: !done && age !== null && age >= 14 ? 'crit' : done ? 'muted' : 'default',
      },
      done,
    };
  },
  side: (_doc, records, { period, today }) => {
    const { current } = periodRange(period, today);
    const open = records.filter(r => !isDone(r));
    const received = records.filter(r => inRange(r.receivedAt, current));
    return [
      {
        key: 'device',
        title: '기기별 접수',
        subtitle: `${PERIOD_COMPARE[period].current} ${received.length}건`,
        body: { kind: 'bars', items: countBy(received.map(r => r.device)), empty: '이 기간에 접수된 AS가 없어요.' },
      },
      {
        key: 'workload',
        title: '담당자별 진행 중',
        subtitle: `진행 중 ${open.length}건`,
        body: {
          kind: 'bars',
          items: countBy(
            open.flatMap(r => (assigneesOf(r).length ? assigneesOf(r) : [null])),
            '담당자 없음',
          ),
          empty: '진행 중인 AS가 없어요.',
        },
      },
    ];
  },
  detail: (r, today) => ({
    fields: [
      { key: 'device', label: '기기', value: r.device },
      { key: 'sn', label: 'SN', value: r.serialNumber },
      { key: 'received', label: '접수일', value: shortDate(r.receivedAt, today) },
      { key: 'completed', label: '완료일', value: dateOrNull(r.completedAt, today) },
      { key: 'assignee', label: '담당자', value: assigneesOf(r).join(', ') || null },
      { key: 'phone', label: '연락처', value: null, phone: r.phone },
      { key: 'address', label: '주소', value: r.address },
    ],
    texts: [
      { label: '증상', text: r.symptom },
      { label: '수리 내역(결과)', text: r.result },
    ],
    lists:
      r.parts.length > 0
        ? [
            {
              key: 'parts',
              title: `청구 부품·공임 — 합계 ${formatInt(r.amount)}원`,
              items: r.parts.map((part, i) => ({
                key: String(i),
                label: pieces(part.part ?? part.name, part.sku).join(' · '),
                meta: `${part.quantity !== null ? `${part.quantity}개 · ` : ''}${formatInt(part.total)}원`,
              })),
            },
          ]
        : [],
  }),
};
