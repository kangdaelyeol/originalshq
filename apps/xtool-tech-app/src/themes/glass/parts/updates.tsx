import { useState } from 'react';
import { Image, Pressable, Text as RNText, View } from 'react-native';
import { File, FileText, ImageIcon, MessageSquareReply } from 'lucide-react-native';
import type {
  FileListProps,
  SubitemListProps,
  UpdateCardProps,
  UpdateComposerProps,
  UpdateView,
} from '../../dashboard/parts';
import { font, RADIUS, T, TABULAR, WELL } from '../theme';
import { useStyles } from '../theme-context';
import { Button, StatusPill, TextField } from './controls';
import { SectionTitle } from './detail';
import { EmptyText } from './surfaces';
import { SpinIcon } from './text';

// 업데이트·파일·하위 아이템 — 웹 item-updates(쓰기 칸 + 업데이트 카드 .item-update), item-files(사진 썸네일 격자 ·
// 문서 목록), subitems(읽기 전용 줄).

/** 업데이트 쓰기(웹 .item-updates__composer) — 긴 글 칸 + "{me} 이름으로 올라가요" + 업데이트 단추 */
export function UpdateComposer({ value, onChangeText, onSend, canSend, me, placeholder, style }: UpdateComposerProps) {
  const s = useStyles(composerStyles);
  return (
    <View style={[s.box, style]}>
      <TextField
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? '업데이트를 적어 주세요'}
        multiline
      />
      <View style={s.foot}>
        <RNText style={s.note} numberOfLines={1}>
          {me} 이름으로 올라가요
        </RNText>
        <Button label="업데이트" size="sm" onPress={onSend} disabled={!canSend} />
      </View>
    </View>
  );
}

const composerStyles = () => ({
  box: { gap: 8 },
  foot: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 10,
  },
  note: { ...font(12), color: T.text4, flex: 1 },
});

/** 업데이트 한 개(웹 .item-update) — 테두리 r12 바탕 .04, 쓴 사람 600 · 때 11.5, 글 13.5 lh1.55, 답글은 왼쪽 2px 줄 */
export function UpdateCard({ update, me, onReply, style }: UpdateCardProps) {
  const s = useStyles(cardStyles);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  return (
    <View style={[s.card, update.pending && s.pending, style]}>
      <UpdateHead update={update} />
      <RNText style={s.text} selectable>
        {update.text}
      </RNText>
      {update.replies.length > 0 ? (
        <View style={s.replies}>
          {update.replies.map(reply => (
            <View key={reply.id} style={reply.pending && s.pending}>
              <UpdateHead update={reply} />
              <RNText style={s.text} selectable>
                {reply.text}
              </RNText>
            </View>
          ))}
        </View>
      ) : null}
      {!update.pending ? (
        <Pressable
          onPress={() => setReplying(v => !v)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ expanded: replying }}
          style={s.toggle}
        >
          {({ pressed }) => (
            <>
              <MessageSquareReply size={13} strokeWidth={2} color={pressed || replying ? T.text1 : T.text3} />
              <RNText style={[s.toggleText, (pressed || replying) && { color: T.text1 }]}>답변</RNText>
            </>
          )}
        </Pressable>
      ) : null}
      {replying ? (
        <View style={s.reply}>
          <TextField
            value={text}
            onChangeText={setText}
            placeholder={`${me} 이름으로 답변`}
            multiline
            autoFocus
            style={s.replyField}
          />
          <Button
            label="보내기"
            size="sm"
            disabled={!text.trim()}
            onPress={() => {
              if (onReply(text)) {
                setText('');
                setReplying(false);
              }
            }}
            style={s.send}
          />
        </View>
      ) : null}
    </View>
  );
}

function UpdateHead({ update }: { update: UpdateView }) {
  const s = useStyles(cardStyles);
  return (
    <View style={s.head}>
      <RNText style={s.author} numberOfLines={1}>
        {update.author}
      </RNText>
      {update.pending ? (
        <View style={s.when}>
          <SpinIcon size={11} color={T.text4} />
          <RNText style={s.whenText}>올리는 중</RNText>
        </View>
      ) : (
        <RNText style={s.whenText}>{update.when}</RNText>
      )}
    </View>
  );
}

