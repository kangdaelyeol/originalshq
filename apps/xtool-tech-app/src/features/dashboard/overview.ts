import { useMemo, useState } from 'react';
import { buildAttention, type AttentionTile } from '@xtool-core/attention';
import { koreaToday, shortDate } from '@xtool-core/dates';
import { buildMyWork, MY_WORK_BOARDS, type MyWorkBoard } from '@xtool-core/my-work';
import { buildSchedule } from '@xtool-core/schedule';
import { buildTeamStatus, type TeamMemberStatus } from '@xtool-core/team-status';
import {
  BOARD_TABS,
  type AsRequestRecord,
  type FieldServiceRecord,
  type InquiryRecord,
  type PartRecord,
  type RentalRecord,
  type RepairRecord,
  type TaskRecord,
} from '@xtool-core/tech-boards';
import { useTechBoard } from '@xtool-core/tech-boards-store';
import {
  kingFacts,
  kingPeriod,
  KINGS,
  previousKingPeriod,
  rankKing,
  type KingSources,
  type KingSpan,
} from '@xtool-core/tech-kings';
import { useTechMembers } from '@xtool-core/tech-members';
import type { KingCardProps, SegmentOption, WorkRowView } from '../../themes/dashboard/parts';
import { useMyIdentity } from '../use-my-work';
import { scheduleView, workRowView, type ScheduleView } from './part-data';

// 개요의 동작 — 웹 overview-page.tsx(+ my-work-card·schedule-card). 위에서부터 나의 진행 중 업무 · 오늘·이번 주 일정,
// 챙겨야 할 것, 기술팀 왕(이번 주·이번 달 × AS왕·수리왕·아톡처리왕), 팀 현황. 모양은 themes/dashboard가 그린다.

const SPANS: readonly { span: KingSpan; label: string; previous: string }[] = [
  { span: 'week', label: '이번 주', previous: '지난주' },
  { span: 'month', label: '이번 달', previous: '지난달' },
];

/** 나의 진행 중 업무 — 처음에 보여 줄 줄 수(웹 PAGE) */
const MY_WORK_PAGE = 8;

type WorkFilter = 'all' | MyWorkBoard;
const labelOf = (key: MyWorkBoard) => BOARD_TABS.find(t => t.key === key)?.label ?? key;

export interface KingSection {
  span: KingSpan;
  /** '이번 주 기술팀 왕' */
  title: string;
  /** '11/2 ~ 11/8' */
  range: string;
  cards: (KingCardProps & { key: string })[];
}

export interface OverviewModel {
  today: string;
  myNames: ReadonlySet<string>;
  myWork: {
    subtitle: string;
    loading: boolean;
    /** 보드 칩 — 전체 N · 출장업무 N … (진행 중이 있는 보드만) */
    filters: SegmentOption<WorkFilter>[];
    filter: WorkFilter;
    setFilter: (filter: WorkFilter) => void;
    rows: WorkRowView[];
    empty: string | null;
    more: { remaining: number; onPress: () => void } | null;
  };
  schedule: {
    subtitle: string;
    loading: boolean;
    scope: 'team' | 'me';
    setScope: (scope: 'team' | 'me') => void;
    scopes: SegmentOption<'team' | 'me'>[];
    view: ScheduleView;
    showOverdue: boolean;
    toggleOverdue: () => void;
  };
  attention: { tiles: AttentionTile[]; loading: boolean };
  kings: KingSection[];
  team: { members: TeamMemberStatus[]; loading: boolean };
}

