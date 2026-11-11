import { doneOn, upcomingVisits } from '@xtool-core/board-kpis/field-service';
import { byDateAsc, byDateDesc, inRange, periodRange, relativeDay, shortDate } from '@xtool-core/dates';
import { PERIOD_COMPARE } from '@xtool-core/period';
import { isDone, splitNames } from '@xtool-core/tech-stage';
import { SUBITEM_LABEL } from '@xtool-core/tech-subitems';
import { countBy } from '../part-data';
import type { BoardRecord, DashboardBoardDef } from './types';
import { dated, nameOf, pieces } from './util';

// 출장업무 — 방문 일정이 중심: 신규 → 일정 조율 → 일정 확정 → 완료(웹 field-service-board.tsx).

type R = BoardRecord<'fieldService'>;

const assigneesOf = (r: R) => splitNames(r.assignee);
const searchOf = (r: R) => [r.name, r.phone, r.type, r.region, r.address, r.notes, r.assignee].join(' ');
const ITEMS_LABEL = SUBITEM_LABEL.fieldService ?? '설치 품목';
// 설치 품목 줄 — 이름(비고가 있으면 괄호로)과 오른쪽 수량. 상세 목록과 줄 단추 시트가 같이 쓴다
const itemRows = (r: R) =>
  r.items.map((item, i) => ({
    key: String(i),
    label: item.note ? `${item.name} (${item.note})` : item.name,
    meta: item.quantity !== null ? `${item.quantity}개` : undefined,
  }));

export const fieldServiceDef: DashboardBoardDef<'fieldService'> = {
  key: 'fieldService',
  listTitle: '출장 목록',
  searchPlaceholder: '고객·주소·비고 검색',
  progress: true,
  records: doc => doc.records,
  assigneesOf,
  searchOf,
  sortOpen: (a, b) => byDateAsc(a.visitAt, b.visitAt) || byDateAsc(a.receivedAt, b.receivedAt),
  sortDone: (a, b) => byDateDesc(doneOn(a), doneOn(b)),
  columns: [
    { key: 'name', header: '고객명', sortValue: r => r.name },
    { key: 'type', header: '출장 종류', sortValue: r => r.type },
    { key: 'region', header: '지역', sortValue: r => r.region },
    { key: 'received', header: '접수일', sortValue: r => r.receivedAt },
    { key: 'visit', header: '방문 일정', sortValue: r => (r.visitAt ? `${r.visitAt} ${r.visitTime ?? ''}` : null) },
    { key: 'assignee', header: '담당자', sortValue: r => assigneesOf(r)[0] },
    { key: 'stage', header: '단계', sortValue: r => r.stage },
  ],
  // 카드 모양은 Monday 테마와 같게 — 단계 알약 없음(그룹으로 알 수 있고 상세에 있다), 이름 옆 전화 단추, 오른쪽 아래
  // 접수일, "설치 품목 N개" 단추
  row: (r, today) => ({
    id: r.itemId,
    title: nameOf(r.name),
    phone: r.phone ? { number: r.phone, beside: true } : null,
    meta: pieces(r.type, r.region),
    corner: dated('접수', r.receivedAt, today),
    subitems: r.items.length > 0 ? { label: ITEMS_LABEL, count: r.items.length } : null,
    assignees: assigneesOf(r),
    // 방문 일정 — 시각, 아직 안 끝난 앞날이면 '내일'·'3일 후'(웹 표 칸과 같다)
    date: r.visitAt
      ? {
          text: `${shortDate(r.visitAt, today)}${r.visitTime ? ` ${r.visitTime}` : ''}`,
          hint: !isDone(r) && r.visitAt >= today ? relativeDay(r.visitAt, today) : null,
        }
      : { text: '미정', tone: 'muted' },
    done: isDone(r),
  }),
  side: (_doc, records, { period, today, open }) => {
    const { current } = periodRange(period, today);
    const upcoming = upcomingVisits(records, today);
    const received = records.filter(r => inRange(r.receivedAt, current));
    return [
      {
        key: 'upcoming',
        title: '다가오는 방문',
        subtitle: `${upcoming.length}건`,
        body: {
          kind: 'upcoming',
          mode: 'due',
          empty: '잡힌 방문 일정이 없어요.',
          items: upcoming.slice(0, 6).map(r => ({
            key: r.itemId,
            date: r.visitAt ?? today,
            title: nameOf(r.name),
            meta: pieces(r.visitTime, r.region, r.type, splitNames(r.assignee).join(', ')).join(' · '),
            onPress: () => open(r.itemId),
          })),
        },
      },
      {
        key: 'region',
        title: '지역별 접수',
        subtitle: `${PERIOD_COMPARE[period].current} ${received.length}건`,
        body: { kind: 'bars', items: countBy(received.map(r => r.region)), empty: '이 기간에 접수된 출장이 없어요.' },
      },
    ];
  },
  detail: (r, today) => ({
    fields: [
      { key: 'type', label: '출장 종류', value: r.type },
      { key: 'region', label: '지역', value: r.region },
      {
        key: 'visit',
        label: '방문 일정',
        value: r.visitAt
          ? `${shortDate(r.visitAt, today)}${r.visitTime ? ` ${r.visitTime}` : ''} (${relativeDay(r.visitAt, today)})`
          : '미정',
      },
      { key: 'received', label: '접수일', value: shortDate(r.receivedAt, today) },
      { key: 'assignee', label: '담당자', value: assigneesOf(r).join(', ') || null },
      { key: 'phone', label: '연락처', value: null, phone: r.phone },
      { key: 'address', label: '주소', value: r.address },
    ],
    texts: [{ label: '비고', text: r.notes }],
    lists:
      r.items.length > 0
        ? [
            {
              key: 'items',
              title: `${ITEMS_LABEL} ${r.items.length}`,
              items: itemRows(r),
            },
          ]
        : [],
  }),
  subitems: r => (r.items.length > 0 ? { label: ITEMS_LABEL, items: itemRows(r) } : null),
};
