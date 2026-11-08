import { useMemo } from 'react';
import { groupColor } from '@xtool-core/monday-colors';
import {
  groupIdOf,
  HIDDEN_TYPES,
  NAME_TITLE,
  OTHER_GROUP,
  PHONE_IN_NAME_BOARDS,
  previewCell,
  rowKey,
  splitNamePhone,
  SUB_NAME_TITLE,
  UPDATE_BOARDS,
  visibleColumns,
} from '@xtool-core/monday-values';
import type { TechBoardKey, TechColumn, TechItemDoc, TechSubitemDoc } from '@xtool-core/tech-boards';
import { useTechBoard } from '@xtool-core/tech-boards-store';
import { initialState, isWritable, toEditValue, type EditState } from '@xtool-core/tech-edit';
import { editItem, isDraftSubitem, moveItems } from '@xtool-core/tech-outbox';
import { editableSubColumns, priceColumn, relationColumn } from '@xtool-core/tech-subitems';
import { OTHER_GROUP_TITLE } from './board-model';
import { cellEditorKind, type CellCommit, type CellEditorKind } from './cell-edit';

// 항목 화면의 동작 — 모든 레이아웃이 같이 쓴다. 항목 찾기(만드는 중인 항목은 임시 id로도), 보일 이름, 그룹, 칸,
// 고칠 수 있는 칸, 칸 저장(웹과 같은 대기열 — 바로 보이고 뒤에서 저장, 실패·겹침은 토스트).

/** 지금 앱에서 고칠 수 있는 칸 종류 — 상태(라벨 고르기)와 글 칸(입력 하나). 나머지는 차례로 늘린다. */
export const EDITABLE_TEXT_TYPES = new Set(['text', 'numbers', 'phone', 'email', 'long_text']);

export interface ItemViewModel {
  boardKey: TechBoardKey;
  state: ReturnType<typeof useTechBoard>;
  item: TechItemDoc | null;
  /** 보일 이름(출장업무는 이름에 적힌 번호를 뗀다) */
  name: string;
  /** 업데이트 탭이 있는 보드이고 만들어진 항목인지 */
  hasUpdates: boolean;
  columns: TechColumn[];
  group: { id: string; title: string; color: string; index: number } | null;
  canEdit: (column: TechColumn) => boolean;
  /** 칸 저장 — state는 tech-edit의 EditState(상태·글 칸은 글자) */
  saveCell: (column: TechColumn, state: EditState) => void;
  // ── 아래는 Monday 표 편집(웹 monday-section·monday-item-row와 같은 저장) ──
  /** 이름 칸 머리글(고객명·업무 …) */
  nameTitle: string;
  /** 칸을 누르면 여는 편집기 — 모든 쓸 수 있는 칸(만드는 중인 항목도 고친다 — 만들어진 뒤 보낸다). 파일은 만든 뒤에만 */
  editorOf: (column: TechColumn) => CellEditorKind | null;
  /** 칸 저장 — 편집기가 만든 값·미리 보일 값 그대로(사람·연결 칸은 이름까지 바로 보인다) */
  commitCell: (column: TechColumn, commit: CellCommit) => void;
  /** 이름 바꾸기 — label은 보이는 이름. 출장업무는 떼어 보여 준 번호를 다시 붙여 Monday에 쓴다 */
  rename: (label: string) => void;
  /** 이 보드의 그룹(진행 단계) — 옮기기 고르기 */
  groups: { id: string; title: string; color: string }[];
  /** 다른 그룹으로 옮기기 — 바로 보이고 뒤에서 저장 */
  moveTo: (groupId: string) => void;
  /** 하위 아이템(출장 설치 품목·AS 청구 부품) — 하위 아이템이 있는 보드만 */
  sub: SubitemModel | null;
}

