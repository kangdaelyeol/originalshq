import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { mondayDate, PHONE_IN_NAME_BOARDS, rowKey, splitNamePhone } from '@xtool-core/monday-values';
import { SUBITEM_LABEL } from '@xtool-core/tech-subitems';
import { formatPhone } from '@xtool-core/tech-stage';
import type { TechBoardKey, TechBoardMeta, TechItemDoc } from '@xtool-core/tech-boards';
import type { BoardView, BoardViewSpec } from '@xtool-core/tech-views';
import { numberSum, type GroupBlock } from '../../../features/board-model';
import { useBoardView } from '../../../features/board-view';
import { cardLayout, type CardLayout } from '../../../features/card-columns';
import { subitemLines } from '../../../features/subitem-lines';
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
import { SelectionBar } from '../parts/selection-bar';
import { UpdatesSheet, type UpdatesTarget } from '../parts/updates-sheet';
import { ViewEditorSheet } from '../parts/view-editor';
import { FONT, INK, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';

// 보드 — 웹 Monday 표(monday-board.tsx)를 폰에 맞게: 머리(보드 이름) · 보기 탭(메뉴·"+") · 도구 줄(새로운 …·
// 검색·사람·조건·정렬·모두 접기·개수) · 그룹(색 제목, 접기, 그룹 색 선) · 항목 카드 · 그룹 끝 "+ 추가"와 숫자 합계.
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

  // 카드 모양 — 보드마다(card-columns cardLayout): 둘째 줄 미니 칸·이름 옆 전화번호·오른쪽 아래 날짜·하위 아이템 단추
  const layout = useMemo(() => cardLayout(boardKey, v.shownColumns), [boardKey, v.shownColumns]);
  // 하위 아이템 목록 시트("설치 품목 N개" 단추) — 연 카드의 줄 열쇠
  const [subitemsFor, setSubitemsFor] = useState<string | null>(null);
  const openSubitems = useCallback((key: string) => setSubitemsFor(key), []);
  const numberColumns = v.shownColumns.filter(c => c.type === 'numbers');
  const groups = v.hideEmptyGroups ? v.allGroups.filter(g => g.items.length > 0) : v.allGroups;
  const sections = groups.map(g => ({ group: g, data: v.isCollapsed(g.id) ? [] : g.items }));

  // 고르기 — 웹 체크박스. 지운 항목은 저절로 빠진다
  const ids = useMemo(() => (items ?? []).map(rowKey), [items]);
  const selection = useRecordSelection(ids);
  const actions = useSelectionActions(boardKey, selection.selected, selection.clear);
  const selecting = selection.selected.size > 0;

  // 카드 누르기 — 카드(BoardCard, memo)에 늘 같은 함수를 넘겨, 하나를 고르거나 저장해도 바뀐 카드만 다시 그린다
  const latest = useRef({ selecting, toggle: selection.toggle });
  useEffect(() => {
    latest.current = { selecting, toggle: selection.toggle };
  });
  const openCard = useCallback(
    (key: string) =>
      latest.current.selecting ? latest.current.toggle(key) : navigation.navigate('Item', { boardKey, itemId: key }),
    [navigation, boardKey],
  );
  const pickCard = useCallback((key: string) => latest.current.toggle(key), []);
  const openUpdates = useCallback(
    (key: string, name: string, count?: number) => setUpdatesFor({ boardKey, itemId: key, name, count }),
    [boardKey],
  );

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
  } else if (!ready || !v.prefsReady) {
    // 남긴 접힘을 읽기 전에는 그리지 않는다 — 다 펼쳐 그렸다가 다시 접지 않게
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
        // 미리 그리는 양 — 기본(앞뒤 화면 10장씩)은 폰에서 너무 많다. 처음엔 화면 한 장 남짓, 앞뒤 4장씩
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={9}
        ListEmptyComponent={v.hideEmptyGroups ? <EmptyState text="조건에 맞는 항목이 없어요." /> : undefined}
        renderSectionHeader={({ section }) => {
          // 그룹 체크는 고르는 중에만 — 그때만 그룹의 항목 id를 센다
          const groupIds = selecting ? section.group.items.map(rowKey) : [];
          const picked = groupIds.filter(id => selection.selected.has(id)).length;
          return (
            <GroupHeader
              title={section.group.title}
              color={section.group.color}
              count={section.group.items.length}
              open={!v.isCollapsed(section.group.id)}
              onToggle={() => v.toggleGroup(section.group.id)}
              rule
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
        renderItem={({ item, section }) => (
          <BoardCard
            item={item}
            boardKey={boardKey}
            name={v.nameOf(item)}
            color={(section.group as GroupBlock).color}
            layout={layout}
            onSubitems={openSubitems}
            updates={v.updatesOf(item)}
            picked={selection.selected.has(rowKey(item))}
            selecting={selecting}
            onOpen={openCard}
            onPick={pickCard}
            onUpdates={openUpdates}
          />
        )}
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
      {ready ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.toolbarScroll}
          contentContainerStyle={s.toolbar}
        >
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
      <SubitemsSheet
        boardKey={boardKey}
        meta={meta}
        item={subitemsFor ? ((items ?? []).find(i => rowKey(i) === subitemsFor) ?? null) : null}
        name={(() => {
          const item = subitemsFor ? (items ?? []).find(i => rowKey(i) === subitemsFor) : undefined;
          return item ? v.nameOf(item) : '';
        })()}
        onClose={() => setSubitemsFor(null)}
        onOpenItem={key => {
          setSubitemsFor(null);
          navigation.navigate('Item', { boardKey, itemId: key });
        }}
      />
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

/** 보드 카드 한 장 — props가 같으면 다시 그리지 않는다(누르기 함수는 화면이 늘 같은 것을 넘긴다). 모양은 보드별
 * 카드 모양(layout)을 따른다 — 출장업무: 이름 옆 전화번호, 오른쪽 아래 접수일, "설치 품목 N개" 단추, 상태 칸 없음. */
const BoardCard = memo(function BoardCard({
  item,
  boardKey,
  name,
  color,
  layout,
  updates,
  picked,
  selecting,
  onOpen,
  onPick,
  onUpdates,
  onSubitems,
}: {
  item: TechItemDoc;
  boardKey: TechBoardKey;
  name: string;
  color: string;
  layout: CardLayout;
  updates?: number;
  picked: boolean;
  selecting: boolean;
  onOpen: (key: string) => void;
  onPick: (key: string) => void;
  onUpdates: (key: string, name: string, count?: number) => void;
  onSubitems: (key: string) => void;
}) {
  const p = useMon();
  const key = rowKey(item);
  // 전화번호 — 전화번호 칸, 비었으면 이름에 적힌 번호(출장업무는 이름 뒤에 번호를 적는다)
  const phoneText = layout.phone ? (item.values[layout.phone.id]?.text ?? '').trim() : '';
  const phone = layout.phone
    ? formatPhone(phoneText) ??
      (phoneText || (PHONE_IN_NAME_BOARDS.has(boardKey) ? splitNamePhone(item.name).phones : '')) ??
      null
    : null;
  const cornerText = layout.corner ? (item.values[layout.corner.id]?.text ?? '').trim() : '';
  const subitemLabel = layout.subitemButton ? SUBITEM_LABEL[boardKey] ?? '하위 아이템' : null;
  return (
    <ItemCard
      name={name}
      color={color}
      columns={layout.columns}
      values={item.values}
      subitemCount={item.subitems?.length}
      phone={phone || null}
      corner={
        cornerText ? (
          <MText size={12} color={p.text2}>
            접수 {mondayDate(cornerText)}
          </MText>
        ) : null
      }
      subitemButton={
        subitemLabel ? { label: subitemLabel, onPress: selecting ? undefined : () => onSubitems(key) } : null
      }
      updates={updates}
      onUpdates={() => onUpdates(key, name, updates)}
      faded={item.draft}
      picked={picked}
      selecting={selecting}
      onPress={() => onOpen(key)}
      onLongPress={() => onPick(key)}
    />
  );
});

/** 하위 아이템 간단 목록(카드의 "설치 품목 N개") — 품명·비고만, 아래에 항목 열기 */
function SubitemsSheet({
  boardKey,
  meta,
  item,
  name,
  onClose,
  onOpenItem,
}: {
  boardKey: TechBoardKey;
  meta: TechBoardMeta | null;
  item: TechItemDoc | null;
  name: string;
  onClose: () => void;
  onOpenItem: (key: string) => void;
}) {
  const p = useMon();
  const s = useStyles(styles);
  const label = SUBITEM_LABEL[boardKey] ?? '하위 아이템';
  const lines = item ? subitemLines(meta, item) : [];
  return (
    <Sheet visible={item !== null} onClose={onClose} title={name ? `${name} · ${label}` : label}>
      <View style={s.subList}>
        {lines.length === 0 ? (
          <MText size={14} color={p.text2}>
            {label}이 없어요.
          </MText>
        ) : (
          lines.map((line, i) => (
            <View key={line.id} style={[s.subRow, i > 0 && s.subRowLine]}>
              <MText size={15}>{line.title}</MText>
              {!!line.note && (
                <MText size={13} color={p.text2}>
                  {line.note}
                </MText>
              )}
            </View>
          ))
        )}
      </View>
      {item && <SheetRow label="항목 열기" onPress={() => onOpenItem(rowKey(item))} />}
    </Sheet>
  );
}

const styles = (p: MonPalette) => ({
  // 하위 아이템 목록 시트
  subList: { paddingHorizontal: 16, paddingBottom: 8 },
  subRow: { paddingVertical: 10, gap: 2 },
  subRowLine: { borderTopWidth: 1, borderColor: p.line },
  screen: { flex: 1, backgroundColor: p.bg },
  // 가로 스크롤은 세로로 늘어나지 않게(그대로 두면 남는 높이를 차지해 도구 줄이 아래로 밀린다)
  toolbarScroll: { flexGrow: 0 },
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
