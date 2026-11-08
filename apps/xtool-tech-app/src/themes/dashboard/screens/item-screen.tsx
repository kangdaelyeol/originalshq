import { useState } from 'react';
import { CloudOff, PenLine, Trash2 } from 'lucide-react-native';
import type { TechBoardKey } from '@xtool-core/tech-boards';
import { useItemUpdates } from '@xtool-core/use-item-updates';
import { takePanel, useDashboardItem, type ItemPanel } from '../../../features/dashboard/item-detail';
import { updateView } from '../../../features/dashboard/part-data';
import { DELETE_CONFIRM_MESSAGE } from '../../../features/dashboard/record-rows';
import type { RootScreenProps } from '../../../navigation/types';
import { DetailBody } from '../boards/detail-body';
import { EditorSheet } from '../boards/editor-sheet';
import { useParts } from '../parts';

// 상세 — 웹 RecordDrawer(가운데 뜨는 유리 판)를 폰에서는 한 화면으로: 이름 위 보드 이름(다른 화면에서 열었으면 누르면 그
// 보드로 — 웹 "보드에서 보기"), 이름·단계 알약, 수정(편집 시트)·삭제(확인 — Monday 휴지통). 업데이트 보드(출장업무·
// 아톡문의)는 "정보 · 업데이트 N" 탭 — 목록의 말풍선으로 열면 업데이트 탭부터.

export function ItemScreen({ route, navigation }: RootScreenProps<'Item'>) {
  const { boardKey, itemId } = route.params;
  const P = useParts();
  const m = useDashboardItem(boardKey, itemId);
  const [tab, setTab] = useState<ItemPanel>(() => takePanel(itemId));
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // 바로 앞 화면이 이 보드면 보드 이름은 글자만(웹 보드 화면의 서랍), 아니면 누르면 그 보드로(내 업무·개요에서 연 상세)
  const routes = navigation.getState().routes;
  const previous = routes[routes.length - 2];
  const fromBoard =
    previous?.name === 'Board' && (previous.params as { boardKey?: TechBoardKey } | undefined)?.boardKey === boardKey;

  if (m.phase !== 'ready' || !m.detail) {
    return (
      <P.Screen header={<P.ScreenHeader title={m.name || '항목'} eyebrow={m.boardName} onBack={navigation.goBack} />}>
        {m.phase === 'error' ? (
          <P.EmptyState icon={CloudOff} tone="error" title="보드를 불러오지 못했어요" text={m.error ?? undefined} />
        ) : m.phase === 'loading' ? (
          <P.EmptyState loading title="불러오는 중…" />
        ) : (
          <P.EmptyState title="이 항목을 찾지 못했어요" text="지워졌거나 다른 보드로 옮겨졌을 수 있어요." />
        )}
      </P.Screen>
    );
  }

  const canEdit = !!m.meta && !!m.item && !m.item.draft;
  const showUpdates = m.updatesBoard && tab === 'updates';

  return (
    <>
      <P.DetailShell
        title={m.name || '(이름 없음)'}
        eyebrow={m.boardName}
        onPressEyebrow={fromBoard ? undefined : () => navigation.navigate('Board', { boardKey })}
        stage={m.pill ? null : m.stage}
        pill={m.pill}
        onBack={navigation.goBack}
        actions={
          canEdit
            ? [
                { key: 'edit', label: '수정', icon: PenLine, onPress: () => setEditing(true) },
                { key: 'delete', label: '삭제', icon: Trash2, danger: true, onPress: () => setConfirming(true) },
              ]
            : []
        }
        tabs={
          m.updatesBoard
            ? {
                options: [
                  { value: 'info', label: '정보' },
                  { value: 'updates', label: m.updateCount ? `업데이트 ${m.updateCount}` : '업데이트' },
                ],
                value: tab,
                onChange: value => setTab(value === 'updates' ? 'updates' : 'info'),
              }
            : null
        }
      >
        {showUpdates ? (
          <UpdatesPanel boardKey={boardKey} itemId={itemId} />
        ) : (
          <DetailBody detail={m.detail} meta={m.meta} item={m.item} />
        )}
      </P.DetailShell>

      <EditorSheet
        visible={editing}
        boardKey={boardKey}
        meta={m.meta}
        item={m.item}
        onClose={() => setEditing(false)}
      />
      <P.ConfirmDialog
        visible={confirming}
        title="이 항목을 지울까요?"
        message={DELETE_CONFIRM_MESSAGE}
        confirmLabel="삭제"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          m.remove();
          navigation.goBack();
        }}
      />
    </>
  );
}

/** 업데이트(웹 ItemUpdates) — 쓰기 칸, 다시 읽지 못함·불러오는 중 안내, 카드(답글) */
function UpdatesPanel({ boardKey, itemId }: { boardKey: TechBoardKey; itemId: string }) {
  const P = useParts();
  const { updates, error, slow, me, load, send } = useItemUpdates(boardKey, itemId);
  const [draft, setDraft] = useState('');
  return (
    <>
      <P.UpdateComposer
        value={draft}
        onChangeText={setDraft}
        canSend={!!draft.trim()}
        me={me}
        placeholder="업데이트를 적어 주세요 — 팀이 Monday에서도 같이 봐요"
        onSend={() => {
          if (send(draft)) setDraft('');
        }}
      />
      {error && (
        <P.Notice
          tone="error"
          text="Monday에서 다시 읽지 못해 저장된 목록을 보여 주고 있어요."
          action={{ label: '다시 불러오기', onPress: load }}
        />
      )}
      {!updates && slow && <P.Notice loading text="불러오는 중…" />}
      {updates?.length === 0 && <P.EmptyState title="아직 업데이트가 없어요." />}
      {updates?.map(update => (
        <P.UpdateCard key={update.id} update={updateView(update)} me={me} onReply={text => send(text, update.id)} />
      ))}
    </>
  );
}
