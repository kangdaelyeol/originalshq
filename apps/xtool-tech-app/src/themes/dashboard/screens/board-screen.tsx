import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { ArrowRight, ArrowUpDown, ChevronRight, CloudOff, MapPin, Plus, Trash2 } from 'lucide-react-native';
import { koreaToday } from '@xtool-core/dates';
import { useTechBoard } from '@xtool-core/tech-boards-store';
import { copyText } from '../../../features/copy-text';
import { useDashboardBoard, type DashboardBoardModel } from '../../../features/dashboard/board-screen';
import { DELETE_CONFIRM_MESSAGE } from '../../../features/dashboard/record-rows';
import type { RootScreenProps } from '../../../navigation/types';
import { EditorSheet } from '../boards/editor-sheet';
import { SidePanelCard } from '../boards/side-panel';
import { UpdatesSheet, type UpdatesTarget } from '../boards/updates-sheet';
import { layout } from '../layout';
import { useParts } from '../parts';
import { PickSheet } from '../pick-sheet';

// 보드 — 웹 board-page(대시보드 짜임): 기간 → 숫자 카드 네 장 → 목록(진행 상태·검색·담당자·정렬·새로 만들기·더 보기,
// 길게 눌러 고르기 → 이동·삭제) → 옆 판 두 장(폰에서는 아래로). 줄을 누르면 상세 화면, 말풍선은 업데이트 시트, "설치 품목 N개"
// 단추는 설치 품목 시트(품목 위 주소는 누르면 복사). 불러오는 중·오류·동기화 안 됨도
// 웹처럼. 보드마다 다른 것(칸·옆 판·상세)은 features/dashboard/boards의 정의가 정한다.

type Picker = 'people' | 'sort' | null;

