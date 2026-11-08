import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, SectionList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowDownUp,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleUserRound,
  CloudOff,
  Filter,
  Search,
  X,
} from 'lucide-react-native';
import { groupColor } from '@xtool-core/monday-colors';
import { rowKey } from '@xtool-core/monday-values';
import type { BoardView, BoardViewSpec } from '@xtool-core/tech-views';
import { numberSum, type GroupBlock } from '../../../features/board-model';
import { useBoardView } from '../../../features/board-view';
import { cardColumns } from '../../../features/card-columns';
import {
  DELETE_CONFIRM_MESSAGE,
  useRecordSelection,
  useSelectionActions,
} from '../../../features/dashboard/record-rows';
import { deleteViewNow, duplicateSpec } from '../../../features/view-editor';
import type { RootScreenProps } from '../../../navigation/types';
import { MText } from '../parts/basics';
import { AddCard, GroupHeader, GroupSums, ItemCard } from '../parts/board-parts';
import {
  BoardSkeleton,
  EmptyState,
  MenuTitle,
  ScreenHeader,
  SearchField,
  Sheet,
  SheetRow,
  ToolbarSkeleton,
  ToolChip,
  UnderlineTabs,
} from '../parts/chrome';
import { ConfirmDialog } from '../parts/confirm';
import { MoveSheet } from '../parts/move-sheet';
import { MondayNumbers } from '../parts/numbers';
import { SelectionBar } from '../parts/selection-bar';
import { UpdatesSheet, type UpdatesTarget } from '../parts/updates-sheet';
import { ViewEditorSheet } from '../parts/view-editor';
import { FONT, INK, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';

// 보드 — 웹 Monday 표(monday-board.tsx)를 폰에 맞게: 머리(보드 이름) · 보기 탭(메뉴·"+") · 요약 줄 · 도구 줄(새로운 …·
// 검색·사람·조건·정렬·모두 접기·개수) · 그룹(색 제목, 접기, 상태 요약 막대) · 항목 카드 · 그룹 끝 "+ 추가"와 숫자 합계.
// 카드 말풍선은 업데이트 시트(화면 이동 없이). 카드를 길게 누르면 고르기(웹 체크) — 아래 고르기 막대에서 옮기기·지우기.
// 칸을 고치는 것은 항목 화면에서 한다.
// 동작(거르기·정렬·그룹·새 항목·보기)은 공용 훅(features/board-view·view-editor)이 한다.

type SheetKind = 'person' | 'sort' | 'new' | 'view' | null;
type ViewEditing = { view: BoardView | null; initial?: BoardViewSpec } | null;

export function BoardScreen({ route, navigation }: RootScreenProps<'Board'>) {
  const { boardKey } = route.params;
  const p = useMon();
  const s = useStyles(styles);
  const insets = useSafeAreaInsets();
  const v = useBoardView(boardKey);
  const { meta, metaLoaded, items, error } = v.state;
  const [searching, setSearching] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [editor, setEditor] = useState<ViewEditing>(null);
  const [deletingView, setDeletingView] = useState<BoardView | null>(null);
  const [updatesFor, setUpdatesFor] = useState<UpdatesTarget | null>(null);
  // 보기 메뉴에서 고른 다음 일(고치기·복제·지우기) — 메뉴 시트가 다 닫힌 뒤에 연다
  const next = useRef<(() => void) | null>(null);
  const afterMenu = (run: () => void) => {
    next.current = run;
    setSheet(null);
  };

  const onCard = cardColumns(boardKey, v.shownColumns);
  const numberColumns = v.shownColumns.filter(c => c.type === 'numbers');
  const groups = v.hideEmptyGroups ? v.allGroups.filter(g => g.items.length > 0) : v.allGroups;
  const sections = groups.map(g => ({ group: g, data: v.isCollapsed(g.id) ? [] : g.items }));

  // 고르기 — 웹 체크박스. 지운 항목은 저절로 빠진다
  const ids = useMemo(() => (items ?? []).map(rowKey), [items]);
  const selection = useRecordSelection(ids);
  const actions = useSelectionActions(boardKey, selection.selected, selection.clear);
  const selecting = selection.selected.size > 0;

  const blocked = Boolean(error && !items) || (metaLoaded && !meta);
  const ready = Boolean(meta && items);

  let body;
  if (error && !items) {
    body = <EmptyState card icon={CloudOff} text="보드를 불러오지 못했어요" sub={error} />;
  } else if (metaLoaded && !meta) {
    body = (
      <EmptyState
        card
        icon={CloudOff}
        text={`${v.label} 보드가 아직 동기화되지 않았어요`}
        sub="관리자 화면의 “지금 동기화”나 정기 동기화(하루 여섯 번)가 한 번 돌고 나면 여기에 보여요."
      />
    );
  } else if (!ready) {
    body = <BoardSkeleton />;
  } else {
    body = (
      <SectionList
        sections={sections}
        keyExtractor={item => rowKey(item)}
        stickySectionHeadersEnabled
        contentContainerStyle={[s.list, selecting && s.listSelecting]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        ListEmptyComponent={v.hideEmptyGroups ? <EmptyState text="조건에 맞는 항목이 없어요." /> : undefined}
        renderSectionHeader={({ section }) => {
          const groupIds = section.group.items.map(rowKey);
          const picked = groupIds.filter(id => selection.selected.has(id)).length;
          return (
            <GroupHeader
              title={section.group.title}
              color={section.group.color}
              count={section.group.items.length}
              open={!v.isCollapsed(section.group.id)}
              onToggle={() => v.toggleGroup(section.group.id)}
              battery={section.group.battery}
              check={
                selecting && groupIds.length > 0
                  ? {
                      checked: picked === groupIds.length,
                      mixed: picked > 0 && picked < groupIds.length,
                      onPress: () => selection.set(groupIds, picked < groupIds.length),
                    }
                  : undefined
              }
            />
          );
        }}
        renderItem={({ item, section }) => {
          const key = rowKey(item);
          return (
            <ItemCard
              name={v.nameOf(item)}
              color={(section.group as GroupBlock).color}
              columns={onCard}
              values={item.values}
              subitemCount={item.subitems?.length}
              updates={v.updatesOf(item)}
              onUpdates={() => setUpdatesFor({ boardKey, itemId: key, name: v.nameOf(item), count: v.updatesOf(item) })}
              faded={item.draft}
              picked={selection.selected.has(key)}
              selecting={selecting}
              onPress={() =>
                selecting ? selection.toggle(key) : navigation.navigate('Item', { boardKey, itemId: key })
              }
              onLongPress={() => selection.toggle(key)}
            />
          );
        }}
        renderSectionFooter={({ section }) =>
          v.isCollapsed(section.group.id) ? null : (
            <View>
              <AddCard label={v.noun} color={section.group.color} onAdd={name => v.addItem(section.group.id, name)} />
              <GroupSums
                sums={numberColumns.map(c => ({ id: c.id, title: c.title, total: numberSum(section.group.items, c) }))}
              />
            </View>
          )
        }
      />
    );
  }

  return (
    <View style={s.screen}>
      <ScreenHeader title={v.title} onBack={navigation.goBack} />
      <UnderlineTabs
        tabs={v.viewTabs}
        value={v.viewId}
        onChange={v.selectView}
        moreFor={value => value !== ''}
        onMore={() => setSheet('view')}
        onAdd={ready ? () => setEditor({ view: null }) : undefined}
      />
      {!blocked && <MondayNumbers boardKey={boardKey} />}
      {ready ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.toolbar}>
          <ToolChip primary label={`새로운 ${v.noun}`} onPress={() => setSheet('new')} />
          <ToolChip icon={Search} label="검색" on={searching || !!v.query} onPress={() => setSearching(!searching)} />
          <ToolChip
            icon={CircleUserRound}
            label={v.person ?? '사람'}
            on={!!v.person}
            onPress={() => setSheet('person')}
            trailing={
              v.person ? (
                <Pressable onPress={() => v.setPerson(null)} hitSlop={8} accessibilityLabel="사람 거르기 해제">
                  <X size={12} color={p.text} />
                </Pressable>
              ) : null
            }
          />
          {v.view && (
            <ToolChip
              icon={Filter}
              label={v.readyRules > 0 ? `조건 / ${v.readyRules}` : '조건'}
              on={v.readyRules > 0}
              onPress={() => setEditor({ view: v.view })}
            />
          )}
          <ToolChip icon={ArrowDownUp} label={v.sortLabel} on={!!v.sort} onPress={() => setSheet('sort')} />
          <ToolChip
            icon={v.allCollapsed ? ChevronsUpDown : ChevronsDownUp}
            label={v.allCollapsed ? '모두 펼치기' : '모두 접기'}
            onPress={v.toggleAll}
          />
          <MText size={13} color={p.text2} style={s.count}>
            {v.searching ? `${v.filtered.length}개 찾음` : `${v.filtered.length}개 항목`}
          </MText>
        </ScrollView>
      ) : (
        !blocked && <ToolbarSkeleton />
      )}
      {ready && (searching || !!v.query) && (
        <View style={s.search}>
          <SearchField
            value={v.query}
            onChange={v.setQuery}
            placeholder="이 보드에서 검색"
            onClose={() => setSearching(false)}
          />
        </View>
      )}
      {body}

      {selecting && (
        <SelectionBar
          count={actions.count}
          noun={v.noun}
          bottom={insets.bottom + 16}
          onMove={actions.openMove}
          onDelete={actions.askDelete}
          onClose={selection.clear}
        />
      )}
      <MoveSheet
        visible={actions.moving}
        groups={(meta?.groups ?? []).map((g, i) => ({ id: g.id, title: g.title, color: groupColor(i) }))}
        onPick={actions.move}
        onClose={actions.closeMove}
      />
      <ConfirmDialog
        open={actions.confirming}
        title={`${actions.count}건을 지울까요?`}
        message={DELETE_CONFIRM_MESSAGE}
        confirmLabel="삭제"
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />

      <Sheet visible={sheet === 'person'} onClose={() => setSheet(null)}>
        <MenuTitle>담당자로 거르기</MenuTitle>
        <ScrollView contentContainerStyle={s.sheetList}>
          {v.people.length === 0 && <EmptyState text="사람 칸이 없는 보드예요" />}
          {v.people.map(([name, n]) => (
            <SheetRow
              key={name}
              label={name}
              on={v.person === name}
              onPress={() => {
                v.setPerson(v.person === name ? null : name);
                setSheet(null);
              }}
              right={
                <MText size={12} color={p.text2}>
                  {n}
                </MText>
              }
            />
          ))}
        </ScrollView>
      </Sheet>

      <Sheet visible={sheet === 'sort'} onClose={() => setSheet(null)}>
        <MenuTitle>정렬 — 한 번 더 누르면 반대로</MenuTitle>
        <ScrollView contentContainerStyle={s.sheetList}>
          {v.sortChoices.map(c => (
            <SheetRow
              key={c.id}
              label={c.title}
              on={v.sort?.columnId === c.id}
              onPress={() => v.pickSort(c.id)}
              right={
                v.sort?.columnId === c.id ? (
                  <MText size={12} color={p.text2}>
                    {v.sort.dir === 1 ? '오름차순' : '내림차순'}
                  </MText>
                ) : null
              }
            />
          ))}
        </ScrollView>
        {v.sort && (
          <Pressable
            onPress={() => {
              v.clearSort();
              setSheet(null);
            }}
            style={({ pressed }) => [s.sheetFooter, pressed && { backgroundColor: p.overlay }]}
          >
            <MText color={p.link}>정렬 해제</MText>
          </Pressable>
        )}
      </Sheet>

      <Sheet
        visible={sheet === 'view'}
        onClose={() => setSheet(null)}
        onDismissed={() => {
          const run = next.current;
          next.current = null;
          run?.();
        }}
      >
        {v.view && (
          <View style={s.sheetList}>
            <ViewMenu
              view={v.view}
              onEdit={view => afterMenu(() => setEditor({ view }))}
              onDuplicate={view => afterMenu(() => setEditor({ view: null, initial: duplicateSpec(view) }))}
              onDelete={view => afterMenu(() => setDeletingView(view))}
            />
          </View>
        )}
      </Sheet>
      <ConfirmDialog
        open={deletingView !== null}
        title={`"${deletingView?.name ?? ''}" 보기를 지울까요?`}
        message="기술팀 모두의 보드에서 이 보기 탭이 사라져요. 항목은 그대로예요."
        confirmLabel="지우기"
        onCancel={() => setDeletingView(null)}
        onConfirm={() => {
          const target = deletingView;
          setDeletingView(null);
          if (!target) return;
          v.selectView('');
          deleteViewNow(target);
        }}
      />
      {editor && meta && items && (
        <ViewEditorSheet
          boardKey={boardKey}
          meta={meta}
          items={items}
          view={editor.view}
          initial={editor.initial}
          onClose={() => setEditor(null)}
          onSaved={id => {
            setEditor(null);
            v.selectView(id);
          }}
          onDeleted={() => {
            setEditor(null);
            v.selectView('');
          }}
        />
      )}

      <NewItemSheet
        visible={sheet === 'new'}
        onClose={() => setSheet(null)}
        noun={v.noun}
        groups={v.allGroups.filter(g => meta?.groups.some(m => m.id === g.id))}
        onCreate={v.create}
      />
      <UpdatesSheet target={updatesFor} onClose={() => setUpdatesFor(null)} />
    </View>
  );
}

