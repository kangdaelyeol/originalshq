import { useMemo, useState } from 'react';
import { koreaToday } from '@xtool-core/dates';
import { previewCell, splitText } from '@xtool-core/monday-values';
import type { TechCellValue, TechColumn, TechItemDoc } from '@xtool-core/tech-boards';
import { useMondayUsers, useTechBoard } from '@xtool-core/tech-boards-store';
import {
  formatPhoneTyping,
  initialState,
  isPartialPhone,
  isPhoneColumn,
  isPhoneLike,
  isWritable,
  PHONE_PREFIX,
  sameState,
  type EditState,
} from '@xtool-core/tech-edit';
import { useTechMembers } from '@xtool-core/tech-members';
import { pushToast } from '@xtool-core/tech-save-queue';
import { useRelationOptions } from './dashboard/item-editor';

// 칸 하나 고치기 — 웹 Monday 표의 편집기 규칙(monday-editors·monday-date-picker·monday-editable-cell)을 그대로. 어느 칸에
// 어떤 편집기를 여는지, 처음 값, 고를 거리, 저장할 값과 저장 전 칸에 미리 보일 값(previewCell). 모양(시트·달력)은
// 테마가 그린다. 저장은 부르는 쪽이 commit을 저장 대기열에 넘긴다(features/item-view의 commitCell).

/** 저장할 것 — 편집 상태와 저장이 끝나기 전 칸에 보일 값 */
export interface CellCommit {
  state: EditState;
  preview: TechCellValue;
  /** 연결 칸에서 고른 항목 — 하위 아이템 부품을 고르면 줄 이름·금액을 맞춘다 */
  picked?: TechItemDoc[];
}

/** 칸을 누르면 여는 편집기 */
export type CellEditorKind =
  | 'status'
  | 'dropdown'
  | 'people'
  | 'assignee'
  | 'relation'
  | 'date'
  | 'check'
  | 'inline'
  | 'long_text'
  | 'link'
  | 'location'
  | 'file';

/**
 * 칸의 편집기 — null이면 보기만(웹 "{칸} — Monday에서만 고칠 수 있어요"). 파일 칸은 고칠 수 없어도 파일 보기를 연다.
 * 주소 칸은 고를 수 있는 칸이지만 앱은 주소 검색이 없어 안내만 한다(location).
 */
export function cellEditorKind(column: TechColumn): CellEditorKind | null {
  if (column.type === 'file') return 'file';
  if (!isWritable(column)) return null;
  switch (column.type) {
    case 'status':
      return 'status';
    case 'dropdown':
      return 'dropdown';
    case 'people':
      return 'people';
    case 'assignee':
      return 'assignee';
    case 'board_relation':
      return column.linkedBoardKey ? 'relation' : null;
    case 'date':
      return 'date';
    case 'checkbox':
      return 'check';
    case 'long_text':
      return 'long_text';
    case 'link':
      return 'link';
    case 'location':
      return 'location';
    case 'text':
    case 'numbers':
    case 'phone':
    case 'email':
      return 'inline';
    default:
      return null;
  }
}

// ── 상태 ─────────────────────────────────────────────────────────────────────────────────────────────────

/** 상태 라벨 — 칸의 라벨에 지금 값(목록에 없으면)을 더한다 */
export const statusOptions = (column: TechColumn, current: string): string[] => [
  ...(column.options ?? []),
  ...(current && !column.options?.includes(current) ? [current] : []),
];

/** 상태 고르기 — 지금 값을 다시 고르면 그대로(null), ''은 비우기 */
export const statusCommit = (column: TechColumn, current: string, label: string): CellCommit | null =>
  label === current ? null : { state: label, preview: previewCell(column, label) };

// ── 체크 ─────────────────────────────────────────────────────────────────────────────────────────────────

/** 체크 칸 — 누르면 바로 반대로(연달아 눌러도 대기열이 마지막 값으로 보낸다) */
export function checkCommit(column: TechColumn, cell: TechCellValue | undefined): CellCommit {
  const next = !(initialState(column, cell) as boolean);
  return { state: next, preview: previewCell(column, next) };
}

