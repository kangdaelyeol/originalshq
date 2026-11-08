import { useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react-native';
import type { TechColumn, TechSubitemDoc } from '@xtool-core/tech-boards';
import { cellEditorKind, checkCommit } from '../../../features/cell-edit';
import { DELETE_CONFIRM_MESSAGE } from '../../../features/dashboard/record-rows';
import type { SubitemModel } from '../../../features/item-view';
import type { MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';
import { MText, withAlpha } from './basics';
import { AddCard } from './board-parts';
import { CellValue } from './cell-value';
import { Sheet, SheetRow } from './chrome';
import { ConfirmDialog } from './confirm';
import { CellEditorSheet, TextSheet } from './editors';

// 하위 아이템(출장 설치 품목·AS 청구 부품) — 웹 monday-subitems처럼 왼쪽 줄기에서 줄마다 둥글게 꺾인 가지가 나오고, 맨
// 아래 "+ 품목명 추가". 줄은 이름(누르면 바꾸기 — 부품 연결 칸이 있는 보드는 부품을 따라가서 못 바꾼다)과 "⋯"(이름 바꾸기·
// 삭제), 아래에 칸들(누르면 항목 칸처럼 고친다 — 품명은 서버가 맞춘다). 만드는 중인 줄은 다 만들어질 때까지 보기만.

export function SubitemsBlock({
  model,
  subitems,
  color,
  label,
}: {
  model: SubitemModel;
  subitems: TechSubitemDoc[];
  /** 그룹 색 — 줄 왼쪽 막대(45%) */
  color: string;
  /** 묶음 이름(설치 품목 …) */
  label: string;
}) {
  const p = useMon();
  const s = useStyles(styles);
  const [menu, setMenu] = useState<TechSubitemDoc | null>(null);
  const [renaming, setRenaming] = useState<{ sub: TechSubitemDoc; text: string } | null>(null);
  const [removing, setRemoving] = useState<TechSubitemDoc | null>(null);
  const [editing, setEditing] = useState<{ sub: TechSubitemDoc; column: TechColumn } | null>(null);
  const editingKind = editing ? cellEditorKind(editing.column) : null;
  // 메뉴에서 고른 다음 일(이름 바꾸기·지울지 묻기) — 메뉴 시트가 다 닫힌 뒤에 연다
  const next = useRef<(() => void) | null>(null);
  const after = (sub: TechSubitemDoc, run: (sub: TechSubitemDoc) => void) => {
    next.current = () => run(sub);
    setMenu(null);
  };

  const pressCell = (sub: TechSubitemDoc, column: TechColumn) => {
    const kind = cellEditorKind(column);
    if (!kind || kind === 'file') return;
    if (kind === 'check') model.commitCell(sub, column, checkCommit(column, sub.values[column.id]));
    else setEditing({ sub, column });
  };

  return (
    <View style={s.wrap}>
      <MText size={13} color={p.text2} style={s.label}>
        {label} {subitems.length}
      </MText>
      {subitems.map(sub => {
        const draft = model.isDraft(sub);
        const rename = model.canRename(sub);
        return (
          <Branch key={sub.id}>
            <View style={[s.row, draft && s.draft]}>
              <View style={[s.bar, { backgroundColor: withAlpha(color, 0.45) }]} />
              <View style={s.rowBody}>
                <View style={s.nameLine}>
                  <Pressable
                    onPress={() => setRenaming({ sub, text: sub.name })}
                    disabled={!rename}
                    style={s.flex}
                    accessibilityHint={
                      draft ? '만드는 중이에요' : model.relationId ? '부품을 고르면 이름이 따라가요' : undefined
                    }
                  >
                    <MText size={13.5} numberOfLines={1}>
                      {sub.name}
                    </MText>
                  </Pressable>
                  {!draft && (
                    <Pressable
                      onPress={() => setMenu(sub)}
                      hitSlop={6}
                      accessibilityLabel={`${sub.name} 메뉴`}
                      style={({ pressed }) => [s.more, pressed && { backgroundColor: p.overlay }]}
                    >
                      <Ellipsis size={16} color={p.text2} />
                    </Pressable>
                  )}
                </View>
                {model.columns.length > 0 && (
                  <View style={s.cells}>
                    {model.columns.map(c => {
                      const editable = model.canEdit(sub, c);
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => pressCell(sub, c)}
                          disabled={!editable}
                          accessibilityHint={editable ? undefined : model.lockedText(sub, c) ?? undefined}
                          style={({ pressed }) => [s.cell, pressed && { backgroundColor: p.hover }]}
                        >
                          <MText size={11} color={p.text2} numberOfLines={1}>
                            {c.title}
                          </MText>
                          <CellValue column={c} cell={sub.values[c.id]} mode="card" />
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          </Branch>
        );
      })}
      <Branch last>
        <AddCard label={model.nameTitle} color={color} onAdd={model.add} compact />
      </Branch>

      <Sheet
        visible={menu !== null}
        onClose={() => setMenu(null)}
        title={menu?.name}
        onDismissed={() => {
          const run = next.current;
          next.current = null;
          run?.();
        }}
      >
        {menu && (
          <View style={s.menu}>
            {model.canRename(menu) && (
              <SheetRow
                label="이름 바꾸기"
                left={<Pencil size={15} color={p.text} />}
                onPress={() => after(menu, sub => setRenaming({ sub, text: sub.name }))}
              />
            )}
            <SheetRow
              label="삭제"
              left={<Trash2 size={15} color={p.text} />}
              onPress={() => after(menu, setRemoving)}
            />
          </View>
        )}
      </Sheet>

      {renaming && (
        <TextSheet
          title={model.nameTitle}
          value={renaming.text}
          onChangeText={text => setRenaming({ ...renaming, text })}
          onDone={() => {
            model.rename(renaming.sub, renaming.text);
            setRenaming(null);
          }}
          onCancel={() => setRenaming(null)}
        />
      )}

      {editing && editingKind && editingKind !== 'check' && editingKind !== 'file' && (
        <CellEditorSheet
          // 다른 칸을 열면 새로 그린다(처음 값을 그 칸으로 다시 잡게)
          key={`${editing.sub.id}:${editing.column.id}`}
          kind={editingKind}
          column={editing.column}
          cell={editing.sub.values[editing.column.id]}
          single={editing.column.id === model.relationId}
          onCommit={commit => model.commitCell(editing.sub, editing.column, commit)}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        title={`'${removing?.name ?? ''}' 줄을 지울까요?`}
        message={DELETE_CONFIRM_MESSAGE}
        confirmLabel="삭제"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) model.remove(removing);
          setRemoving(null);
        }}
      />
    </View>
  );
}

/** 줄기와 가지 — 줄마다 위에서 내려오는 줄기(마지막 줄은 가지까지만)와 둥글게 꺾여 줄로 들어가는 가지(반경 8) */
function Branch({ children, last }: { children: ReactNode; last?: boolean }) {
  const s = useStyles(styles);
  return (
    <View style={s.branchRow}>
      {!last && <View style={s.trunk} />}
      <View style={s.elbow} />
      <View style={s.flex}>{children}</View>
    </View>
  );
}

const TRUNK_X = 9;
const ELBOW_Y = 17;

const styles = (p: MonPalette) => ({
  wrap: { marginTop: 20 },
  label: { marginBottom: 8 },
  flex: { flex: 1 },
  branchRow: { flexDirection: 'row' as const, paddingLeft: 24, paddingBottom: 6 },
  trunk: {
    position: 'absolute' as const,
    left: TRUNK_X,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: p.lineStrong,
  },
  elbow: {
    position: 'absolute' as const,
    left: TRUNK_X,
    top: 0,
    width: 24 - TRUNK_X,
    height: ELBOW_Y,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: p.lineStrong,
    borderBottomLeftRadius: 8,
  },
  row: {
    flexDirection: 'row' as const,
    backgroundColor: p.cell,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 6,
    overflow: 'hidden' as const,
  },
  draft: { opacity: 0.6 },
  bar: { width: 6 },
  rowBody: { flex: 1, paddingLeft: 10, paddingRight: 4, paddingVertical: 6, gap: 6 },
  nameLine: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, minHeight: 22 },
  more: { width: 26, height: 26, borderRadius: 4, alignItems: 'center' as const, justifyContent: 'center' as const },
  cells: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, paddingRight: 6, paddingBottom: 2 },
  cell: {
    minWidth: 72,
    maxWidth: '100%' as const,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 4,
    gap: 2,
  },
  menu: { paddingHorizontal: 8, paddingBottom: 4 },
});
