import { receivedIn } from '@xtool-core/board-kpis/inquiry';
import { byDateAsc, byDateDesc, periodRange, shortDate } from '@xtool-core/dates';
import { PERIOD_COMPARE } from '@xtool-core/period';
import { formatPhone, isDone, splitNames } from '@xtool-core/tech-stage';
import { countBy } from '../part-data';
import type { BoardRecord, DashboardBoardDef } from './types';
import { nameOf, pieces } from './util';

// 아톡문의 — 카카오톡 상담: 신규 접수 → 1차 안내 → 상담 진행중 → 장기 상담 → 완료(웹 inquiry-board.tsx).

type R = BoardRecord<'techInquiry'>;

const assigneesOf = (r: R) => splitNames(r.assignee);
const searchOf = (r: R) =>
  [r.name, r.phone, r.deviceSeries, r.device, r.type, r.content, r.resolution, r.assignee].join(' ');
/** 기기 — 계열(F 시리즈)과 고객이 적은 이름, "기타"는 뺀다 */
const deviceOf = (r: R) => [r.deviceSeries, r.device].filter(v => v && v !== '기타').join(' · ') || null;

export const inquiryDef: DashboardBoardDef<'techInquiry'> = {
  key: 'techInquiry',
  listTitle: '문의 목록',
  searchPlaceholder: '고객·기기·문의 내용 검색',
  progress: true,
  records: doc => doc.records,
  assigneesOf,
  searchOf,
  sortOpen: (a, b) => byDateAsc(a.receivedAt, b.receivedAt),
  sortDone: (a, b) => byDateDesc(a.receivedAt, b.receivedAt),
  columns: [
    { key: 'name', header: '고객명', sortValue: r => r.name },
    { key: 'device', header: '기기', sortValue: r => deviceOf(r) },
    { key: 'type', header: '문의 종류', sortValue: r => r.type },
    { key: 'content', header: '문의 내용', sortValue: r => r.content },
    { key: 'received', header: '접수일', sortValue: r => r.receivedAt },
    { key: 'assignee', header: '담당자', sortValue: r => assigneesOf(r)[0] },
    { key: 'stage', header: '단계', sortValue: r => r.stage },
  ],
  row: (r, today) => ({
    id: r.itemId,
    title: nameOf(r.name),
    subtitle: formatPhone(r.phone) ?? '연락처 없음',
    stage: { stage: r.stage, status: r.status },
    meta: pieces(deviceOf(r), r.type, r.content),
    assignees: assigneesOf(r),
    date: { text: shortDate(r.receivedAt, today), tone: 'muted' },
    done: isDone(r),
  }),
  side: (_doc, records, { period, today }) => {
    const { current } = periodRange(period, today);
    const received = receivedIn(records, current);
    const subtitle = `${PERIOD_COMPARE[period].current} ${received.length}건`;
    return [
      {
        key: 'type',
        title: '문의 종류',
        subtitle,
        body: { kind: 'bars', items: countBy(received.map(r => r.type)), empty: '이 기간에 접수된 문의가 없어요.' },
      },
      {
        key: 'series',
        title: '기기 계열',
        subtitle,
        body: {
          kind: 'bars',
          items: countBy(received.map(r => r.deviceSeries)),
          empty: '이 기간에 접수된 문의가 없어요.',
        },
      },
    ];
  },
  detail: (r, today) => ({
    fields: [
      { key: 'device', label: '기기', value: deviceOf(r) },
      { key: 'type', label: '문의 종류', value: r.type },
      { key: 'received', label: '접수일', value: shortDate(r.receivedAt, today) },
      { key: 'assignee', label: '담당자', value: assigneesOf(r).join(', ') || null },
      { key: 'phone', label: '연락처', value: null, phone: r.phone },
    ],
    texts: [
      { label: '문의 내용', text: r.content },
      { label: '해결 방안', text: r.resolution },
    ],
    lists: [],
  }),
};
