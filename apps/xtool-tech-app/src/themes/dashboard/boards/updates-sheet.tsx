import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { TechBoardKey } from '@xtool-core/tech-boards';
import { useItemUpdates } from '@xtool-core/use-item-updates';
import { updateView } from '../../../features/dashboard/part-data';
import { layout } from '../layout';
import { useParts } from '../parts';

// 업데이트(댓글) 시트 — 웹 Monday 업데이트 판처럼 화면 이동 없이 아래에서 올라온다. 목록 줄의 말풍선·상세 머리의
// "업데이트 N" 단추가 같이 연다. 쓰기 칸은 아래 고정(footer) — 시트가 키보드 위로 밀려 올라가도 늘 키보드 바로 위에
// 보이게(본문 맨 위에 두면 긴 시트의 위쪽이 화면 밖으로 밀려 가려진다). 본문은 안내 · 카드(답글·답변).

export interface UpdatesTarget {
  boardKey: TechBoardKey;
  itemId: string;
  /** 시트 부제 — 항목 이름 */
  title: string;
}

/** 닫히는 움직임이 끝난 뒤 내용을 뗀다(업데이트 구독도 그때 끊긴다) */
const UNMOUNT_DELAY = 500;

export function UpdatesSheet({ target, onClose }: { target: UpdatesTarget | null; onClose: () => void }) {
  // 닫는 동안에도 마지막 항목을 그대로 그린다
  const [shown, setShown] = useState<UpdatesTarget | null>(target);
  if (target && (target.itemId !== shown?.itemId || target.boardKey !== shown.boardKey || target.title !== shown.title))
    setShown(target);

  useEffect(() => {
    if (target) return;
    const id = setTimeout(() => setShown(null), UNMOUNT_DELAY);
    return () => clearTimeout(id);
  }, [target]);

  if (!shown) return null;
  return <OpenUpdates key={`${shown.boardKey}:${shown.itemId}`} target={shown} visible={!!target} onClose={onClose} />;
}

/** 웹 ItemUpdates — 쓰기 칸, 다시 읽지 못함·불러오는 중 안내, 카드(답글) */
function OpenUpdates({ target, visible, onClose }: { target: UpdatesTarget; visible: boolean; onClose: () => void }) {
  const P = useParts();
  const { updates, error, slow, me, load, send } = useItemUpdates(target.boardKey, target.itemId);
  const [draft, setDraft] = useState('');
  return (
    <P.Sheet
      visible={visible}
      tall
      onClose={onClose}
      title={updates?.length ? `업데이트 ${updates.length}` : '업데이트'}
      subtitle={target.title || '(이름 없음)'}
      footer={
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
      }
    >
      <View style={layout.stack}>
        {error && (
          <P.Notice
            tone="error"
            text="Monday에서 다시 읽지 못해 저장된 목록을 보여 주고 있어요."
            action={{ label: '다시 불러오기', onPress: load }}
          />
        )}
        {!updates && slow && <P.Notice loading text="불러오는 중…" />}
        {updates?.length === 0 && (
          <P.EmptyState title="아직 업데이트가 없어요." text="아래 칸에 처음 업데이트를 남겨 보세요." />
        )}
        {updates?.map(update => (
          <P.UpdateCard key={update.id} update={updateView(update)} me={me} onReply={text => send(text, update.id)} />
        ))}
      </View>
    </P.Sheet>
  );
}
