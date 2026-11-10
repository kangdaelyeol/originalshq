import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import type { TechColumn, TechItemDoc } from '@xtool-core/tech-boards';
import { SUBITEM_LABEL } from '@xtool-core/tech-subitems';
import { timelineColumns } from '@xtool-core/tech-timeline';
import { checkCommit } from '../../../features/cell-edit';
import { useItemView, type ItemViewModel } from '../../../features/item-view';
import type { RootScreenProps } from '../../../navigation/types';
import { MText } from '../parts/basics';
import { UpdatesBubble } from '../parts/board-parts';
import { CellValue } from '../parts/cell-value';
import { EmptyState, ScreenHeader } from '../parts/chrome';
import { CellEditorSheet, TextSheet } from '../parts/editors';
import { FilesSheet } from '../parts/files';
import { MoveSheet } from '../parts/move-sheet';
import { SubitemsBlock } from '../parts/subitems';
import { UpdatesSheet } from '../parts/updates-sheet';
import { type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';

// 항목 — 웹 Monday 표에는 따로 상세가 없고(칸을 표에서 바로 고친다) 업데이트 패널만 있다. 폰에서는 표를 못 펼치니
// 항목 화면을 새로 둔다: 정보만(모든 칸, 웹 대시보드 상세 서랍의 이름·값 목록 모양). 업데이트는 머리의 말풍선 단추로
// 시트를 연다(출장업무·아톡문의만 — 보드 카드 말풍선과 같은 시트). 정보의 칸을 누르면 웹 Monday 칸 편집기를 시트로
// 연다(이름·그룹도). 하위 아이템과 파일 보기도 여기에. 동작(항목 찾기·편집기 고르기·저장)은 공용 훅(features/item-view·
// cell-edit)이 한다.

export function ItemScreen({ route, navigation }: RootScreenProps<'Item'>) {
  const { boardKey, itemId } = route.params;
  const s = useStyles(styles);
  const v = useItemView(boardKey, itemId);
  const { item, hasUpdates } = v;
  const [updates, setUpdates] = useState(false);

  if (!item || !v.state.meta) {
    return (
      <View style={s.screen}>
        <ScreenHeader title={v.name || '항목'} onBack={navigation.goBack} titleSize={24} />
        {v.state.items ? (
          <EmptyState text="이 항목을 찾지 못했어요 — 지워졌거나 다른 보드로 옮겨졌을 수 있어요." />
        ) : (
          <ActivityIndicator style={s.loading} />
        )}
      </View>
    );
  }

  const count = item.updateCount ?? 0;
  return (
    <View style={s.screen}>
      <ScreenHeader
        title={v.name}
        onBack={navigation.goBack}
        titleSize={24}
        right={hasUpdates ? <UpdatesBubble count={count} onPress={() => setUpdates(true)} /> : undefined}
      />
      <ItemInfo view={v} item={item} />
      <UpdatesSheet
        target={updates ? { boardKey, itemId: item.itemId, name: v.name, count } : null}
        onClose={() => setUpdates(false)}
      />
    </View>
  );
}

// ── 정보 ──────────────────────────────────────────────────────────────────

function ItemInfo({ view, item }: { view: ItemViewModel; item: TechItemDoc }) {
  const p = useMon();
  const s = useStyles(styles);
  const [editing, setEditing] = useState<TechColumn | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [files, setFiles] = useState<TechColumn | null>(null);
  const { group, sub } = view;
  const kind = editing ? view.editorOf(editing) : null;
  // 타임라인 칸(단계별 날짜·시간 추적) — 흩어진 칸을 아래 "타임라인" 구역에 단계 순서로 모은다(웹 상세와 같은 tech-timeline)
  const timeline = useMemo(() => timelineColumns(view.boardKey, view.columns), [view.boardKey, view.columns]);
  const rest = useMemo(() => {
    const ids = new Set(timeline.map(c => c.id));
    return view.columns.filter(c => !ids.has(c.id));
  }, [timeline, view.columns]);
  const fieldOf = (c: TechColumn) => {
    const editor = view.editorOf(c);
    return (
      <Field key={c.id} label={c.title} onPress={editor ? () => press(c) : undefined}>
        <CellValue column={c} cell={item.values[c.id]} mode="full" />
      </Field>
    );
  };

  // 칸 누르기 — 체크는 바로 바뀌고(웹과 같다), 파일은 파일 보기, 나머지는 편집 시트
  const press = (column: TechColumn) => {
    const editor = view.editorOf(column);
    if (editor === 'check') view.commitCell(column, checkCommit(column, item.values[column.id]));
    else if (editor === 'file') setFiles(column);
    else if (editor) setEditing(column);
  };

  return (
    <ScrollView
      contentContainerStyle={s.info}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Field label={view.nameTitle} onPress={() => setRenaming(view.name)}>
        <MText style={s.lineHeight}>{view.name}</MText>
      </Field>
      <Field label="그룹" onPress={view.groups.length > 0 ? () => setMoving(true) : undefined}>
        <View style={s.groupRow}>
          <View style={[s.dot, { backgroundColor: group?.color }]} />
          <MText color={group?.color}>{group?.title ?? '—'}</MText>
        </View>
      </Field>
      {rest.map(fieldOf)}
      {timeline.length > 0 && (
        <>
          <MText size={12} color={p.text2} style={s.section}>
            타임라인
          </MText>
          {timeline.map(fieldOf)}
        </>
      )}
      {sub && (
        <SubitemsBlock
          model={sub}
          subitems={item.subitems ?? []}
          color={group?.color ?? p.text2}
          label={SUBITEM_LABEL[view.boardKey] ?? sub.nameTitle}
        />
      )}

      {editing && kind && kind !== 'check' && kind !== 'file' && (
        <CellEditorSheet
          // 다른 칸을 열면 새로 그린다(처음 값을 그 칸으로 다시 잡게)
          key={editing.id}
          kind={kind}
          column={editing}
          cell={item.values[editing.id]}
          onCommit={commit => view.commitCell(editing, commit)}
          onClose={() => setEditing(null)}
        />
      )}
      {renaming !== null && (
        <TextSheet
          title={view.nameTitle}
          value={renaming}
          onChangeText={setRenaming}
          onDone={() => {
            view.rename(renaming);
            setRenaming(null);
          }}
          onCancel={() => setRenaming(null)}
        />
      )}
      <MoveSheet
        visible={moving}
        groups={view.groups}
        current={group?.id}
        onPick={groupId => {
          view.moveTo(groupId);
          setMoving(false);
        }}
        onClose={() => setMoving(false)}
      />
      {files && view.state.meta && (
        <FilesSheet
          title={files.title}
          itemName={view.name}
          meta={view.state.meta}
          item={item}
          onClose={() => setFiles(null)}
        />
      )}
    </ScrollView>
  );
}

/** 이름·값 한 줄 — 이름 13 흐린 글자(왼쪽 96pt), 값은 칸 모양 그대로. 누를 수 있으면 눌림 바탕 */
function Field({ label, children, onPress }: { label: string; children: ReactNode; onPress?: () => void }) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.field, pressed && { backgroundColor: p.overlay }]}
    >
      <MText size={13} color={p.text2} style={s.fieldLabel} numberOfLines={2}>
        {label}
      </MText>
      <View style={s.fieldValue}>{children}</View>
    </Pressable>
  );
}

const styles = (p: MonPalette) => ({
  screen: { flex: 1, backgroundColor: p.bg },
  loading: { marginTop: 40 },
  flex: { flex: 1 },
  lineHeight: { lineHeight: 21 },
  info: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 },
  field: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 50,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: p.line,
  },
  fieldLabel: { width: 96 },
  fieldValue: { flex: 1, minHeight: 28, justifyContent: 'center' as const },
  groupRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 3 },
  section: { marginTop: 18, marginBottom: 2, fontWeight: '600' as const, letterSpacing: 0.4 },
  sheetList: { paddingHorizontal: 8, paddingBottom: 8 },
});