/** 하위 아이템 다루기 — 웹 monday-subitems·monday-section과 같은 규칙(tech-subitems) */
export interface SubitemModel {
  /** 이름 칸 머리글(품목명·부품명 — 없으면 하위 아이템) */
  nameTitle: string;
  /** 보일 칸(하위 아이템·버튼·생성 로그는 뺀다) */
  columns: TechColumn[];
  /** 연결 칸(AS 부품명) — 있으면 이름은 고른 부품을 따라가고 손으로 고치지 않는다, 줄마다 하나만 잇는다 */
  relationId: string | undefined;
  /** 만드는 중인 줄 — 다 만들어질 때까지 보기만 */
  isDraft: (sub: TechSubitemDoc) => boolean;
  /** 이 칸을 고칠 수 있는지(품명 빼고 쓸 수 있는 칸, 만드는 중이 아닌 줄) */
  canEdit: (sub: TechSubitemDoc, column: TechColumn) => boolean;
  /** 이름을 손으로 바꿀 수 있는지 */
  canRename: (sub: TechSubitemDoc) => boolean;
  /** 고칠 수 없는 칸의 까닭 */
  lockedText: (sub: TechSubitemDoc, column: TechColumn) => string | null;
  /** "+ 추가" — 이름만 적어 만든다 */
  add: (name: string) => void;
  /** 칸 저장 — 부품(연결 칸)을 고르면 줄 이름은 부품 이름, 금액이 비었으면 부품 비용으로 채운다 */
  commitCell: (sub: TechSubitemDoc, column: TechColumn, commit: CellCommit) => void;
  rename: (sub: TechSubitemDoc, name: string) => void;
  /** 지우기(Monday 휴지통) — 확인은 화면이 받는다 */
  remove: (sub: TechSubitemDoc) => void;
}

// 하위 표에 안 그리는 칸 — 생성 로그(하위 아이템·버튼은 HIDDEN_TYPES)
const SUB_HIDDEN_TYPES = new Set(['creation_log']);

export function useItemView(boardKey: TechBoardKey, itemId: string): ItemViewModel {
  const state = useTechBoard(boardKey);
  const { meta, items } = state;
  const item = items?.find(i => rowKey(i) === itemId || i.itemId === itemId) ?? null;
  const columns = useMemo(() => (meta ? visibleColumns(meta) : []), [meta]);

  let group: ItemViewModel['group'] = null;
  if (meta && item) {
    const id = groupIdOf(meta, item);
    const index = meta.groups.findIndex(g => g.id === id);
    group = {
      id,
      title: id === OTHER_GROUP ? OTHER_GROUP_TITLE : meta.groups[index]?.title ?? '—',
      color: groupColor(index >= 0 ? index : meta.groups.length),
      index,
    };
  }

  const stripPhone = PHONE_IN_NAME_BOARDS.has(boardKey);
  const name = item ? (stripPhone ? splitNamePhone(item.name).label : item.name) : '';
  const groups = useMemo(
    () => (meta ? meta.groups.map((g, i) => ({ id: g.id, title: g.title, color: groupColor(i) })) : []),
    [meta],
  );
  const sub = useSubitems(boardKey, meta?.subitems?.columns ?? null, item, name);

  return {
    boardKey,
    state,
    item,
    name,
    hasUpdates: UPDATE_BOARDS.has(boardKey) && !!item && !item.draft,
    columns,
    group,
    canEdit: column =>
      !!item && !item.draft && isWritable(column) && (column.type === 'status' || EDITABLE_TEXT_TYPES.has(column.type)),
    saveCell: (column, editState) => {
      if (!item) return;
      editItem(
        boardKey,
        rowKey(item),
        { columns: { [column.id]: { value: toEditValue(column, editState), preview: previewCell(column, editState) } } },
        `${item.name} · ${column.title}`,
      );
    },
    nameTitle: NAME_TITLE[boardKey],
    editorOf: column => {
      if (!item) return null;
      const kind = cellEditorKind(column);
      // 만드는 중인 항목은 Monday에 아직 없어 파일을 볼 곳이 없다
      return kind === 'file' && item.draft ? null : kind;
    },
    commitCell: (column, { state: editState, preview }) => {
      if (!item) return;
      editItem(
        boardKey,
        rowKey(item),
        { columns: { [column.id]: { value: toEditValue(column, editState), preview } } },
        `${name} · ${column.title}`,
      );
    },
    rename: label => {
      if (!item) return;
      const next = label.trim();
      if (!next || next === name) return;
      // 번호를 떼고 보여 준 이름이면 고친 이름 뒤에 원래 번호를 다시 붙인다 — 고친 이름에 번호를 직접 적었으면 적은 그대로
      const original = stripPhone ? splitNamePhone(item.name) : { label: item.name, phones: '' };
      const reattach = original.phones && original.label !== item.name && !splitNamePhone(next).phones;
      const full = reattach ? `${next} ${original.phones}` : next;
      if (full !== item.name) editItem(boardKey, rowKey(item), { name: full }, next);
    },
    groups,
    moveTo: groupId => {
      if (item && groupId !== group?.id) moveItems(boardKey, [rowKey(item)], groupId);
    },
    sub,
  };
}

