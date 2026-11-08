import { useMemo, useState } from 'react';
import { errorText } from '@xtool-core/error-text';
import { groupIdOf, viewColumns } from '@xtool-core/monday-values';
import type { TechBoardKey, TechBoardMeta, TechColumn, TechItemDoc } from '@xtool-core/tech-boards';
import { pushToast } from '@xtool-core/tech-save-queue';
import {
  applyViewRules,
  cellChoices,
  createBoardView,
  deleteBoardView,
  GROUP_COLUMN,
  NAME_COLUMN,
  OPS_BY_KIND,
  opInput,
  ruleKind,
  updateBoardView,
  VIEW_LIMITS,
  type BoardView,
  type BoardViewSpec,
  type ViewOp,
  type ViewRule,
} from '@xtool-core/tech-views';

// 보기 추가·고치기 — 웹 monday-view-modal의 규칙 그대로: 이름(40자), 조건(칸·조건·값 줄들, 모두/하나라도 — 고치는 동안
// 맞는 항목 수), 정렬, 숨길 칸. 저장하면 기술팀 모두의 보드에 같은 보기 탭이 생긴다(core tech-views). 모양은 테마가.

const EMPTY: BoardViewSpec = { name: '', match: 'all', rules: [], sort: null, hidden: [] };

/** 칸을 고르면 그 칸 종류의 첫 조건으로 */
const ruleFor = (column: TechColumn): ViewRule => ({
  columnId: column.id,
  op: OPS_BY_KIND[ruleKind(column)][0].op,
  values: [],
});

/** 복제할 때 처음 값 — "{이름} 복사"(40자까지) */
export const duplicateSpec = (view: BoardView): BoardViewSpec => ({
  name: `${view.name} 복사`.slice(0, VIEW_LIMITS.name),
  match: view.match,
  rules: view.rules,
  sort: view.sort,
  hidden: view.hidden,
});

export interface ViewEditorModel {
  /** 고치는 보기(새로 만들면 null) */
  view: BoardView | null;
  draft: BoardViewSpec;
  /** 조건·정렬에 쓸 칸 — 이름·그룹·보이는 칸 */
  columns: TechColumn[];
  columnOf: (id: string) => TechColumn | undefined;
  /** 지금 조건에 맞는 항목 수 / 전체 */
  matched: number;
  total: number;
  setName: (name: string) => void;
  setMatch: (match: BoardViewSpec['match']) => void;
  /** 조건 한 줄의 고를 조건들 · 값 넣는 방식 */
  opsOf: (rule: ViewRule) => readonly { op: ViewOp; label: string }[];
  inputOf: (rule: ViewRule) => 'pick' | 'type' | 'none';
  /** 값을 적는 조건이 숫자인지(숫자 키패드) */
  isNumber: (rule: ViewRule) => boolean;
  /** 고를 값 — Monday 라벨과 항목에 적힌 값(많이 쓰인 순), 그룹은 보드 그룹 순서 */
  choicesOf: (column: TechColumn) => { value: string; label: string }[];
  setRuleColumn: (index: number, columnId: string) => void;
  setRuleOp: (index: number, op: ViewOp) => void;
  setRuleText: (index: number, text: string) => void;
  toggleRuleValue: (index: number, value: string) => void;
  removeRule: (index: number) => void;
  addRule: () => void;
  canAddRule: boolean;
  /** 정렬 — '' 이면 정렬 안 함 */
  setSortColumn: (columnId: string) => void;
  setSortDir: (dir: 1 | -1) => void;
  /** 숨길 수 있는 칸(이름·그룹 빼고) */
  hideable: TechColumn[];
  toggleHidden: (columnId: string) => void;
  busy: 'save' | 'delete' | null;
  error: string | null;
  canSave: boolean;
  /** 저장 — 저장한 보기 id(못 하면 null, error를 채운다) */
  save: () => Promise<string | null>;
  /** 지우기 — 됐으면 true */
  remove: () => Promise<boolean>;
}

