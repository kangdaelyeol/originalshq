import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { CornerDownRight, RotateCcw } from 'lucide-react-native';
import type { TechBoardKey } from '@xtool-core/tech-boards';
import { authorOf, type TechUpdate } from '@xtool-core/tech-updates';
import { isPendingUpdate, updateWhenText, useItemUpdates } from '@xtool-core/use-item-updates';
import { FONT, INK, MONDAY_ACCENT, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';
import { Avatar, MText } from './basics';
import { EmptyState, Sheet } from './chrome';

// 업데이트 시트 — 웹 Monday 업데이트 판(말풍선으로 연다)을 폰에서는 아래에서 올라오는 시트로. 보드·내 업무 카드의 말풍선,
// 항목 화면 머리의 말풍선 단추가 같은 시트를 연다. 안은 쓰기 칸(맨 위 — 키보드가 오르면 시트가 줄어 늘 보인다) + 목록
// (답글·답변). 읽기·올리기는 core useItemUpdates.

/** 업데이트를 볼 항목 — 열려 있으면 값, 닫혀 있으면 null */
export interface UpdatesTarget {
  boardKey: TechBoardKey;
  itemId: string;
  name: string;
  /** 카드에 보이던 개수(목록을 읽기 전 제목에) */
  count?: number;
}

export function UpdatesSheet({ target, onClose }: { target: UpdatesTarget | null; onClose: () => void }) {
  if (!target) return null;
  // 다른 항목을 열면 새로 그린다(쓰던 글·답글 칸이 남지 않게)
  return <UpdatesSheetBody key={`${target.boardKey}:${target.itemId}`} target={target} onClose={onClose} />;
}

function UpdatesSheetBody({ target, onClose }: { target: UpdatesTarget; onClose: () => void }) {
  const p = useMon();
  const s = useStyles(styles);
  const { height } = useWindowDimensions();
  const { updates, error, slow, me, load, send } = useItemUpdates(target.boardKey, target.itemId);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);

  // 답글 칸이 키보드(줄어든 시트) 아래로 숨지 않게 — 카드 자리·보이는 높이·굴린 만큼을 기억해 두고 맞춰 굴린다
  const scroll = useRef<ScrollViewInstance>(null);
  const cards = useRef(new Map<string, { y: number; h: number }>());
  const viewHeight = useRef(0);
  const offset = useRef(0);
  const replying = useRef<string | null>(null);
  replying.current = replyingId;
  const keepReplyVisible = () => {
    const card = replying.current ? cards.current.get(replying.current) : undefined;
    if (!card || !viewHeight.current) return;
    const bottom = card.y + card.h + 12;
    if (bottom > offset.current + viewHeight.current) {
      scroll.current?.scrollTo({ y: bottom - viewHeight.current, animated: true });
    }
  };

  const count = updates?.length ?? target.count ?? 0;
  return (
    <Sheet visible onClose={onClose} title={target.name} tall>
      {/* 시트를 늘 거의 끝까지(목록이 와도 높이가 튀지 않게) — 키보드가 오르면 이 판이 줄어든다 */}
      <View style={[s.body, { height }]}>
        <MText size={13} color={p.text2} style={s.count}>
          업데이트 / {count}
        </MText>
        <ScrollView
          ref={scroll}
          style={s.flex}
          contentContainerStyle={s.list}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={e => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          onLayout={e => {
            viewHeight.current = e.nativeEvent.layout.height;
            keepReplyVisible();
          }}
        >
          <View style={s.composer} collapsable={false}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder="업데이트를 적어 주세요 — 팀이 Monday에서도 같이 봐요"
              placeholderTextColor={p.text2}
              keyboardAppearance={p.scheme}
              onFocus={() => {
                setFocused(true);
                setReplyingId(null);
              }}
              onBlur={() => setFocused(false)}
              style={s.composerInput}
            />
            <View style={s.composerFoot}>
              <MText size={12} color={p.text2} style={s.flex} numberOfLines={1}>
                {me} 이름으로 올라가요
              </MText>
              <Pressable
                disabled={!draft.trim()}
                onPress={() => {
                  if (send(draft)) setDraft('');
                }}
                style={({ pressed }) => [
                  s.send,
                  { opacity: draft.trim() ? 1 : 0.45 },
                  pressed && { backgroundColor: p.primaryHi },
                ]}
              >
                <MText color={INK}>업데이트</MText>
              </Pressable>
            </View>
            {/* 포커스 테두리(웹 focus-within) — 입력 칸의 조상 스타일은 그대로 두고 위에 겹친 형제 판만 켠다(키보드 함정) */}
            <View pointerEvents="none" style={[s.composerRing, { opacity: focused ? 1 : 0 }]} />
          </View>
          {error && (
            <View style={s.note}>
              <MText size={13} color={p.dangerText} style={s.flex}>
                Monday에서 다시 읽지 못해 저장된 목록을 보여 주고 있어요.
              </MText>
              <Pressable onPress={load} style={s.retry} hitSlop={6}>
                <RotateCcw size={13} color={p.text} />
                <MText size={13}>다시 불러오기</MText>
              </Pressable>
            </View>
          )}
          {!updates && slow && (
            <View style={s.note}>
              <ActivityIndicator size="small" color={p.text2} />
              <MText size={13} color={p.text2}>
                불러오는 중…
              </MText>
            </View>
          )}
          {updates?.length === 0 && <EmptyState text="아직 업데이트가 없어요." />}
          {updates?.map(update => (
            <UpdateCard
              key={update.id}
              update={update}
              me={me}
              replying={replyingId === update.id}
              onToggleReply={() => setReplyingId(replyingId === update.id ? null : update.id)}
              onReply={text => {
                const sent = send(text, update.id);
                if (sent) setReplyingId(null);
                return sent;
              }}
              onLayout={(y, h) => {
                cards.current.set(update.id, { y, h });
                if (replying.current === update.id) keepReplyVisible();
              }}
              onReplyFocus={keepReplyVisible}
            />
          ))}
        </ScrollView>
      </View>
    </Sheet>
  );
}

function UpdateCard({
  update,
  me,
  replying,
  onToggleReply,
  onReply,
  onLayout,
  onReplyFocus,
}: {
  update: TechUpdate;
  me: string;
  replying: boolean;
  onToggleReply: () => void;
  onReply: (text: string) => boolean;
  onLayout: (y: number, height: number) => void;
  onReplyFocus: () => void;
}) {
  const p = useMon();
  const s = useStyles(styles);
  const [reply, setReply] = useState('');
  const [focused, setFocused] = useState(false);
  const pending = isPendingUpdate(update);
  return (
    <View
      style={[s.card, pending && s.pending]}
      onLayout={e => onLayout(e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
    >
      <View style={s.cardBody}>
        <Author update={update} size={34} />
        <MText style={s.updateText}>{authorOf(update).text}</MText>
        {update.replies.map(r => (
          <View key={r.id} style={s.reply}>
            <Author update={r} size={26} />
            <MText style={s.updateText}>{authorOf(r).text}</MText>
          </View>
        ))}
      </View>
      <View style={s.cardActions}>
        <Pressable
          onPress={onToggleReply}
          style={({ pressed }) => [s.replyButton, pressed && { backgroundColor: p.overlay }]}
        >
          <CornerDownRight size={14} color={p.text} />
          <MText size={13}>답변</MText>
        </Pressable>
      </View>
      {replying && (
        <View style={s.replyForm}>
          <Avatar name={me} size={30} color={MONDAY_ACCENT} />
          <TextInput
            value={reply}
            onChangeText={setReply}
            autoFocus
            placeholder="답글을 적어 주세요"
            placeholderTextColor={p.text2}
            keyboardAppearance={p.scheme}
            onFocus={() => {
              setFocused(true);
              onReplyFocus();
            }}
            onBlur={() => setFocused(false)}
            style={[s.replyInput, { borderColor: focused ? p.primary : p.line }]}
          />
          <Pressable
            disabled={!reply.trim()}
            onPress={() => {
              if (onReply(reply)) setReply('');
            }}
            style={[s.replySend, { opacity: reply.trim() ? 1 : 0.45 }]}
          >
            <MText color={INK}>답글</MText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Author({ update, size }: { update: TechUpdate; size: number }) {
  const p = useMon();
  const s = useStyles(styles);
  const { author } = authorOf(update);
  return (
    <View style={s.author}>
      <Avatar name={author} size={size} />
      <MText size={size > 30 ? 14 : 13} numberOfLines={1} style={s.authorName}>
        {author}
      </MText>
      {isPendingUpdate(update) ? (
        <View style={s.posting}>
          <ActivityIndicator size="small" color={p.text2} />
          <MText size={12.5} color={p.text2}>
            올리는 중
          </MText>
        </View>
      ) : (
        <MText size={12.5} color={p.text2}>
          {updateWhenText(update.createdAt)}
        </MText>
      )}
    </View>
  );
}

const styles = (p: MonPalette) => ({
  flex: { flex: 1 },
  body: { flexShrink: 1, minHeight: 0 },
  count: { paddingHorizontal: 16, paddingBottom: 8 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 16 },
  composer: { borderWidth: 1, borderColor: p.line, borderRadius: 8 },
  composerRing: {
    position: 'absolute' as const,
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 1,
    borderColor: p.primary,
    borderRadius: 8,
  },
  composerInput: {
    minHeight: 96,
    maxHeight: 200,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontFamily: FONT.medium,
    fontSize: 14,
    lineHeight: 22,
    color: p.text,
    textAlignVertical: 'top' as const,
  },
  composerFoot: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingLeft: 16,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  send: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 4,
    justifyContent: 'center' as const,
    backgroundColor: p.primary,
  },
  note: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  retry: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 4,
    backgroundColor: p.overlay,
  },
  card: { borderWidth: 1, borderColor: p.line, borderRadius: 8, overflow: 'hidden' as const },
  pending: { opacity: 0.6 },
  cardBody: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, gap: 10 },
  updateText: { lineHeight: 23 },
  reply: { borderTopWidth: 1, borderColor: p.line, paddingTop: 12, paddingLeft: 14, gap: 8 },
  cardActions: {
    borderTopWidth: 1,
    borderColor: p.line,
    paddingHorizontal: 10,
    paddingVertical: 2,
    flexDirection: 'row' as const,
  },
  replyButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  replyForm: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    borderTopWidth: 1,
    borderColor: p.line,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
  },
  replyInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    fontFamily: FONT.medium,
    fontSize: 14,
    color: p.text,
  },
  replySend: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 4,
    justifyContent: 'center' as const,
    backgroundColor: p.primary,
  },
  author: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  authorName: { flexShrink: 1 },
  posting: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
});
