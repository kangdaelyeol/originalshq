import { useMemo, useState } from 'react';
import { koreaNow } from '@xtool-core/dates';
import { labelColor } from '@xtool-core/monday-colors';
import type { TechBoardKey, TechBoardMeta, TechColumn, TechItemDoc } from '@xtool-core/tech-boards';
import { useMondayUsers, useTechBoard } from '@xtool-core/tech-boards-store';
import {
  columnLabel,
  emptyState,
  formatPhoneTyping,
  initialState,
  isAssigneeColumn,
  isPhoneColumn,
  isPhoneLike,
  isPhonePrefixOnly,
  isWritable,
  PHONE_PREFIX,
  sameState,
  toEditValue,
  withoutLegacyAssignee,
  type EditState,
  type LocationState,
} from '@xtool-core/tech-edit';
import { useTechMembers } from '@xtool-core/tech-members';
import { createItem, editItem, type CellEdit } from '@xtool-core/tech-outbox';
import { stageLabel } from '@xtool-core/tech-stage';
import { SUBITEM_LABEL } from '@xtool-core/tech-subitems';
import type { ChoiceOption, DateTimeValue, SubitemView } from '../../themes/dashboard/parts';
import { formatInt } from './part-data';

// 항목 편집·새로 만들기 — 웹 components/board/item-editor.tsx(EditorForm)의 규칙 그대로: 쓸 수 있는 칸(담당자(엑스툴)이
// 있으면 원래 사람 칸은 뺀다), 처음 값(새로 만들 때 접수일은 지금), 바뀐 칸만 보내기, 이름 필수, 배치(이름 → 비고 →
// 진행 단계·상태 → 날짜 모아서 → 드롭다운 → 나머지), 저장은 대기열(editItem·createItem — 바로 보이고 뒤에서, 실패는 토스트).
// 주소는 카카오 검색으로 고른다(features/address-search — 좌표가 있어야 써진다). 폰에서 아직 못 고치는 것: 파일 올리기,
// 하위 줄(설치 품목·청구 부품) — 웹에서 고친다.

// 편집 칸에서 아예 안 보이는 타입 — 값이 아닌 것(웹과 같다)
const HIDDEN_TYPES = new Set(['button', 'item_id', 'subtasks', 'last_updated', 'creation_log', 'auto_number']);

interface FieldBase {
  /** 칸 id */
  id: string;
  column: TechColumn;
  /** 보일 칸 이름(담당자(엑스툴) → 담당자 등) */
  label: string;
  /** 처음 값과 달라졌는지(고칠 때만) */
  changed: boolean;
}

export type EditorField =
  | (FieldBase & {
      kind: 'text';
      value: string;
      multiline: boolean;
      keyboardType: 'default' | 'decimal-pad' | 'phone-pad' | 'email-address';
      /** 연락처 칸 — 치는 대로 010-1234-5678 모양, 비었을 때 들어오면 010 */
      phone: boolean;
    })
  | (FieldBase & { kind: 'link'; value: { url: string; text: string } })
  | (FieldBase & {
      kind: 'choice';
      source: 'status' | 'dropdown' | 'people' | 'assignee';
      options: ChoiceOption[];
      value: string[];
      multiple: boolean;
      searchable: boolean;
      clearable: boolean;
      /** 목록을 아직 못 받았을 때 등 */
      hint: string | null;
    })
  | (FieldBase & { kind: 'relation'; linkedBoardKey: TechBoardKey; value: string[]; fallbackText: string })
  | (FieldBase & { kind: 'date'; value: DateTimeValue })
  | (FieldBase & { kind: 'location'; value: LocationState })
  | (FieldBase & { kind: 'check'; value: boolean });

interface FormState {
  name: string;
  groupId: string;
  values: Record<string, EditState>;
}

/** 새로 만들 때의 처음 값 — 접수일(접수일자)은 지금 날짜·시각으로 채워 둔다 */
const newItemState = (column: TechColumn): EditState =>
  column.type === 'date' && /^접수일/.test(column.title.replace(/\s/g, '')) ? koreaNow() : emptyState(column);