export function useOverview(): OverviewModel {
  const field = useTechBoard('fieldService');
  const repair = useTechBoard('repair');
  const inquiry = useTechBoard('techInquiry');
  const task = useTechBoard('techTask');
  const rentals = useTechBoard('rentals');
  const parts = useTechBoard('parts');
  const requests = useTechBoard('asRequests');
  const { names: myNames } = useMyIdentity();
  const roster = useTechMembers();
  const today = koreaToday();

  const fieldRecords = (field.board?.records as FieldServiceRecord[] | undefined) ?? null;
  const repairRecords = (repair.board?.records as RepairRecord[] | undefined) ?? null;
  const inquiryRecords = (inquiry.board?.records as InquiryRecord[] | undefined) ?? null;
  const taskRecords = (task.board?.records as TaskRecord[] | undefined) ?? null;
  const rentalRecords = (rentals.board?.records as RentalRecord[] | undefined) ?? null;
  const partRecords = (parts.board?.records as PartRecord[] | undefined) ?? null;
  const requestRecords = (requests.board?.records as AsRequestRecord[] | undefined) ?? null;
  const pending = (b: { board: unknown; error: string | null }) => !b.board && !b.error;

  // 기술팀 왕 — 보드 기록이 바뀔 때만 다시 센다
  const factsById = useMemo(() => {
    const sources: KingSources = { fieldService: fieldRecords, repair: repairRecords, techInquiry: inquiryRecords };
    return Object.fromEntries(KINGS.map(def => [def.id, kingFacts(def.id, sources)]));
  }, [fieldRecords, repairRecords, inquiryRecords]);
  const kings = SPANS.map(({ span, label, previous }) => {
    const period = kingPeriod(span, today);
    const before = previousKingPeriod(span, period);
    return {
      span,
      title: `${label} 기술팀 왕`,
      range: `${shortDate(period.start, today)} ~ ${shortDate(period.end, today)}`,
      cards: KINGS.map(def => {
        const facts = factsById[def.id];
        return {
          key: def.id,
          def,
          spanLabel: label,
          previousLabel: previous,
          period,
          result: facts ? rankKing(facts, period) : null,
          previousTop: facts ? rankKing(facts, before).rows[0] ?? null : null,
        };
      }),
    };
  });

  const loadingAll = [field, repair, inquiry, task, rentals, parts, requests].some(pending);
  const attention = useMemo(
    () =>
      buildAttention(
        {
          fieldService: fieldRecords,
          repair: repairRecords,
          techInquiry: inquiryRecords,
          techTask: taskRecords,
          rentals: rentalRecords,
          parts: partRecords,
          asRequests: requestRecords,
        },
        today,
      ),
    [fieldRecords, repairRecords, inquiryRecords, taskRecords, rentalRecords, partRecords, requestRecords, today],
  );
  // 팀 현황은 기술팀으로 등록한 사람만(명단을 못 읽었으면 최근 담당자로)
  const team = useMemo(
    () =>
      buildTeamStatus(
        { fieldService: fieldRecords, repair: repairRecords, techInquiry: inquiryRecords, techTask: taskRecords },
        today,
        roster?.map(m => m.name).filter(Boolean) ?? null,
      ),
    [fieldRecords, repairRecords, inquiryRecords, taskRecords, today, roster],
  );

  // ── 나의 진행 중 업무(웹 MyWorkCard) ──
  const [filter, setFilterState] = useState<WorkFilter>('all');
  const [limit, setLimit] = useState(MY_WORK_PAGE);
  const myItems = useMemo(
    () =>
      buildMyWork(
        { fieldService: fieldRecords, repair: repairRecords, techInquiry: inquiryRecords, techTask: taskRecords },
        myNames,
        today,
      ),
    [fieldRecords, repairRecords, inquiryRecords, taskRecords, myNames, today],
  );
  const counts = Object.fromEntries(MY_WORK_BOARDS.map(k => [k, myItems.filter(i => i.boardKey === k).length]));
  const shownWork = filter === 'all' ? myItems : myItems.filter(i => i.boardKey === filter);
  const urgent = myItems.filter(i => i.urgent).length;
  const myWorkLoading = [field, repair, inquiry, task].some(pending);

  // ── 오늘·이번 주 일정(웹 ScheduleCard) ──
  const [scope, setScope] = useState<'team' | 'me'>('team');
  const [showOverdue, setShowOverdue] = useState(false);
  const schedule = useMemo(
    () =>
      scheduleView(
        buildSchedule(
          { fieldService: fieldRecords, techTask: taskRecords, rentals: rentalRecords },
          today,
          scope === 'me' ? myNames : null,
        ),
        today,
      ),
    [fieldRecords, taskRecords, rentalRecords, today, scope, myNames],
  );
  const scheduleLoading = [field, task, rentals].some(pending);

  return {
    today,
    myNames,
    myWork: {
      subtitle: myWorkLoading ? '불러오는 중…' : `${myItems.length}건${urgent ? ` · 임박·지남 ${urgent}건` : ''}`,
      loading: myWorkLoading,
      filters:
        myItems.length > 0
          ? [
              { value: 'all', label: `전체 ${myItems.length}` },
              ...MY_WORK_BOARDS.filter(k => counts[k] > 0).map(k => ({
                value: k as WorkFilter,
                label: `${labelOf(k)} ${counts[k]}`,
              })),
            ]
          : [],
      filter,
      setFilter: next => {
        setFilterState(next);
        setLimit(MY_WORK_PAGE);
      },
      rows: shownWork.slice(0, limit).map(item => workRowView(item, today)),
      empty: !myWorkLoading && myItems.length === 0 ? '진행 중인 담당 업무가 없어요.' : null,
      more:
        shownWork.length > limit
          ? { remaining: shownWork.length - limit, onPress: () => setLimit(n => n + MY_WORK_PAGE) }
          : null,
    },
    schedule: {
      subtitle: scheduleLoading ? '불러오는 중…' : `${schedule.total}건`,
      loading: scheduleLoading,
      scope,
      setScope,
      scopes: [
        { value: 'team', label: '팀 전체' },
        { value: 'me', label: '나' },
      ],
      view: schedule,
      showOverdue,
      toggleOverdue: () => setShowOverdue(v => !v),
    },
    attention: { tiles: attention, loading: loadingAll },
    kings,
    team: { members: team, loading: loadingAll },
  };
}