// ── 칸 안 입력(글·숫자·연락처·이메일) ────────────────────────────────────────────────────────────────────

export interface InlineModel {
  value: string;
  /** 치는 대로 — 연락처는 하이픈 모양으로 맞춘다 */
  setValue: (text: string) => void;
  keyboardType: 'default' | 'decimal-pad' | 'phone-pad' | 'email-address';
  /** 빈 연락처 칸에 010을 미리 적었는지 — 커서를 끝에 두고 이어 친다(아니면 전체 선택) */
  prefilled: boolean;
  /** 끝내기 — 저장할 값이면 CellCommit, 그대로이거나 덜 적은 번호면 null(번호는 오류 토스트) */
  finish: () => CellCommit | null;
}

/** 칸 안 입력 — 웹 InlineInput: 엔터·바깥 누르기는 저장, 연락처는 010 미리·하이픈·9자리 미만 저장 안 함 */
export function useInlineEditor(column: TechColumn, cell: TechCellValue | undefined): InlineModel {
  const phone = isPhoneColumn(column);
  const [initial] = useState(() => initialState(column, cell) as string);
  const prefilled = phone && !initial;
  const [value, setValue] = useState(prefilled ? PHONE_PREFIX : initial);
  // 번호 하나로 적힌 값만 치는 대로 하이픈을 넣는다(번호 두 개 등은 적힌 그대로)
  const format = phone && isPhoneLike(initial) ? formatPhoneTyping : null;
  return {
    value,
    setValue: text => setValue(format ? format(text) : text),
    keyboardType:
      column.type === 'numbers'
        ? 'decimal-pad'
        : phone
        ? 'phone-pad'
        : column.type === 'email'
        ? 'email-address'
        : 'default',
    prefilled,
    finish: () => {
      // 미리 적은 글자만 남았으면 빈 칸 그대로
      const next = prefilled && value === PHONE_PREFIX ? '' : value;
      if (next === initial) return null;
      if (phone && isPhoneLike(next) && isPartialPhone(next)) {
        pushToast({
          tone: 'error',
          title: `${column.title}: 번호를 끝까지 적어 주세요`,
          message: '9자리가 안 되는 번호는 저장하지 않았어요.',
        });
        return null;
      }
      return { state: next, preview: previewCell(column, next) };
    },
  };
}

// ── 고르기 목록(드롭다운·사람·담당자·연결) ────────────────────────────────────────────────────────────────

export interface PickOption {
  value: string;
  label: string;
  /** 오른쪽 작은 글(연결 항목의 단계 등) */
  sub?: string | null;
}

export interface PickModel {
  options: PickOption[];
  /** 고른 것(위 토큰) */
  selected: string[];
  /** 목록에서 누르기(토큰으로 옮긴다) · 토큰 빼기 — single이면 바로 저장할 것을 돌려준다 */
  add: (value: string) => CellCommit | null;
  remove: (value: string) => CellCommit | null;
  labelOf: (value: string) => string;
  searchPlaceholder: string;
  /** 고를 것이 없을 때(불러오는 중이면 그 글) */
  empty: string;
  /** 사람 칸 — 목록에 동그라미 */
  people: boolean;
  /** 하나만 잇는 연결 칸(하위 아이템 부품) — 고르면(빼면) 바로 저장하고 닫는다 */
  single: boolean;
  /** 닫을 때 — 바뀌었으면 저장할 것 */
  finish: () => CellCommit | null;
}