/** 편집 칸 배치 — 날짜는 처음 나오는 날짜 자리에 모아서, 드롭다운은 처음 나오는 드롭다운 자리에 모아서(웹 layoutRows) */
function layoutOrder(columns: TechColumn[], skip: TechColumn[]): TechColumn[] {
  const rest = columns.filter(c => !skip.includes(c));
  const dates = rest.filter(c => c.type === 'date');
  const dropdowns = rest.filter(c => c.type === 'dropdown');
  const out: TechColumn[] = [];
  let datesPlaced = false;
  let dropdownsPlaced = false;
  for (const column of rest) {
    if (column.type === 'date') {
      if (!datesPlaced) out.push(...dates);
      datesPlaced = true;
    } else if (column.type === 'dropdown') {
      if (!dropdownsPlaced) out.push(...dropdowns);
      dropdownsPlaced = true;
    } else {
      out.push(column);
    }
  }
  return out;
}

export interface ItemEditorModel {
  /** '항목 수정' · '새 항목' */
  title: string;
  boardName: string;
  /** 고치는 항목의 지금 이름 */
  itemName: string | null;
  saveLabel: string;
  name: string;
  setName: (name: string) => void;
  nameChanged: boolean;
  /** 진행 단계(그룹) — 그룹이 없는 보드는 null */
  group: { options: ChoiceOption[]; value: string; set: (id: string) => void; changed: boolean } | null;
  /** 진행 단계 옆 상태 칸 */
  statusField: EditorField | null;
  /** 이름 밑 비고 칸 */
  noteFields: EditorField[];
  /** 나머지 칸 — 배치 순서 */
  fields: EditorField[];
  setValue: (columnId: string, value: EditState) => void;
  /** 글 칸 — 연락처는 치는 대로 모양을 맞춘다 */
  setText: (field: EditorField, text: string) => void;
  /** 연락처 칸에 들어올 때·나갈 때(웹 onFocus·onBlur) */
  focusText: (field: EditorField) => void;
  blurText: (field: EditorField) => void;
  /** Monday에서만 고칠 수 있는 칸 이름들 */
  locked: string[];
  /** 웹에서만 고칠 수 있는 칸 이름들(앱이 아직 못 고친다) */
  webOnly: string[];
  /** 하위 줄(설치 품목·청구 부품) — 앱은 보여만 준다 */
  subitems: { title: string; items: SubitemView[] } | null;
  error: string | null;
  /** 저장할 것이 있는지(새로 만들기는 늘 참) */
  dirty: boolean;
  /** 저장 — 됐으면 true(닫는다), 못 했으면 error를 채우고 false */
  save: () => boolean;
}

/**
 * 편집 폼 — 시트를 열 때 한 번만 처음 값을 잡는다(저장 중에 실시간 값이 바뀌어도 입력이 흔들리지 않게). 그래서 시트 안
 * 부품이 열릴 때 마운트되게(닫으면 빼게) 쓴다. item이 null이면 새로 만들기.
 */
