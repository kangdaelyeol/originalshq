import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Plus, Trash2, X } from 'lucide-react-native';
import type { TechBoardKey, TechBoardMeta, TechItemDoc } from '@xtool-core/tech-boards';
import { GROUP_COLUMN, VIEW_LIMITS, type BoardView, type BoardViewSpec } from '@xtool-core/tech-views';
import { useViewEditor } from '../../../features/view-editor';
import { INK, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';
import { MText } from './basics';
import { Sheet } from './chrome';
import { ConfirmDialog } from './confirm';
import { FieldInput, SelectButton, SelectSheet } from './editors';

// 보기 추가·고치기(웹 monday-view-modal) — 보기 이름, 조건(칸·조건·값, 모두/하나라도, 맞는 항목 수), 정렬, 숨길 칸.
// 저장하면 기술팀 모두의 보드에 같은 보기 탭이 생긴다. 규칙·저장은 features/view-editor.

type Picking = { kind: 'column' | 'op'; index: number } | { kind: 'sort' } | null;

export function ViewEditorSheet({
  boardKey,
  meta,
  items,
  view,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: {
  boardKey: TechBoardKey;
  meta: TechBoardMeta;
  items: readonly TechItemDoc[];
  /** 고칠 보기 — null이면 새 보기 */
  view: BoardView | null;
  /** 새 보기의 처음 값(복제) */
  initial?: BoardViewSpec;
  onClose: () => void;
  /** 저장한 보기 id — 새로 만들었으면 그 보기로 옮겨 간다 */
  onSaved: (id: string) => void;
  /** 지운 뒤 — 메인 테이블로 */
  onDeleted: () => void;
}) {
  const p = useMon();
  const s = useStyles(styles);
  const m = useViewEditor(boardKey, meta, items, view, initial);
  const [picking, setPicking] = useState<Picking>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { draft } = m;
  const sortColumns = m.columns.filter(c => c.id !== GROUP_COLUMN);

  const save = async () => {
    const id = await m.save();
    if (id) onSaved(id);
  };

  const pickSheet = (() => {
    if (!picking) return null;
    if (picking.kind === 'sort') {
      return {
        title: '정렬할 칸',
        options: [{ value: '', label: '정렬 안 함' }, ...sortColumns.map(c => ({ value: c.id, label: c.title }))],
        value: draft.sort?.columnId ?? '',
        onPick: m.setSortColumn,
      };
    }
    const rule = draft.rules[picking.index];
    if (!rule) return null;
    if (picking.kind === 'column') {
      return {
        title: '칸',
        options: m.columns.map(c => ({ value: c.id, label: c.title })),
        value: rule.columnId,
        onPick: (id: string) => m.setRuleColumn(picking.index, id),
      };
    }
    return {
      title: '조건',
      options: m.opsOf(rule).map(o => ({ value: o.op, label: o.label })),
      value: rule.op,
      onPick: (op: string) => m.setRuleOp(picking.index, op as (typeof rule)['op']),
    };
  })();

  return (
    <Sheet
      visible
      onClose={onClose}
      title={view ? '보기 고치기' : '보기 추가'}
      tall
      footer={
        <View style={s.foot}>
          {view && (
            <Pressable
              onPress={() => setConfirmDelete(true)}
              disabled={m.busy !== null}
              style={({ pressed }) => [s.ghost, pressed && { borderColor: p.dangerText }]}
            >
              {m.busy === 'delete' ? (
                <ActivityIndicator size="small" color={p.text2} />
              ) : (
                <Trash2 size={14} color={p.text} />
              )}
              <MText size={13}>보기 지우기</MText>
            </Pressable>
          )}
          <View style={s.flex} />
          <Pressable onPress={onClose} style={({ pressed }) => [s.ghost, pressed && { backgroundColor: p.overlay }]}>
            <MText size={13}>취소</MText>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={!m.canSave}
            style={({ pressed }) => [s.primary, !m.canSave && s.disabled, pressed && { backgroundColor: p.primaryHi }]}
          >
            {m.busy === 'save' && <ActivityIndicator size="small" color={INK} />}
            <MText size={13} color={INK}>
              {view ? '저장' : '보기 추가'}
            </MText>
          </Pressable>
        </View>
      }
    >
      <MText size={13} color={p.text2} style={s.sub} numberOfLines={2}>
        {meta.name} · 저장하면 기술팀 모두에게 같은 보기가 보여요
      </MText>
      <ScrollView
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <View style={s.section}>
          <MText size={13} color={p.textSoft}>
            보기 이름
          </MText>
          <FieldInput
            value={draft.name}
            onChangeText={m.setName}
            maxLength={VIEW_LIMITS.name}
            placeholder="예: 일정 확정 건"
            autoFocus={!view}
            compact
            style={s.vinput}
          />
        </View>

        <View style={s.section}>
          <View style={s.rowHead}>
            <MText size={13} color={p.textSoft}>
              조건
            </MText>
            {draft.rules.length > 1 && (
              <View style={s.chips}>
                {(['all', 'any'] as const).map(match => (
                  <Chip
                    key={match}
                    label={match === 'all' ? '모두 만족' : '하나라도 만족'}
                    on={draft.match === match}
                    onPress={() => m.setMatch(match)}
                  />
                ))}
              </View>
            )}
            <View style={s.flex} />
            <MText size={13} color={p.text2}>
              맞는 항목{' '}
              <MText size={13} weight="semibold" color={p.text}>
                {m.matched}
              </MText>{' '}
              / {m.total}
            </MText>
          </View>
          {draft.rules.length === 0 && (
            <MText size={13} color={p.text2}>
              조건이 없으면 모든 항목이 보여요.
            </MText>
          )}
          {draft.rules.map((rule, index) => {
            const column = m.columnOf(rule.columnId);
            const input = m.inputOf(rule);
            const choices = input === 'pick' && column ? m.choicesOf(column) : [];
            return (
              <View key={index} style={s.rule}>
                <View style={s.ruleLine}>
                  {index > 0 && (
                    <MText size={12} color={p.text2}>
                      {draft.match === 'all' ? '그리고' : '또는'}
                    </MText>
                  )}
                  <SelectButton
                    label={column?.title ?? '(지워진 칸)'}
                    onPress={() => setPicking({ kind: 'column', index })}
                    style={s.flex}
                  />
                  <Pressable
                    onPress={() => m.removeRule(index)}
                    hitSlop={6}
                    accessibilityLabel="조건 빼기"
                    style={({ pressed }) => [s.remove, pressed && { backgroundColor: p.overlay }]}
                  >
                    <X size={15} color={p.text2} />
                  </Pressable>
                </View>
                <View style={s.ruleLine}>
                  <SelectButton
                    label={m.opsOf(rule).find(o => o.op === rule.op)?.label ?? rule.op}
                    onPress={() => setPicking({ kind: 'op', index })}
                    style={s.flex}
                  />
                  {input === 'type' && (
                    <FieldInput
                      value={rule.values[0] ?? ''}
                      onChangeText={text => m.setRuleText(index, text)}
                      placeholder={m.isNumber(rule) ? '숫자' : '글자'}
                      keyboardType={m.isNumber(rule) ? 'decimal-pad' : 'default'}
                      compact
                      style={[s.flex, s.vinput]}
                    />
                  )}
                </View>
                {input === 'pick' && column && (
                  <View style={s.chips}>
                    {choices.map(choice => (
                      <Chip
                        key={choice.value}
                        label={choice.label}
                        on={rule.values.includes(choice.value)}
                        onPress={() => m.toggleRuleValue(index, choice.value)}
                      />
                    ))}
                    {choices.length === 0 && (
                      <MText size={13} color={p.text2}>
                        고를 값이 없어요
                      </MText>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          {m.canAddRule && (
            <Pressable onPress={m.addRule} hitSlop={6} style={s.add}>
              <Plus size={14} color={p.link} />
              <MText size={13} color={p.link}>
                조건 추가
              </MText>
            </Pressable>
          )}
        </View>

        <View style={s.section}>
          <MText size={13} color={p.textSoft}>
            정렬
          </MText>
          <View style={s.ruleLine}>
            <SelectButton
              label={draft.sort ? m.columnOf(draft.sort.columnId)?.title ?? '(지워진 칸)' : '정렬 안 함'}
              onPress={() => setPicking({ kind: 'sort' })}
              style={s.flex}
            />
            {draft.sort &&
              ([1, -1] as const).map(dir => (
                <Chip
                  key={dir}
                  label={dir === 1 ? '오름차순' : '내림차순'}
                  on={draft.sort?.dir === dir}
                  onPress={() => m.setSortDir(dir)}
                />
              ))}
          </View>
        </View>

        <View style={s.section}>
          <MText size={13} color={p.textSoft}>
            숨길 칸
          </MText>
          <View style={s.chips}>
            {m.hideable.map(c => (
              <Chip
                key={c.id}
                label={c.title}
                hide
                on={draft.hidden.includes(c.id)}
                onPress={() => m.toggleHidden(c.id)}
              />
            ))}
          </View>
        </View>

        {!!m.error && (
          <MText size={13} color={p.dangerText}>
            저장하지 못했어요: {m.error}
          </MText>
        )}
      </ScrollView>

      {pickSheet && (
        <SelectSheet
          visible
          title={pickSheet.title}
          options={pickSheet.options}
          value={pickSheet.value}
          onPick={pickSheet.onPick}
          onClose={() => setPicking(null)}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={`"${view?.name ?? ''}" 보기를 지울까요?`}
        message="기술팀 모두의 보드에서 이 보기 탭이 사라져요. 항목은 그대로예요."
        confirmLabel="지우기"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          if (await m.remove()) onDeleted();
        }}
      />
    </Sheet>
  );
}

/** 값 칩(웹 .mon-vchip) — 28 높이, 1px 진한 줄, 반경 4. 켜면 파란 줄 + 파란 기운. hide면 켰을 때 가운데 줄·흐린 글 */
function Chip({ label, on, onPress, hide }: { label: string; on: boolean; onPress: () => void; hide?: boolean }) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected: on }}
      style={[
        s.chip,
        on && (hide ? { backgroundColor: p.overlay } : { borderColor: p.primary, backgroundColor: p.toolOn }),
      ]}
    >
      <MText
        size={13}
        numberOfLines={1}
        color={on && hide ? p.text2 : p.text}
        style={on && hide ? s.strike : undefined}
      >
        {label}
      </MText>
    </Pressable>
  );
}

const styles = (p: MonPalette) => ({
  flex: { flex: 1 },
  sub: { paddingHorizontal: 16, marginTop: -2, marginBottom: 6 },
  body: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, gap: 22 },
  section: { gap: 8 },
  vinput: { borderColor: p.lineStrong, backgroundColor: p.bg, height: 34, minHeight: 34, paddingHorizontal: 10 },
  rowHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, flexWrap: 'wrap' as const },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  rule: {
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 8,
    backgroundColor: p.surface,
  },
  ruleLine: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  remove: { width: 28, height: 28, borderRadius: 4, alignItems: 'center' as const, justifyContent: 'center' as const },
  add: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, alignSelf: 'flex-start' as const },
  chip: {
    height: 28,
    maxWidth: '100%' as const,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: p.lineStrong,
    borderRadius: 4,
    justifyContent: 'center' as const,
  },
  strike: { textDecorationLine: 'line-through' as const },
  foot: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  ghost: {
    height: 34,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: p.lineStrong,
    borderRadius: 4,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  primary: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 4,
    backgroundColor: p.primary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  disabled: { opacity: 0.45 },
});