/** 보기 탭 메뉴(웹 .mon-viewtab__more) — 보기 고치기 · 복제하기 · 보기 지우기(위험 글자) */
function ViewMenu({
  view,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  view: BoardView;
  onEdit: (view: BoardView) => void;
  onDuplicate: (view: BoardView) => void;
  onDelete: (view: BoardView) => void;
}) {
  return (
    <>
      <SheetRow label="보기 고치기" onPress={() => onEdit(view)} />
      <SheetRow label="복제하기" onPress={() => onDuplicate(view)} />
      <SheetRow label="보기 지우기" danger onPress={() => onDelete(view)} />
    </>
  );
}

/** 새 항목 — 이름과 그룹(진행 단계)만 정하면 그룹 맨 아래에 바로 생긴다(웹 "+ 추가" 줄과 같은 저장). */
function NewItemSheet({
  visible,
  onClose,
  noun,
  groups,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  noun: string;
  groups: GroupBlock[];
  onCreate: (name: string, groupId: string) => void;
}) {
  const p = useMon();
  const s = useStyles(styles);
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const chosen = groupId ?? groups[0]?.id ?? null;
  const submit = () => {
    if (!name.trim() || !chosen) return;
    onCreate(name.trim(), chosen);
    setName('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={`새로운 ${noun}`}>
      <View style={s.form}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={`+ ${noun} 추가`}
          placeholderTextColor={p.text2}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          keyboardAppearance={p.scheme}
          style={s.input}
        />
        <MText size={12} color={p.text2}>
          어느 그룹에 넣을까요
        </MText>
        <ScrollView style={s.groupPick} contentContainerStyle={s.groupPickInner}>
          {groups.map(g => (
            <SheetRow
              key={g.id}
              label={g.title}
              on={chosen === g.id}
              onPress={() => setGroupId(g.id)}
              left={<View style={[s.dot, { backgroundColor: g.color }]} />}
              right={chosen === g.id ? <Check size={14} color={p.link} /> : null}
            />
          ))}
        </ScrollView>
        <Pressable
          onPress={submit}
          disabled={!name.trim()}
          style={({ pressed }) => [
            s.primary,
            { opacity: name.trim() ? 1 : 0.45 },
            pressed && { backgroundColor: p.primaryHi },
          ]}
        >
          <MText color={INK}>만들기</MText>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = (p: MonPalette) => ({
  screen: { flex: 1, backgroundColor: p.bg },
  toolbar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 4, alignItems: 'center' as const },
  count: { marginLeft: 8 },
  search: { paddingHorizontal: 16, paddingTop: 6 },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  listSelecting: { paddingBottom: 200 },
  sheetList: { paddingHorizontal: 8, paddingBottom: 8 },
  sheetFooter: { borderTopWidth: 1, borderColor: p.line, paddingVertical: 12, paddingHorizontal: 20 },
  form: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: p.primary,
    borderRadius: 4,
    paddingHorizontal: 12,
    fontFamily: FONT.medium,
    fontSize: 15,
    color: p.text,
    backgroundColor: p.bg,
  },
  groupPick: { maxHeight: 240 },
  groupPickInner: { gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 3 },
  primary: {
    height: 44,
    borderRadius: 4,
    backgroundColor: p.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