export function useItemEditor(boardKey: TechBoardKey, meta: TechBoardMeta, item: TechItemDoc | null): ItemEditorModel {
  const users = useMondayUsers();
  const members = useTechMembers();
  const columns = useMemo(() => withoutLegacyAssignee(meta.columns.filter(isWritable)), [meta.columns]);
  const subLabel = meta.subitems ? SUBITEM_LABEL[boardKey] : undefined;

  const [initial] = useState<FormState>(() => ({
    name: item?.name ?? '',
    groupId: item?.groupId ?? meta.groups[0]?.id ?? '',
    values: Object.fromEntries(columns.map(c => [c.id, item ? initialState(c, item.values[c.id]) : newItemState(c)])),
  }));
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState<string | null>(null);
  // 처음에 적혀 있던 담당자·사람 — 명단에 없어도(예전 담당자·비활성 계정) 고르기에 남긴다(웹과 같다)
  const [rememberedAssignees] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      columns.filter(isAssigneeColumn).map(c => [
        c.id,
        String(initial.values[c.id] ?? '')
          .split(', ')
          .map(s => s.trim())
          .filter(Boolean),
      ]),
    ),
  );
  const [rememberedPeople] = useState<Record<string, ChoiceOption[]>>(() =>
    Object.fromEntries(
      columns
        .filter(c => c.type === 'people')
        .map(c => {
          const names = (item?.values[c.id]?.text ?? '').split(', ');
          const ids = (initial.values[c.id] as string[] | undefined) ?? [];
          return [c.id, ids.map((uid, i) => ({ value: uid, label: names[i] ?? `#${uid}` }))];
        }),
    ),
  );

  const changedOf = (c: TechColumn) => !sameState(form.values[c.id], item ? initial.values[c.id] : emptyState(c));
  const changedColumns = columns.filter(changedOf);
  const nameChanged = form.name.trim() !== initial.name;
  const groupChanged = form.groupId !== initial.groupId;
  const dirty = !item || nameChanged || groupChanged || changedColumns.length > 0;

  const setValue = (id: string, value: EditState) => {
    setError(null);
    setForm(f => ({ ...f, values: { ...f.values, [id]: value } }));
  };

  const team = (members ?? [])
    .map(m => m.name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ko'));

  const fieldOf = (column: TechColumn): EditorField => {
    const base = { id: column.id, column, label: columnLabel(column), changed: !!item && changedOf(column) };
    const value = form.values[column.id];
    switch (column.type) {
      case 'status': {
        const options = column.options ?? [];
        const current = value as string;
        return {
          ...base,
          kind: 'choice',
          source: 'status',
          options: [...options, ...(current && !options.includes(current) ? [current] : [])].map(label => ({
            value: label,
            label,
            color: labelColor(label),
          })),
          value: current ? [current] : [],
          multiple: false,
          searchable: false,
          clearable: true,
          hint: null,
        };
      }
      case 'dropdown': {
        const selected = value as string[];
        const options = [...(column.options ?? []), ...selected.filter(v => !column.options?.includes(v))];
        return {
          ...base,
          kind: 'choice',
          source: 'dropdown',
          options: options.map(label => ({ value: label, label })),
          value: selected,
          multiple: true,
          searchable: options.length > 8,
          clearable: true,
          hint: null,
        };
      }
      case 'people': {
        const fromUsers = (users ?? []).map(u => ({ value: u.id, label: u.name, sub: u.email }));
        const known = new Set(fromUsers.map(o => o.value));
        return {
          ...base,
          kind: 'choice',
          source: 'people',
          options: [...(rememberedPeople[column.id] ?? []).filter(o => !known.has(o.value)), ...fromUsers],
          value: value as string[],
          multiple: true,
          searchable: true,
          clearable: true,
          hint: users === null ? '사람 목록을 불러오는 중…' : null,
        };
      }
      case 'board_relation':
        return {
          ...base,
          kind: 'relation',
          linkedBoardKey: column.linkedBoardKey as TechBoardKey,
          value: value as string[],
          fallbackText: item?.values[column.id]?.text ?? '',
        };
      case 'checkbox':
        return { ...base, kind: 'check', value: value as boolean };
      case 'date':
        return { ...base, kind: 'date', value: value as DateTimeValue };
      case 'link':
        return { ...base, kind: 'link', value: value as { url: string; text: string } };
      case 'location':
        return { ...base, kind: 'location', value: value as LocationState };
      default: {
        if (isAssigneeColumn(column)) {
          const selected = String(value ?? '')
            .split(', ')
            .map(s => s.trim())
            .filter(Boolean);
          return {
            ...base,
            kind: 'choice',
            source: 'assignee',
            options: [...new Set([...(rememberedAssignees[column.id] ?? []), ...team])].map(name => ({
              value: name,
              label: name,
            })),
            value: selected,
            multiple: true,
            searchable: true,
            clearable: true,
            hint: members === null ? '기술팀 명단을 불러오는 중…' : null,
          };
        }
        const phone = isPhoneColumn(column);
        return {
          ...base,
          kind: 'text',
          value: value as string,
          multiline: column.type === 'long_text',
          keyboardType:
            column.type === 'numbers'
              ? 'decimal-pad'
              : column.type === 'email'
              ? 'email-address'
              : phone
              ? 'phone-pad'
              : 'default',
          phone,
        };
      }
    }
  };

  // 진행 단계 옆 상태 칸(보드의 첫 상태 칸), 이름 밑 비고 칸 — 나머지는 배치 순서로
  const statusColumn = meta.groups.length > 0 ? columns.find(c => c.type === 'status') : undefined;
  const noteColumns = columns.filter(c => c.title.replace(/\s/g, '') === '비고');
  const order = layoutOrder(columns, [...noteColumns, ...(statusColumn ? [statusColumn] : [])]);

  const subLabelForLock = subLabel;
  const locked = meta.columns
    .filter(c => !isWritable(c) && !HIDDEN_TYPES.has(c.type))
    .filter(c => !(c.type === 'mirror' && c.title === subLabelForLock))
    .filter(c => c.type !== 'file')
    .map(c => c.title);
  const fileColumns = meta.columns.filter(c => c.type === 'file');
  const webOnly = [
    ...(fileColumns.length ? [`${fileColumns.map(c => c.title).join('·')}(파일 올리기)`] : []),
    ...(subLabel ? [subLabel] : []),
  ];

  const subColumns = meta.subitems?.columns ?? [];
  const subitems =
    subLabel && item
      ? {
          title: `${subLabel} ${item.subitems?.length ?? 0}`,
          items: (item.subitems ?? []).map(s => {
            const texts = subColumns
              .map(c => ({ c, text: s.values[c.id]?.text?.trim() ?? '' }))
              .filter(({ text }) => text)
              .slice(0, 3)
              .map(({ c, text }) => (c.type === 'numbers' && /^\d+$/.test(text) ? formatInt(Number(text)) : text));
            return { key: s.id, name: s.name, meta: texts.join(' · ') || undefined };
          }),
        }
      : null;

  return {
    title: item ? '항목 수정' : '새 항목',
    boardName: meta.name,
    itemName: item?.name ?? null,
    saveLabel: item ? '저장' : '만들기',
    name: form.name,
    setName: name => {
      setError(null);
      setForm(f => ({ ...f, name }));
    },
    nameChanged: !!item && nameChanged,
    group:
      meta.groups.length > 0
        ? {
            options: meta.groups.map(g => ({ value: g.id, label: g.title })),
            value: form.groupId,
            set: groupId => setForm(f => ({ ...f, groupId })),
            changed: !!item && groupChanged,
          }
        : null,
    statusField: statusColumn ? fieldOf(statusColumn) : null,
    noteFields: noteColumns.map(fieldOf),
    fields: order.map(fieldOf),
    setValue,
    setText: (field, text) => {
      const current = form.values[field.id] as string;
      setValue(field.id, field.kind === 'text' && field.phone && isPhoneLike(current) ? formatPhoneTyping(text) : text);
    },
    focusText: field => {
      if (field.kind === 'text' && field.phone && !(form.values[field.id] as string)) setValue(field.id, PHONE_PREFIX);
    },
    blurText: field => {
      if (field.kind === 'text' && field.phone && isPhonePrefixOnly(form.values[field.id] as string))
        setValue(field.id, '');
    },
    locked,
    webOnly,
    subitems,
    error,
    dirty,
    save: () => {
      const name = form.name.trim();
      if (!name) {
        setError('이름을 적어 주세요.');
        return false;
      }
      const columnsInput: Record<string, CellEdit> = Object.fromEntries(
        changedColumns.map(c => [c.id, { value: toEditValue(c, form.values[c.id]) }]),
      );
      if (item) {
        editItem(
          boardKey,
          item.itemId,
          {
            ...(nameChanged ? { name } : {}),
            ...(groupChanged ? { groupId: form.groupId } : {}),
            columns: columnsInput,
          },
          name,
        );
      } else {
        createItem(boardKey, { name, groupId: form.groupId || undefined, columns: columnsInput });
      }
      return true;
    },
  };
}