/** 목록에 보일 것 — 고른 것은 빼고 검색어로 거른 앞 80개(웹 PickList) */
export const PICK_LIMIT = 80;
export function filterPick(options: readonly PickOption[], selected: readonly string[], query: string): PickOption[] {
  const needle = query.trim().toLowerCase();
  return options
    .filter(o => !selected.includes(o.value) && (!needle || `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(needle)))
    .slice(0, PICK_LIMIT);
}

function usePickState(
  initial: string[],
  options: PickOption[],
  toCommit: (selected: string[]) => CellCommit,
  rest: Pick<PickModel, 'searchPlaceholder' | 'empty' | 'people'> & { single?: boolean },
): PickModel {
  const [selected, setSelected] = useState(initial);
  const byValue = new Map(options.map(o => [o.value, o]));
  const save = (next: string[]) => (sameState(initial, next) ? null : toCommit(next));
  const single = rest.single ?? false;
  return {
    options,
    selected,
    add: value => {
      if (single) return save([value]);
      setSelected([...selected, value]);
      return null;
    },
    remove: value => {
      const next = selected.filter(v => v !== value);
      if (single) return save(next);
      setSelected(next);
      return null;
    },
    labelOf: value => byValue.get(value)?.label ?? `#${value}`,
    searchPlaceholder: rest.searchPlaceholder,
    empty: rest.empty,
    people: rest.people,
    single,
    finish: () => save(selected),
  };
}

/** 드롭다운 — 칸의 라벨(지금 값이 목록에 없으면 더한다), "라벨 찾기" */
export function useDropdownPick(column: TechColumn, cell: TechCellValue | undefined): PickModel {
  const [initial] = useState(() => initialState(column, cell) as string[]);
  const options = useMemo(
    () =>
      [...(column.options ?? []), ...initial.filter(v => !column.options?.includes(v))].map(label => ({
        value: label,
        label,
      })),
    [column.options, initial],
  );
  return usePickState(initial, options, next => ({ state: next, preview: previewCell(column, next) }), {
    searchPlaceholder: '라벨 찾기',
    empty: '고를 라벨이 없어요',
    people: false,
  });
}

/**
 * Monday 사람 칸(담당자가 아닌 칸) — Monday 사용자 목록에서. 처음부터 있던 사람(목록 밖·비활성)도 이름을 지키고,
 * Monday가 지운 계정("삭제된 팀원")은 새로 고를 사람에서 뺀다.
 */
export function usePeoplePick(column: TechColumn, cell: TechCellValue | undefined): PickModel {
  const users = useMondayUsers();
  const [initial] = useState(() => initialState(column, cell) as string[]);
  const text = cell?.text ?? '';
  const options = useMemo(() => {
    const names = text.split(', ');
    const fromUsers = (users ?? [])
      .filter(u => !/^삭제된 팀원$/.test(u.name))
      .map(u => ({ value: u.id, label: u.name }));
    const known = new Set(fromUsers.map(o => o.value));
    const remembered = initial
      .map((id, i) => ({ value: id, label: names[i] ?? `#${id}` }))
      .filter(o => !known.has(o.value));
    return [...remembered, ...fromUsers];
  }, [users, text, initial]);
  const nameOf = (id: string) => options.find(o => o.value === id)?.label ?? `#${id}`;
  return usePickState(
    initial,
    options,
    next => ({ state: next, preview: previewCell(column, next, next.map(nameOf)) }),
    {
      searchPlaceholder: '이름 찾기',
      empty: users === null ? '사람 목록을 불러오는 중…' : '고를 사람이 없어요',
      people: true,
    },
  );
}

/** 담당자(엑스툴) — 기술팀 명단에서(가나다순), 값은 이름을 ", "로 이은 글자. 처음 적혀 있던 이름(예전 담당자)도 지킨다. */
export function useAssigneePick(column: TechColumn, cell: TechCellValue | undefined): PickModel {
  const members = useTechMembers();
  const [initial] = useState(() => splitText(cell?.text ?? ''));
  const options = useMemo(() => {
    const team = (members ?? [])
      .map(m => m.name.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ko'));
    return [...new Set([...initial, ...team])].map(name => ({ value: name, label: name }));
  }, [members, initial]);
  return usePickState(
    initial,
    options,
    next => {
      const joined = next.join(', ');
      return { state: joined, preview: previewCell(column, joined) };
    },
    {
      searchPlaceholder: '이름 찾기',
      empty: members === null ? '기술팀 명단을 불러오는 중…' : '고를 사람이 없어요',
      people: true,
    },
  );
}

/**
 * 연결 칸 — 가리키는 보드(우리 캐시)의 항목을 이름으로 찾아 잇는다(고를 거리는 대시보드 편집과 같은 useRelationOptions).
 * single이면 하나만 잇는다(AS 청구 부품 줄) — 고르면 바로 저장.
 */
export function useRelationPick(column: TechColumn, cell: TechCellValue | undefined, single = false): PickModel {
  const linked = column.linkedBoardKey!;
  const board = useTechBoard(linked);
  const [initial] = useState(() => initialState(column, cell) as string[]);
  const { options, loading } = useRelationOptions(linked, initial, cell?.text ?? '');
  const nameOf = (id: string) => options.find(o => o.value === id)?.label ?? `#${id}`;
  return usePickState(
    initial,
    options,
    next => ({
      state: next,
      preview: previewCell(column, next, next.map(nameOf)),
      picked: (board.items ?? []).filter(item => next.includes(item.itemId)),
    }),
    { searchPlaceholder: '항목 찾기', empty: loading ? '불러오는 중…' : '찾는 항목이 없어요', people: false, single },
  );
}

// ── 긴 글·링크 ────────────────────────────────────────────────────────────────────────────────────────────

export interface FormModel<T extends EditState> {
  value: T;
  setValue: (next: T) => void;
  changed: boolean;
  /** 적용(또는 바깥 누르기) — 바뀌었으면 저장할 것 */
  finish: () => CellCommit | null;
}

/** 긴 글·링크 작은 입력 판(웹 FormEditor) — 바깥 누르기·"적용"은 저장, "취소"는 그대로 */
export function useFormEditor<T extends EditState>(column: TechColumn, cell: TechCellValue | undefined): FormModel<T> {
  const [initial] = useState(() => initialState(column, cell) as T);
  const [value, setValue] = useState<T>(initial);
  const changed = !sameState(initial, value);
  return {
    value,
    setValue,
    changed,
    finish: () => (changed ? { state: value, preview: previewCell(column, value) } : null),
  };
}

// ── 날짜(시각) ───────────────────────────────────────────────────────────────────────────────────────────

/** 달력 머리 — 월요일부터(웹 Monday 달력) */
export const MONDAY_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;
/** 연도 고르기 범위 — 올해 앞 10년·뒤 5년 */
const YEARS_BACK = 10;
const YEARS_AHEAD = 5;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** 한국 지금 시각(HH:MM) */
export const koreaTime = (): string => new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 16);

/** 적어 넣은 날짜 — 2026-11-03 · 2026.11.03 · 2026/11/03 · 11/03/2026(없는 날은 null) */
export function parseTypedDate(text: string): string | null {
  const t = text.trim();
  const iso = /^(\d{4})[-./ ](\d{1,2})[-./ ](\d{1,2})$/.exec(t);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  const parts = iso ? [iso[1], iso[2], iso[3]] : us ? [us[3], us[1], us[2]] : null;
  if (!parts) return null;
  const [y, mo, d] = parts.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? ymd(y, mo, d) : null;
}

/** 치는 중인 시각 → "HH:MM"(숫자만 받아 가운데 쌍점을 넣는다) */
export function formatTimeTyping(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** 다 적은 시각인지 — 00:00~23:59 */
export const isTime = (text: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(text);

export interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
}

/** 그 달을 월요일부터 6주(42칸)로 — 앞뒤 달 날도 채운다(흐리게) */
export function mondayMonthGrid(year: number, month: number): CalendarDay[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1, 1 - offset + i));
    return {
      date: ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month - 1,
    };
  });
}