/** 하위 아이템 저장 — 항목 칸처럼 바로 보이고 뒤에서 쓴다(웹 monday-section의 addSubitem·commitSubCell·removeSubitem) */
function useSubitems(
  boardKey: TechBoardKey,
  subColumns: TechColumn[] | null,
  item: TechItemDoc | null,
  itemName: string,
): SubitemModel | null {
  const columns = useMemo(
    () => (subColumns ?? []).filter(c => !HIDDEN_TYPES.has(c.type) && !SUB_HIDDEN_TYPES.has(c.type)),
    [subColumns],
  );
  const editable = useMemo(() => new Set(editableSubColumns(subColumns ?? []).map(c => c.id)), [subColumns]);
  if (!subColumns || !item) return null;
  const id = rowKey(item);
  const relation = relationColumn(subColumns);
  const update = (sub: TechSubitemDoc, name: string | undefined, cells: [TechColumn, CellCommit][]) =>
    editItem(
      boardKey,
      id,
      {
        subitems: {
          update: [
            {
              id: sub.id,
              ...(name !== undefined ? { name } : {}),
              columns: Object.fromEntries(cells.map(([c, { state: s }]) => [c.id, toEditValue(c, s)])),
            },
          ],
        },
        subitemPreviews: { [sub.id]: Object.fromEntries(cells.map(([c, { preview }]) => [c.id, preview])) },
      },
      `${itemName} · ${name ?? sub.name}`,
    );

  return {
    nameTitle: SUB_NAME_TITLE[boardKey] ?? '하위 아이템',
    columns,
    relationId: relation?.id,
    isDraft: s => isDraftSubitem(s.id),
    canEdit: (s, c) => !isDraftSubitem(s.id) && editable.has(c.id),
    canRename: s => !relation && !isDraftSubitem(s.id),
    lockedText: (s, c) =>
      isDraftSubitem(s.id)
        ? '만드는 중이에요 — 다 만들어지면 고칠 수 있어요'
        : c.type === 'mirror' || c.type === 'formula'
        ? `${c.title} — Monday가 계산하는 칸이에요`
        : c.writable
        ? `${c.title} — 이름·수량을 고치면 저절로 맞춰져요`
        : null,
    add: name => {
      const next = name.trim();
      if (next) editItem(boardKey, id, { subitems: { create: [{ name: next }] } }, `${itemName} · ${next}`);
    },
    commitCell: (s, column, commit) => {
      const cells: [TechColumn, CellCommit][] = [[column, commit]];
      let name: string | undefined;
      const part = column.id === relation?.id ? commit.picked?.[0] : undefined;
      if (part) {
        const record = part.record as { name?: string; cost?: unknown };
        const partName = (record.name || part.name).trim();
        if (partName && partName !== s.name) name = partName;
        const price = priceColumn(subColumns);
        if (price && typeof record.cost === 'number' && !initialState(price, s.values[price.id])) {
          const cost = String(record.cost);
          cells.push([price, { state: cost, preview: previewCell(price, cost) }]);
        }
      }
      update(s, name, cells);
    },
    rename: (s, name) => {
      const next = name.trim();
      if (next && next !== s.name) update(s, next, []);
    },
    remove: s => editItem(boardKey, id, { subitems: { remove: [s.id] } }, `${itemName} · ${s.name} 삭제`),
  };
}
