import { doneOn } from '@xtool-core/board-kpis/task';
import { byDateAsc, byDateDesc, shortDate } from '@xtool-core/dates';
import { isDone, splitNames } from '@xtool-core/tech-stage';
import { countBy } from '../part-data';
import type { BoardRecord, DashboardBoardDef } from './types';
import { dated, dateOrNull, nameOf, pieces } from './util';

// 기타업무 — 출장·AS·문의 밖의 일(샘플 테스트, 회수품 점검 등): 진행전 → 진행 중 → 막힘 → 완료(웹 task-board.tsx).

type R = BoardRecord<'techTask'>;

const assigneesOf = (r: R) => splitNames(r.assignee);
const searchOf = (r: R) => [r.name, r.requester, r.assignee, r.details].join(' ');

export const taskDef: DashboardBoardDef<'techTask'> = {
  key: 'techTask',
  listTitle: '업무 목록',
  searchPlaceholder: '업무·사람·상세내용 검색',
  progress: true,
  records: doc => doc.records,
  assigneesOf,
  searchOf,
  sortOpen: (a, b) => byDateAsc(a.dueAt, b.dueAt) || byDateAsc(a.requestedAt, b.requestedAt),
  sortDone: (a, b) => byDateDesc(doneOn(a), doneOn(b)),
  columns: [
    { key: 'name', header: '업무', sortValue: r => r.name },
    { key: 'requester', header: '요청', sortValue: r => splitNames(r.requester)[0] },
    { key: 'assignee', header: '담당자', sortValue: r => assigneesOf(r)[0] },
    { key: 'requested', header: '요청일', sortValue: r => r.requestedAt },
    { key: 'due', header: '마감일', sortValue: r => r.dueAt },
    { key: 'stage', header: '단계', sortValue: r => r.stage },
  ],
  row: (r, today) => {
    const requester = splitNames(r.requester);
    return {
      id: r.itemId,
      title: nameOf(r.name),
      subtitle: requester.length ? `요청 ${requester.join(', ')}` : null,
      stage: { stage: r.stage, status: r.status },
      meta: pieces(dated('요청', r.requestedAt, today)),
      assignees: assigneesOf(r),
      // 마감일 — 안 끝났는데 지났으면 위험 색(웹 cell-alert)
      date: r.dueAt
        ? { text: `마감 ${shortDate(r.dueAt, today)}`, tone: !isDone(r) && r.dueAt < today ? 'crit' : 'default' }
        : null,
      done: isDone(r),
    };
  },
  side: (_doc, records, { today, open }) => {
    const openRecords = records.filter(r => !isDone(r));
    // 마감일은 거의 안 적어서 요청일이 오래된 순으로 챙긴다(웹과 같다)
    const oldest = openRecords.filter(r => r.requestedAt).sort((a, b) => byDateAsc(a.requestedAt, b.requestedAt));
    return [
      {
        key: 'oldest',
        title: '오래 걸리는 업무',
        subtitle: `${oldest.length}건`,
        body: {
          kind: 'upcoming',
          mode: 'since',
          empty: '진행 중인 업무가 없어요.',
          items: oldest.slice(0, 6).map(r => ({
            key: r.itemId,
            date: r.requestedAt ?? today,
            title: nameOf(r.name),
            meta: pieces(
              assigneesOf(r).join(', ') || '담당자 없음',
              r.dueAt ? `마감 ${shortDate(r.dueAt, today)}` : null,
            ).join(' · '),
            onPress: () => open(r.itemId),
          })),
        },
      },
      {
        key: 'workload',
        title: '담당자별 진행 중',
        subtitle: `진행 중 ${openRecords.length}건`,
        body: {
          kind: 'bars',
          items: countBy(
            openRecords.flatMap(r => (assigneesOf(r).length ? assigneesOf(r) : [null])),
            '담당자 없음',
          ),
          empty: '진행 중인 업무가 없어요.',
        },
      },
    ];
  },
  detail: (r, today) => ({
    fields: [
      { key: 'requester', label: '요청', value: splitNames(r.requester).join(', ') || null },
      { key: 'assignee', label: '담당자', value: assigneesOf(r).join(', ') || null },
      { key: 'requested', label: '요청일', value: dateOrNull(r.requestedAt, today) },
      { key: 'started', label: '시작일', value: dateOrNull(r.startedAt, today) },
      { key: 'due', label: '마감일', value: dateOrNull(r.dueAt, today) },
      { key: 'completed', label: '완료일', value: dateOrNull(r.completedAt, today) },
    ],
    texts: [{ label: '상세내용', text: r.details }],
    lists: [],
  }),
};