export interface DateEditorModel {
  /** 고른 날(YYYY-MM-DD) */
  date: string;
  /** 시각(HH:MM, 시각을 켰을 때) */
  time: string;
  withTime: boolean;
  /** 날짜 입력 칸 글자 */
  text: string;
  /** 보고 있는 달 */
  view: { year: number; month: number };
  today: string;
  grid: CalendarDay[];
  years: number[];
  /** 원래 날짜가 있던 칸 — "날짜 지우기"를 보인다 */
  hadDate: boolean;
  goToday: () => void;
  toggleTime: () => void;
  typeDate: (text: string) => void;
  typeTime: (text: string) => void;
  /** 달 넘기기 */
  shift: (delta: number) => void;
  setView: (view: { year: number; month: number }) => void;
  /** 날짜 누르기 — 바로 저장(같으면 null) */
  pick: (date: string) => CellCommit | null;
  /** 날짜 칸에서 완료 — 읽을 수 있는 날짜면 그날로 저장 */
  submitText: () => CellCommit | null;
  /** 시각 칸에서 완료 */
  submitTime: () => CellCommit | null;
  /** 닫기(바깥 누르기) — 손을 댔을 때만 저장 */
  finish: () => CellCommit | null;
  clear: () => CellCommit;
}

/**
 * 날짜 칸 달력(웹 DatePicker) — 위에 "오늘"·시각 켜기, 날짜 입력, 월·연도 고르기와 화살표, 월요일부터 6주. 날짜를 누르면
 * 바로 저장. 빈 칸은 지금 날짜·시각을 미리 채워 열고, 손을 대야(날짜·시각·오늘·시각 켜기) 닫을 때 저장한다.
 */