export function useViewEditor(
  boardKey: TechBoardKey,
  meta: TechBoardMeta,
  items: readonly TechItemDoc[],
  view: BoardView | null,
  initial?: BoardViewSpec,
): ViewEditorModel {
  const columns = useMemo(() => viewColumns(meta, boardKey), [meta, boardKey]);
  const byId = useMemo(() => new Map(columns.map(c => [c.id, c])), [columns]);
  const [draft, setDraft] = useState<BoardViewSpec>(() =>
    view
      ? { name: view.name, match: view.match, rules: view.rules, sort: view.sort, hidden: view.hidden }
      : initial ?? EMPTY,
  );
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const matched = useMemo(
    () => applyViewRules([...items], draft, columns, item => groupIdOf(meta, item)).length,
    [items, draft, columns, meta],
  );

  const patch = (next: Partial<BoardViewSpec>) => setDraft(d => ({ ...d, ...next }));
  const setRule = (index: number, rule: ViewRule) =>
    setDraft(d => ({ ...d, rules: d.rules.map((r, i) => (i === index ? rule : r)) }));
  const kindOf = (rule: ViewRule) => {
    const column = byId.get(rule.columnId);
    return column ? ruleKind(column) : 'text';
  };
  const name = draft.name.trim();

  return {
    view,
    draft,
    columns,
    columnOf: id => byId.get(id),
    matched,
    total: items.length,
    setName: next => patch({ name: next.slice(0, VIEW_LIMITS.name) }),
    setMatch: match => patch({ match }),
    opsOf: rule => OPS_BY_KIND[kindOf(rule)],
    inputOf: rule => opInput(rule.op),
    isNumber: rule => kindOf(rule) === 'number',
    choicesOf: column => {
      if (column.id === GROUP_COLUMN) return meta.groups.map(g => ({ value: g.id, label: g.title }));
      const counts = new Map<string, number>((column.options ?? []).map(o => [o, 0]));
      for (const item of items) for (const v of cellChoices(column, item, '')) counts.set(v, (counts.get(v) ?? 0) + 1);
      return [...counts]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
        .map(([value]) => ({ value, label: value }));
    },
    setRuleColumn: (index, columnId) => {
      const column = byId.get(columnId);
      if (column) setRule(index, ruleFor(column));
    },
    setRuleOp: (index, op) => setRule(index, { ...draft.rules[index], op, values: [] }),
    setRuleText: (index, text) => setRule(index, { ...draft.rules[index], values: [text] }),
    toggleRuleValue: (index, value) => {
      const rule = draft.rules[index];
      const on = rule.values.includes(value);
      setRule(index, { ...rule, values: on ? rule.values.filter(v => v !== value) : [...rule.values, value] });
    },
    removeRule: index => patch({ rules: draft.rules.filter((_, i) => i !== index) }),
    // 처음 고를 칸 — 상태 칸(가장 자주 거르는 칸)이 있으면 그것, 없으면 이름
    addRule: () => {
      const first = columns.find(c => c.type === 'status') ?? columns[0];
      patch({ rules: [...draft.rules, ruleFor(first)] });
    },
    canAddRule: draft.rules.length < VIEW_LIMITS.rules,
    setSortColumn: columnId => patch({ sort: columnId ? { columnId, dir: draft.sort?.dir ?? 1 } : null }),
    setSortDir: dir => {
      if (draft.sort) patch({ sort: { ...draft.sort, dir } });
    },
    hideable: columns.filter(c => c.id !== NAME_COLUMN && c.id !== GROUP_COLUMN),
    toggleHidden: id =>
      patch({ hidden: draft.hidden.includes(id) ? draft.hidden.filter(h => h !== id) : [...draft.hidden, id] }),
    busy,
    error,
    canSave: Boolean(name) && busy === null,
    save: async () => {
      if (!name || busy) return null;
      setBusy('save');
      setError(null);
      try {
        const id = view ? (await updateBoardView(view.id, draft), view.id) : await createBoardView(boardKey, draft);
        return id;
      } catch (e) {
        setError(errorText(e));
        setBusy(null);
        return null;
      }
    },
    remove: async () => {
      if (!view) return false;
      setBusy('delete');
      setError(null);
      try {
        await deleteBoardView(view.id);
        return true;
      } catch (e) {
        setError(errorText(e));
        setBusy(null);
        return false;
      }
    },
  };
}

/** 보기 탭 메뉴의 "보기 지우기"(확인 뒤) — 메인 테이블로 돌아가고, 못 지우면 토스트(웹 monday-board) */
export function deleteViewNow(view: BoardView): void {
  deleteBoardView(view.id).catch((e: unknown) =>
    pushToast({ tone: 'error', title: `"${view.name}" 보기를 지우지 못했어요`, message: errorText(e) }),
  );
}