export function BoardScreen({ route, navigation }: RootScreenProps<'Board'>) {
  const { boardKey } = route.params;
  const P = useParts();
  const open = useCallback(
    (itemId: string) => navigation.navigate('Item', { boardKey, itemId }),
    [navigation, boardKey],
  );
  const m = useDashboardBoard(boardKey, open);
  const { meta } = useTechBoard(boardKey);
  const [creating, setCreating] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const [updatesFor, setUpdatesFor] = useState<UpdatesTarget | null>(null);
  // 설치 품목 시트 — 연 줄의 id(닫는 동안에도 목록이 남게 열림과 따로 둔다)
  const [subitemsFor, setSubitemsFor] = useState<string | null>(null);
  const [subitemsOpen, setSubitemsOpen] = useState(false);
  const today = koreaToday();
  const selecting = m.selection.selected.size > 0;

  const header = (
    <P.ScreenHeader title={m.title} eyebrow={m.title !== m.label ? m.label : undefined} onBack={navigation.goBack} />
  );

  if (m.phase === 'error') {
    return (
      <P.Screen header={header}>
        <P.EmptyState icon={CloudOff} tone="error" title="보드를 불러오지 못했어요" text={m.error ?? undefined} />
      </P.Screen>
    );
  }
  if (m.phase === 'unsynced') {
    return (
      <P.Screen header={header}>
        <P.EmptyState
          title={`${m.label} 보드가 아직 동기화되지 않았어요`}
          text={'관리자 화면의 "지금 동기화"나 정기 동기화(하루 여섯 번)가 한 번 돌고 나면 여기에 보여요.'}
        />
      </P.Screen>
    );
  }
  if (m.phase === 'loading') {
    return (
      <P.Screen header={header}>
        <PeriodPicker m={m} />
        <P.KpiGrid items={null} />
        <P.EmptyState loading title={`${m.label} 보드를 불러오는 중…`} />
      </P.Screen>
    );
  }

  const subitems = subitemsFor ? m.subitemsOf(subitemsFor) : null;

  const actions = [
    ...(m.groups.length > 0 ? [{ key: 'move', label: '이동', icon: ArrowRight, onPress: m.actions.openMove }] : []),
    { key: 'delete', label: '삭제', icon: Trash2, danger: true, onPress: m.actions.askDelete },
  ];

  return (
    <P.Screen
      header={header}
      footer={
        selecting ? (
          <P.SelectionBar count={m.selection.selected.size} actions={actions} onClear={m.selection.clear} />
        ) : undefined
      }
    >
      <PeriodPicker m={m} />
      <P.KpiGrid items={m.kpis} />

      <P.RecordList
        title={m.listTitle}
        subtitle={`${m.list.rows.length}건`}
        actions={
          m.canEdit ? (
            <P.Button size="sm" icon={Plus} label="새로 만들기" onPress={() => setCreating(true)} />
          ) : undefined
        }
        toolbar={
          <View style={layout.stack}>
            {m.progress && (
              <P.Segmented
                label="진행 상태"
                size="sm"
                options={m.list.viewOptions}
                value={m.list.view}
                onChange={m.list.setView}
              />
            )}
            <P.SearchField value={m.list.query} onChangeText={m.list.setQuery} placeholder={m.searchPlaceholder} />
            <View style={layout.wrap}>
              {m.list.people.length > 0 && (
                <P.Chip
                  label={m.list.assignee || '담당자 전체'}
                  selected={!!m.list.assignee}
                  trailing={m.list.assignee ? 'clear' : 'chevron'}
                  onPress={() => setPicker('people')}
                  onClear={() => m.list.setAssignee('')}
                />
              )}
              <P.Chip
                label={m.sortLabel}
                icon={ArrowUpDown}
                selected={!!m.list.sort}
                trailing={m.list.sort ? 'clear' : 'chevron'}
                onPress={() => setPicker('sort')}
                onClear={m.list.clearSort}
              />
            </View>
          </View>
        }
        rows={m.rows}
        emptyText={m.list.emptyText}
        onPressRow={id => (selecting ? m.selection.toggle(id) : open(id))}
        onLongPressRow={m.canEdit ? m.selection.toggle : undefined}
        onPressUpdates={
          m.updatesBoard
            ? id => setUpdatesFor({ boardKey, itemId: id, title: m.rows.find(r => r.id === id)?.title ?? '' })
            : undefined
        }
        onPressSubitems={
          m.hasSubitems
            ? id => {
                setSubitemsFor(id);
                setSubitemsOpen(true);
              }
            : undefined
        }
        selecting={selecting}
        selected={m.selection.selected}
        more={m.more}
      />

      {m.side.map(panel => (
        <SidePanelCard key={panel.key} panel={panel} today={today} />
      ))}

      <PickSheet
        visible={picker === 'people'}
        title="담당자"
        value={m.list.assignee}
        options={[{ value: '', label: '담당자 전체' }, ...m.list.people.map(name => ({ value: name, label: name }))]}
        onPick={m.list.setAssignee}
        onClose={() => setPicker(null)}
      />
      <P.Sheet visible={picker === 'sort'} onClose={() => setPicker(null)} title="정렬">
        <P.OptionRow
          label="기본 순서"
          description={m.progress ? '진행 중은 급한 순, 완료는 최근 순' : '보드 순서'}
          selected={!m.list.sort}
          onPress={() => {
            m.list.clearSort();
            setPicker(null);
          }}
        />
        {m.sortChoices.map(choice => {
          const on = m.list.sort?.key === choice.key ? m.list.sort.dir : null;
          return (
            <P.OptionRow
              key={choice.key}
              label={choice.label}
              description={
                on === 'asc'
                  ? '오름차순 — 한 번 더 누르면 내림차순'
                  : on === 'desc'
                  ? '내림차순 — 한 번 더 누르면 해제'
                  : undefined
              }
              selected={on !== null}
              right={
                on ? (
                  <P.Text variant="strong" tone="accent">
                    {on === 'asc' ? '↑' : '↓'}
                  </P.Text>
                ) : undefined
              }
              onPress={() => {
                m.list.toggleSort(choice.key);
                setPicker(null);
              }}
            />
          );
        })}
      </P.Sheet>
      <P.Sheet visible={m.actions.moving} onClose={m.actions.closeMove} title="어느 진행 단계로 옮길까요">
        {m.groups.map(group => (
          <P.OptionRow key={group.id} label={group.title} onPress={() => m.actions.move(group.id)} />
        ))}
      </P.Sheet>
      <P.ConfirmDialog
        visible={m.actions.confirming}
        title={`${m.actions.count}건을 지울까요?`}
        message={DELETE_CONFIRM_MESSAGE}
        confirmLabel="삭제"
        danger
        onConfirm={m.actions.confirmDelete}
        onCancel={m.actions.cancelDelete}
      />
      <UpdatesSheet target={updatesFor} onClose={() => setUpdatesFor(null)} />
      <P.Sheet
        visible={subitemsOpen && !!subitems}
        onClose={() => setSubitemsOpen(false)}
        title={subitems?.title}
        footer={
          <P.Button
            variant="secondary"
            block
            icon={ChevronRight}
            iconAfter
            label="항목 열기"
            onPress={() => {
              setSubitemsOpen(false);
              if (subitemsFor) open(subitemsFor);
            }}
          />
        }
      >
        {subitems?.address ? (
          <P.OptionRow
            icon={MapPin}
            label={subitems.address}
            description="누르면 주소를 복사해요"
            onPress={() => copyText(subitems.address, '주소를 복사했어요')}
          />
        ) : null}
        {subitems ? (
          <P.DetailList title={`${subitems.label} ${subitems.items.length}개`} items={subitems.items} />
        ) : null}
      </P.Sheet>
      <EditorSheet visible={creating} boardKey={boardKey} meta={meta} item={null} onClose={() => setCreating(false)} />
    </P.Screen>
  );
}

/** 조회 기간 — 웹 상단바 기간 고르기(숫자 카드의 "… 완료"·"… 접수"가 이 기간을 센다). 앱 전체에 하나 */
function PeriodPicker({ m }: { m: DashboardBoardModel }) {
  const P = useParts();
  return (
    <P.Segmented
      label="조회 기간"
      size="sm"
      options={m.periodOptions}
      value={m.period.period}
      onChange={m.period.setPeriod}
    />
  );
}