export function useDateEditor(column: TechColumn, cell: TechCellValue | undefined): DateEditorModel {
  const [initial] = useState(() => initialState(column, cell) as { date: string; time: string });
  const empty = !initial.date;
  const today = koreaToday();
  const [date, setDate] = useState(empty ? today : initial.date);
  const [time, setTime] = useState(empty ? koreaTime() : initial.time);
  const [withTime, setWithTime] = useState(empty || Boolean(initial.time));
  const [text, setText] = useState(date);
  const [view, setView] = useState(() => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) }));
  const [touched, setTouched] = useState(false);
  const thisYear = Number(today.slice(0, 4));

  const commit = (nextDate: string, nextTime = withTime && isTime(time) ? time : ''): CellCommit | null => {
    const state = { date: nextDate, time: nextTime };
    if (state.date === initial.date && state.time === initial.time) return null;
    return { state, preview: previewCell(column, state) };
  };

  return {
    date,
    time,
    withTime,
    text,
    view,
    today,
    grid: mondayMonthGrid(view.year, view.month),
    years: Array.from({ length: YEARS_BACK + YEARS_AHEAD + 1 }, (_, i) => thisYear - YEARS_BACK + i),
    hadDate: !empty,
    goToday: () => {
      setDate(today);
      setText(today);
      setView({ year: thisYear, month: Number(today.slice(5, 7)) });
      setTouched(true);
    },
    toggleTime: () => {
      setWithTime(on => !on);
      if (!time) setTime(koreaTime());
      setTouched(true);
    },
    typeDate: value => {
      setText(value);
      const parsed = parseTypedDate(value);
      if (!parsed) return;
      setDate(parsed);
      setView({ year: Number(parsed.slice(0, 4)), month: Number(parsed.slice(5, 7)) });
      setTouched(true);
    },
    typeTime: value => {
      setTime(formatTimeTyping(value));
      setTouched(true);
    },
    shift: delta =>
      setView(({ year, month }) => {
        const index = year * 12 + (month - 1) + delta;
        return { year: Math.floor(index / 12), month: (index % 12) + 1 };
      }),
    setView,
    pick: next => {
      setDate(next);
      return commit(next);
    },
    submitText: () => {
      const parsed = parseTypedDate(text);
      return parsed ? commit(parsed) : null;
    },
    submitTime: () => commit(date),
    finish: () => (touched ? commit(date) : null),
    clear: () => {
      const state = { date: '', time: '' };
      return { state, preview: previewCell(column, state) };
    },
  };
}