const cardStyles = () => ({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  pending: { opacity: 0.6 },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  author: { ...font(12.5, 600), color: T.text1, flexShrink: 1 },
  when: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginLeft: 'auto' as const },
  whenText: { ...font(11.5), color: T.text4, marginLeft: 'auto' as const },
  text: { ...font(13.5, 400, { lh: 1.55 }), color: T.text2, marginTop: 8 },
  replies: { marginTop: 12, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: T.line, gap: 10 },
  toggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start' as const,
  },
  toggleText: { ...font(12), color: T.text3 },
  reply: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 8, marginTop: 8 },
  replyField: { flex: 1 },
  send: { marginBottom: 6 },
});

/** 파일(웹 ItemFiles) — 사진은 88px 썸네일 격자(오목 칸 r10), 문서는 목록(아이콘 + 이름 · 흐린 글) */
export function FileList({ title, files, empty = '파일이 없어요', onPressFile, style }: FileListProps) {
  const s = useStyles(fileStyles);
  const images = files.filter(f => f.kind === 'image');
  const docs = files.filter(f => f.kind !== 'image');
  return (
    <View style={style}>
      <SectionTitle text={title} />
      {files.length === 0 ? <EmptyText text={empty} /> : null}
      {images.length > 0 ? (
        <View style={s.thumbs}>
          {images.map(file => (
            <Pressable
              key={file.key}
              onPress={() => onPressFile(file)}
              disabled={!file.url}
              accessibilityRole="imagebutton"
              accessibilityLabel={file.name}
              style={({ pressed }) => [s.thumb, pressed && { opacity: 0.8 }]}
            >
              {file.thumbUrl || file.url ? (
                <Image
                  source={{ uri: (file.thumbUrl || file.url) as string }}
                  style={s.thumbImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={s.fallback}>
                  <ImageIcon size={18} strokeWidth={2} color={T.text4} />
                  <RNText style={s.fallbackText} numberOfLines={1}>
                    {file.name}
                  </RNText>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}
      {docs.length > 0 ? (
        <View style={[s.docs, images.length > 0 && { marginTop: 10 }]}>
          {docs.map(file => {
            const DocIcon = file.kind === 'pdf' ? FileText : File;
            return (
              <Pressable
                key={file.key}
                onPress={() => onPressFile(file)}
                disabled={!file.url}
                accessibilityRole="link"
                style={({ pressed }) => [s.doc, pressed && s.docOn, !file.url && { opacity: 0.5 }]}
              >
                <DocIcon size={14} strokeWidth={2} color={T.text3} />
                <RNText style={s.docName} numberOfLines={1}>
                  {file.name}
                </RNText>
                {file.meta ? <RNText style={s.docMeta}>{file.meta}</RNText> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const fileStyles = () => ({
  thumbs: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  thumb: {
    ...WELL,
    width: 88,
    height: 88,
    borderRadius: RADIUS.control,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  thumbImage: { width: '100%' as const, height: '100%' as const },
  fallback: { alignItems: 'center' as const, gap: 4, paddingHorizontal: 6 },
  fallbackText: { ...font(10.5, 600), color: T.text4 },
  docs: { gap: 2 },
  doc: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  docOn: { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  docName: { ...font(12.5), color: T.text2, flex: 1 },
  docMeta: { ...font(12.5), ...TABULAR, color: T.info },
});

/** 하위 아이템(웹 subitems 읽기 전용) — 줄 py7 아래 줄, 이름 12.5 text-2 · 흐린 글 · 알약 */
export function SubitemList({ title, items, empty = '하위 아이템이 없어요', style }: SubitemListProps) {
  const s = useStyles(subStyles);
  return (
    <View style={style}>
      <SectionTitle text={`${title} ${items.length}`} />
      {items.length === 0 ? <EmptyText text={empty} /> : null}
      <View style={s.list}>
        {items.map(item => (
          <View key={item.key} style={s.row}>
            <View style={s.body}>
              <RNText style={s.name}>{item.name}</RNText>
              {item.meta ? <RNText style={s.meta}>{item.meta}</RNText> : null}
            </View>
            {item.pill ? <StatusPill tone={item.pill.tone} label={item.pill.label} dot={item.pill.dot} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const subStyles = () => ({
  list: { gap: 2 },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  body: { flex: 1, minWidth: 0, gap: 1 },
  name: { ...font(12.5, 500, { lh: 1.5 }), color: T.text2 },
  meta: { ...font(11.5), ...TABULAR, color: T.text4 },
});