/** 연결 칸의 고를 것 — 가리키는 보드의 기록에서(웹 relation-picker). 캐시에 없는 연결은 Monday 화면 글자로 이름을 빌린다 */
export function useRelationOptions(
  boardKey: TechBoardKey,
  selected: readonly string[],
  fallbackText: string,
): { options: ChoiceOption[]; loading: boolean } {
  const { board } = useTechBoard(boardKey);
  return useMemo(() => {
    const records = (board?.records ?? []) as unknown as (Record<string, unknown> & {
      itemId: string;
      name: string;
    })[];
    const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
    const describe = (r: Record<string, unknown>): string | null => {
      switch (boardKey) {
        case 'parts':
          return [s(r.sku), s(r.category)].filter(Boolean).join(' · ') || null;
        case 'repair':
          return [s(r.device), stageLabel(s(r.stage))].filter(Boolean).join(' · ');
        case 'fieldService':
          return [s(r.region), stageLabel(s(r.stage))].filter(Boolean).join(' · ');
        case 'rentals':
          return [s(r.serialNumber), s(r.status)].filter(Boolean).join(' · ') || null;
        default:
          return stageLabel(s(r.stage));
      }
    };
    const options: ChoiceOption[] = records.map(r => ({
      value: r.itemId,
      label: r.name || '(이름 없음)',
      sub: describe(r),
    }));
    const known = new Set(options.map(o => o.value));
    const names = fallbackText.split(', ');
    const missing = selected
      .filter(id => !known.has(id))
      .map((id, i) => ({ value: id, label: names[i] ?? `#${id}`, sub: '다른 보드 기록' }));
    return { options: [...missing, ...options], loading: !board };
  }, [board, boardKey, selected, fallbackText]);
}
