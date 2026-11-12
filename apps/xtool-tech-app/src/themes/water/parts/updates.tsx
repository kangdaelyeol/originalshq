import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MessageCircle } from 'lucide-react-native';
import type { UpdateCardProps, UpdateComposerProps, UpdateView } from '../../dashboard/parts';
import { QUICK_MS, shadow, W } from '../theme';
import { useWater } from '../theme-context';
import { WButton } from './controls';
import { Backing, glassLayer } from './glass';
import { Spin } from './screen';
import { WText } from './text';

// 업데이트(웹 water-item-updates) — 쓰기 칸은 물 입력과 같은 유리(둥근 상자 18, w-glass 0.46·0.2), 업데이트는 그림자
// 없는 유리 판(판 안의 판, w-glass 0.6·0). 초점 고리는 형제 층(키보드 함정).

function useRing() {
  const o = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return {
    style,
    on: () => {
      o.value = withTiming(1, { duration: QUICK_MS });
    },
    off: () => {
      o.value = withTiming(0, { duration: QUICK_MS });
    },
  };
}

/** 유리 글 상자 — 유리·고리 층 + 여러 줄 입력 */
function GlassArea({
  value,
  onChangeText,
  placeholder,
  minHeight,
  radius,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  minHeight: number;
  radius: number;
}) {
  const p = useWater();
  const ring = useRing();
  return (
    <View collapsable={false} style={[styles.area, { borderRadius: radius }]}>
      <Backing style={glassLayer(p, 0.46, 0.2, radius)} />
      <Animated.View pointerEvents="none" style={[styles.ring, { borderRadius: radius }, ring.style]} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={W.ink3}
        multiline
        onFocus={ring.on}
        onBlur={ring.off}
        style={[styles.input, { minHeight }]}
      />
    </View>
  );
}

/** 업데이트 쓰기 칸 — 유리 상자 + "{me} 이름으로 올라가요" + 업데이트 단추 */
export function UpdateComposer({
  value,
  onChangeText,
  onSend,
  canSend,
  me,
  placeholder = '업데이트를 남겨요',
  style,
}: UpdateComposerProps) {
  return (
    <View style={[styles.composer, style]}>
      <GlassArea value={value} onChangeText={onChangeText} placeholder={placeholder} minHeight={84} radius={18} />
      <View style={styles.foot}>
        <WText size={12} color={W.ink3} numberOfLines={1} style={styles.flex}>
          {me} 이름으로 올라가요
        </WText>
        <WButton size="sm" disabled={!canSend} onPress={onSend}>
          업데이트
        </WButton>
      </View>
    </View>
  );
}

function Author({ u }: { u: UpdateView }) {
  return (
    <View style={styles.author}>
      <WText size={12.5} weight="600" numberOfLines={1} style={styles.flexShrink}>
        {u.author}
      </WText>
      <View style={styles.when}>
        {u.pending ? (
          <>
            <Spin size={11} color={W.ink3} />
            <WText size={11.5} color={W.ink3}>
              올리는 중
            </WText>
          </>
        ) : (
          <WText size={11.5} color={W.ink3}>
            {u.when}
          </WText>
        )}
      </View>
    </View>
  );
}

/** 업데이트 하나 — 판 안의 판(그림자 없는 유리), 답글은 왼쪽 2px 선 안쪽, "답변"을 누르면 답글 칸 */
export function UpdateCard({ update, me, onReply, style }: UpdateCardProps) {
  const p = useWater();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim()) return;
    if (onReply(text)) {
      setText('');
      setOpen(false);
    }
  };
  return (
    <View style={[styles.card, update.pending && styles.pending, style]}>
      <Backing style={glassLayer(p, 0.6, 0, 16)} fit />
      <Author u={update} />
      <WText size={13.5} lh={1.55} color={W.ink2} selectable style={styles.text}>
        {update.text}
      </WText>
      {update.replies.length > 0 ? (
        <View style={styles.replies}>
          {update.replies.map(r => (
            <View key={r.id} style={r.pending ? styles.pending : null}>
              <Author u={r} />
              <WText size={13.5} lh={1.55} color={W.ink2} selectable style={styles.text}>
                {r.text}
              </WText>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        onPress={() => setOpen(v => !v)}
        style={styles.toggle}
      >
        {({ pressed }) => (
          <>
            <MessageCircle size={13} color={open || pressed ? W.ink : W.ink3} strokeWidth={2} />
            <WText size={12} weight="500" color={open || pressed ? W.ink : W.ink3}>
              답변
            </WText>
          </>
        )}
      </Pressable>
      {open ? (
        <View style={styles.reply}>
          <View style={styles.flex}>
            <GlassArea
              value={text}
              onChangeText={setText}
              placeholder={`${me} 이름으로 답변`}
              minHeight={40}
              radius={18}
            />
          </View>
          <WButton size="sm" disabled={!text.trim()} onPress={send}>
            보내기
          </WButton>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  composer: { gap: 8 },
  area: { minWidth: 0 },
  ring: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, boxShadow: [shadow(0, 0, 0, 2, W.ring)] },
  input: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    color: W.ink,
    textAlignVertical: 'top',
  },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  card: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16 },
  pending: { opacity: 0.6 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  text: { marginTop: 8 },
  replies: {
    gap: 10,
    marginTop: 12,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: W.replyLine,
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start' },
  reply: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
});
