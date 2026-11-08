import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUpRight, CircleUserRound, Search } from 'lucide-react-native';
import { groupColor } from '@xtool-core/monday-colors';
import { ITEM_NOUN, PHONE_IN_NAME_BOARDS, rowKey, splitNamePhone, UPDATE_BOARDS } from '@xtool-core/monday-values';
import type { TechBoardKey } from '@xtool-core/tech-boards';
import { useTechBoard } from '@xtool-core/tech-boards-store';
import { BOARD_ICONS } from '../../../features/board-icons';
import { cardColumns } from '../../../features/card-columns';
import { DELETE_CONFIRM_MESSAGE } from '../../../features/dashboard/record-rows';
import { useMyWorkView, useWorkBox, WORK_STATES } from '../../../features/my-work-view';
import { useWorkSelection, type WorkSelection } from '../../../features/work-selection';
import { Avatar, MText } from '../parts/basics';
import { GroupHeader, ItemCard } from '../parts/board-parts';
import {
  BoardSkeleton,
  EmptyState,
  MenuTitle,
  ScreenHeader,
  SearchField,
  Sheet,
  SheetRow,
  SkeletonBlock,
  ToolChip,
  ToolTabs,
  UnderlineTabs,
} from '../parts/chrome';
import { ConfirmDialog } from '../parts/confirm';
import { MoveSheet } from '../parts/move-sheet';
import { SelectionBar } from '../parts/selection-bar';
import { MONDAY_ACCENT, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';

// 내 업무 — 웹 Monday 내 업무(monday-my-work.tsx)처럼 판 하나: 탭 줄은 "메인 테이블" 하나, 도구 줄에 누구의 업무인지
// (나 · 이름 — 늘 켜짐)·검색·상태 밑줄 탭(진행 중·완료·전체)·개수. 아래 보드마다 상자 하나(머리: 아이콘 칸·보드 이름·N건,
// 누르면 그 보드) 안에 그 보드의 그룹과 항목 카드. 새로운 …·보기 탭·"+ 추가"는 없다(웹과 같다). 카드를 길게 누르면
// 고르기 — 여러 보드에 걸쳐 고를 수 있고, 옮기기는 한 보드에서만 골랐을 때.
// 동작(누구의 업무·거르기·보드별 묶음·고르기)은 공용 훅(features/my-work-view·work-selection)이 한다.

const MAIN_TAB = [{ value: 'main', label: '메인 테이블' }] as const;

export function MyWorkScreen({ who, onBack }: { who?: string; onBack?: () => void }) {
  const p = useMon();
  const s = useStyles(styles);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const v = useMyWorkView(who);
  const { me, isTech, mine, viewing, setViewing, people, state, setState, query, setQuery, all, shown, loading } = v;
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);
  const selection = useWorkSelection();
  const selecting = selection.count > 0;

  return (
    <View style={s.screen}>
      <ScreenHeader title={v.title} onBack={onBack} />
      <UnderlineTabs tabs={MAIN_TAB} value="main" onChange={() => undefined} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.toolbar}>
        <ToolChip icon={CircleUserRound} label={v.personLabel} on onPress={() => setPicking(true)} />
        <ToolChip icon={Search} label="검색" on={searching || !!query} onPress={() => setSearching(!searching)} />
        <ToolTabs tabs={WORK_STATES} value={state} onChange={setState} style={s.states} />
        {loading ? (
          <SkeletonBlock width={72} height={10} style={s.count} />
        ) : (
          <MText size={13} color={p.text2} style={s.count}>
            {`${shown.length}개 항목${state !== 'all' ? ` · 전체 ${all.length}개` : ''}`}
          </MText>
        )}
      </ScrollView>
      {(searching || !!query) && (
        <View style={s.search}>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="담당 업무에서 검색"
            onClose={() => setSearching(false)}
          />
        </View>
      )}
      <ScrollView contentContainerStyle={[s.body, selecting && s.bodySelecting]} keyboardDismissMode="on-drag">
        {!loading && v.boxes.length === 0 && <EmptyState text="담당 업무가 없어요." />}
        {v.boxes.map(box => (
          <WorkBox
            key={box.boardKey}
            boardKey={box.boardKey}
            label={box.label}
            itemIds={box.items.map(i => i.itemId)}
            needle={v.needle}
            selection={selection}
            onOpenBoard={() => navigation.navigate('Board', { boardKey: box.boardKey })}
            onOpenItem={itemId => navigation.navigate('Item', { boardKey: box.boardKey, itemId })}
          />
        ))}
        {/* 아직 안 온 보드 자리 — 하나도 안 왔으면 상자 둘(5·3줄), 몇 개 왔으면 아래에 하나(3줄) */}
        {loading && (v.boxes.length === 0 ? [5, 3] : [3]).map((rows, i) => <WorkBoxSkeleton key={i} rows={rows} />)}
      </ScrollView>

      {selecting && (
        <SelectionBar
          count={selection.count}
          noun={selection.moveBoard ? ITEM_NOUN[selection.moveBoard] : '항목'}
          bottom={(onBack ? insets.bottom : 0) + 16}
          onMove={selection.moveBoard ? selection.openMove : undefined}
          onDelete={selection.askDelete}
          onClose={selection.clear}
        />
      )}
      {selection.moveBoard && (
        <WorkMoveSheet
          boardKey={selection.moveBoard}
          visible={selection.moving}
          onPick={selection.move}
          onClose={selection.closeMove}
        />
      )}
      <ConfirmDialog
        open={selection.confirming}
        title={`${selection.count}건을 지울까요?`}
        message={DELETE_CONFIRM_MESSAGE}
        confirmLabel="삭제"
        onCancel={selection.cancelDelete}
        onConfirm={selection.confirmDelete}
      />

      <Sheet visible={picking} onClose={() => setPicking(false)}>
        <MenuTitle>누구의 업무를 볼까요</MenuTitle>
        <ScrollView contentContainerStyle={s.sheetList}>
          {isTech && (
            <SheetRow
              label={`나 · ${me.name ?? ''}`}
              on={mine}
              left={<Avatar name={me.name ?? '나'} size={26} color={MONDAY_ACCENT} />}
              onPress={() => {
                setViewing(null);
                setPicking(false);
              }}
              right={<Count n={v.myOpen} />}
            />
          )}
          {people
            .filter(x => !me.names.has(x.name))
            .map(x => (
              <SheetRow
                key={x.name}
                label={x.name}
                on={!mine && viewing === x.name}
                left={<Avatar name={x.name} size={26} />}
                onPress={() => {
                  setViewing(x.name);
                  setPicking(false);
                }}
                right={<Count n={x.open} />}
              />
            ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

function Count({ n }: { n: number }) {
  const p = useMon();
  return n > 0 ? (
    <MText size={11} color={p.text4}>
      {n}
    </MText>
  ) : null;
}

/** 옮길 그룹 — 고른 것이 한 보드에만 있을 때 그 보드의 그룹 */
function WorkMoveSheet({
  boardKey,
  visible,
  onPick,
  onClose,
}: {
  boardKey: TechBoardKey;
  visible: boolean;
  onPick: (groupId: string) => void;
  onClose: () => void;
}) {
  const { meta } = useTechBoard(boardKey);
  const groups = useMemo(
    () => (meta?.groups ?? []).map((g, i) => ({ id: g.id, title: g.title, color: groupColor(i) })),
    [meta],
  );
  return <MoveSheet visible={visible} groups={groups} onPick={onPick} onClose={onClose} />;
}

/** 보드 상자 — 머리(아이콘 칸 28·이름 18·N건, 누르면 그 보드) + 그 보드의 그룹과 카드(웹 .mon-workbox) */
function WorkBox({
  boardKey,
  label,
  itemIds,
  needle,
  selection,
  onOpenBoard,
  onOpenItem,
}: {
  boardKey: TechBoardKey;
  label: string;
  itemIds: string[];
  needle: string;
  selection: WorkSelection;
  onOpenBoard: () => void;
  onOpenItem: (itemId: string) => void;
}) {
  const p = useMon();
  const s = useStyles(styles);
  const key = itemIds.join(',');
  // 같은 항목 목록이면 같은 집합 — 렌더마다 새로 만들어 상자를 다시 계산하지 않게
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ids = useMemo(() => new Set(itemIds), [key]);
  const { meta, columns, items: mine, groups } = useWorkBox(boardKey, ids, needle);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const onCard = useMemo(() => cardColumns(boardKey, columns), [boardKey, columns]);
  if (!meta || mine.length === 0) return null;
  const Icon = BOARD_ICONS[boardKey];
  const selecting = selection.count > 0;

  return (
    <View style={s.box}>
      <Pressable onPress={onOpenBoard} style={({ pressed }) => [s.boxHead, pressed && { backgroundColor: p.hover }]}>
        <View style={s.iconTile}>
          <Icon size={16} strokeWidth={2} color={p.iconInk} />
        </View>
        <MText size={18} numberOfLines={1} style={s.boxTitle}>
          {label}
        </MText>
        <MText size={13} color={p.text2}>
          {mine.length}건
        </MText>
        <View style={s.flex} />
        <ArrowUpRight size={15} color={p.text2} />
      </Pressable>
      <View style={s.boxBody}>
        {groups.map(g => {
          const open = !collapsed.includes(g.id);
          const groupIds = g.items.map(rowKey);
          const picked = groupIds.filter(id => selection.has(boardKey, id)).length;
          return (
            <View key={g.id}>
              <GroupHeader
                title={g.title}
                color={g.color}
                count={g.items.length}
                open={open}
                onToggle={() => setCollapsed(open ? [...collapsed, g.id] : collapsed.filter(x => x !== g.id))}
                background={p.workbox}
                check={
                  selecting
                    ? {
                        checked: picked === groupIds.length,
                        mixed: picked > 0 && picked < groupIds.length,
                        onPress: () => selection.set(boardKey, groupIds, picked < groupIds.length),
                      }
                    : undefined
                }
              />
              {open &&
                g.items.map(item => {
                  const id = rowKey(item);
                  return (
                    <ItemCard
                      key={id}
                      name={PHONE_IN_NAME_BOARDS.has(boardKey) ? splitNamePhone(item.name).label : item.name}
                      color={g.color}
                      columns={onCard}
                      values={item.values}
                      subitemCount={item.subitems?.length}
                      updates={UPDATE_BOARDS.has(boardKey) ? item.updateCount ?? 0 : undefined}
                      picked={selection.has(boardKey, id)}
                      selecting={selecting}
                      onPress={() => (selecting ? selection.toggle(boardKey, id) : onOpenItem(id))}
                      onLongPress={() => selection.toggle(boardKey, id)}
                    />
                  );
                })}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** 상자 뼈대 — 머리(아이콘 칸·이름·건수 블록)와 그룹 하나(rows장) */
function WorkBoxSkeleton({ rows }: { rows: number }) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    <View style={s.box}>
      <View style={s.boxHead}>
        <SkeletonBlock width={28} height={28} radius={6} />
        <SkeletonBlock width={120} height={16} radius={8} />
        <SkeletonBlock width={32} height={10} />
      </View>
      <BoardSkeleton groups={[rows]} background={p.workbox} />
    </View>
  );
}

const styles = (p: MonPalette) => ({
  screen: { flex: 1, backgroundColor: p.bg },
  flex: { flex: 1 },
  toolbar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 4, alignItems: 'center' as const },
  states: { marginHorizontal: 6 },
  count: { marginLeft: 8 },
  search: { paddingHorizontal: 16, paddingTop: 6 },
  body: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 120, gap: 22 },
  bodySelecting: { paddingBottom: 200 },
  sheetList: { paddingHorizontal: 8, paddingBottom: 8 },
  box: {
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 12,
    backgroundColor: p.workbox,
    overflow: 'hidden' as const,
  },
  boxHead: {
    height: 53,
    paddingHorizontal: 18,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: p.workboxHead,
    borderBottomWidth: 1,
    borderColor: p.line,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: p.iconTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  boxTitle: { flexShrink: 1 },
  boxBody: { paddingHorizontal: 12, paddingBottom: 8 },
});
