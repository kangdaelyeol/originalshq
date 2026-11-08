import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { CornerDownRight, RotateCcw } from 'lucide-react-native';
import type { TechBoardKey, TechColumn, TechItemDoc } from '@xtool-core/tech-boards';
import { SUBITEM_LABEL } from '@xtool-core/tech-subitems';
import { authorOf, type TechUpdate } from '@xtool-core/tech-updates';
import { isPendingUpdate, updateWhenText, useItemUpdates } from '@xtool-core/use-item-updates';
import { checkCommit } from '../../../features/cell-edit';
import { useItemView, type ItemViewModel } from '../../../features/item-view';
import type { RootScreenProps } from '../../../navigation/types';
import { Avatar, MText } from '../parts/basics';
import { CellValue } from '../parts/cell-value';
import { EmptyState, ScreenHeader, UnderlineTabs } from '../parts/chrome';
import { CellEditorSheet, TextSheet } from '../parts/editors';
import { FilesSheet } from '../parts/files';
import { MoveSheet } from '../parts/move-sheet';
import { SubitemsBlock } from '../parts/subitems';
import { FONT, INK, MONDAY_ACCENT, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';

// 항목 — 웹 Monday 표에는 따로 상세가 없고(칸을 표에서 바로 고친다) 업데이트 패널만 있다. 폰에서는 표를 못 펼치니
// 항목 화면을 새로 둔다: "정보"(모든 칸, 웹 대시보드 상세 서랍의 이름·값 목록 모양) · "업데이트 / N"(웹 업데이트 패널
// 그대로 — 출장업무·아톡문의만). 정보의 칸을 누르면 웹 Monday 칸 편집기를 시트로 연다(이름·그룹도). 하위 아이템과
// 파일 보기도 여기에. 동작(항목 찾기·편집기 고르기·저장)은 공용 훅(features/item-view·cell-edit)이 한다.

type Tab = 'updates' | 'info';

export function ItemScreen({ route, navigation }: RootScreenProps<'Item'>) {
  const { boardKey, itemId } = route.params;
  const s = useStyles(styles);
  const v = useItemView(boardKey, itemId);
  const { item, hasUpdates } = v;
  const [tab, setTab] = useState<Tab>(hasUpdates ? 'updates' : 'info');

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

  const tabs = [
    ...(hasUpdates ? [{ value: 'updates' as const, label: `업데이트 / ${item.updateCount ?? 0}` }] : []),
    { value: 'info' as const, label: '정보' },
  ];
  return (
    <View style={s.screen}>
      <ScreenHeader title={v.name} onBack={navigation.goBack} titleSize={24} />
      <UnderlineTabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'updates' && hasUpdates ? (
        <UpdatesTab boardKey={boardKey} itemId={item.itemId} />
      ) : (
        <InfoTab view={v} item={item} />
      )}
    </View>
  );
}

// ── 정보 ──────────────────────────────────────────────────────────────────

function InfoTab({ view, item }: { view: ItemViewModel; item: TechItemDoc }) {
  const p = useMon();
  const s = useStyles(styles);
  const [editing, setEditing] = useState<TechColumn | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [files, setFiles] = useState<TechColumn | null>(null);
  const { group, sub } = view;
  const kind = editing ? view.editorOf(editing) : null;

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
      {view.columns.map(c => {
        const editor = view.editorOf(c);
        return (
          <Field key={c.id} label={c.title} onPress={editor ? () => press(c) : undefined}>
            <CellValue column={c} cell={item.values[c.id]} mode="full" />
          </Field>
        );
      })}
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

// ── 업데이트 ────────────────────────────────────────────────────────────────

function UpdatesTab({ boardKey, itemId }: { boardKey: TechBoardKey; itemId: string }) {
  const p = useMon();
  const s = useStyles(styles);
  const { updates, error, slow, me, load, send } = useItemUpdates(boardKey, itemId);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  return (
    <ScrollView
      contentContainerStyle={s.updates}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={s.composer} collapsable={false}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder="업데이트를 적어 주세요 — 팀이 Monday에서도 같이 봐요"
          placeholderTextColor={p.text2}
          keyboardAppearance={p.scheme}
          onFocus={() => setFocused(true)}
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
        <UpdateCard key={update.id} update={update} me={me} onReply={text => send(text, update.id)} />
      ))}
    </ScrollView>
  );
}

function UpdateCard({ update, me, onReply }: { update: TechUpdate; me: string; onReply: (text: string) => boolean }) {
  const p = useMon();
  const s = useStyles(styles);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [focused, setFocused] = useState(false);
  const pending = isPendingUpdate(update);
  return (
    <View style={[s.card, pending && { opacity: 0.6 }]}>
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
          onPress={() => setReplying(!replying)}
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
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[s.replyInput, { borderColor: focused ? p.primary : p.line }]}
          />
          <Pressable
            disabled={!reply.trim()}
            onPress={() => {
              if (onReply(reply)) {
                setReply('');
                setReplying(false);
              }
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
  const { author } = authorOf(update);
  const pending = isPendingUpdate(update);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Avatar name={author} size={size} />
      <MText size={size > 30 ? 14 : 13} numberOfLines={1} style={{ flexShrink: 1 }}>
        {author}
      </MText>
      {pending ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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
  sheetList: { paddingHorizontal: 8, paddingBottom: 8 },
  updates: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80, gap: 16 },
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
});
