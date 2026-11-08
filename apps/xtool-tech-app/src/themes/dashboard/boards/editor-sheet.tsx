import { View } from 'react-native';
import { Save } from 'lucide-react-native';
import { koreaToday } from '@xtool-core/dates';
import type { TechBoardKey, TechBoardMeta, TechItemDoc } from '@xtool-core/tech-boards';
import {
  useItemEditor,
  useRelationOptions,
  type EditorField,
  type ItemEditorModel,
} from '../../../features/dashboard/item-editor';
import { layout } from '../layout';
import { useParts } from '../parts';

// 편집 시트 — 웹 ItemEditor(상세 위에 겹쳐 뜨는 편집 패널)를 폰에서는 아래에서 올라오는 긴 시트로. 이름(필수) → 비고 →
// 진행 단계·상태 → 나머지 칸(날짜 모아서·드롭다운) → 하위 줄(보기만) → "Monday에서만 / 웹에서만 고칠 수 있는 칸" →
// 취소·저장(만들기). 저장하면 바로 닫고 Monday에는 뒤에서 쓴다(대기열 — 실패는 토스트). 규칙은 features/dashboard/item-editor.

interface EditorSheetProps {
  visible: boolean;
  boardKey: TechBoardKey;
  meta: TechBoardMeta | null;
  /** 고칠 항목 — null이면 새로 만들기 */
  item: TechItemDoc | null;
  onClose: () => void;
}

/** 열 때마다 처음 값을 새로 잡게, 열려 있을 때만 그린다 */
export function EditorSheet({ visible, meta, ...rest }: EditorSheetProps) {
  if (!visible || !meta) return null;
  return <OpenEditor meta={meta} {...rest} />;
}

function OpenEditor({
  boardKey,
  meta,
  item,
  onClose,
}: Omit<EditorSheetProps, 'visible' | 'meta'> & { meta: TechBoardMeta }) {
  const P = useParts();
  const e = useItemEditor(boardKey, meta, item);
  const save = () => {
    if (e.save()) onClose();
  };
  return (
    <P.Sheet
      visible
      tall
      onClose={onClose}
      title={e.title}
      subtitle={e.itemName ? `${e.boardName} · ${e.itemName}` : e.boardName}
      footer={
        <View style={layout.tight}>
          {e.error && <P.Notice tone="error" text={e.error} />}
          <View style={layout.end}>
            <P.Button variant="secondary" label="취소" onPress={onClose} />
            <P.Button icon={Save} label={e.saveLabel} onPress={save} disabled={!e.dirty} />
          </View>
        </View>
      }
    >
      <View style={layout.stack}>
        <P.TextField
          label="이름"
          required
          value={e.name}
          onChangeText={e.setName}
          changed={e.nameChanged}
          returnKeyType="done"
          onSubmitEditing={save}
        />
        {e.noteFields.map(field => (
          <FieldEditor key={field.id} field={field} editor={e} />
        ))}
        {e.group && (
          <P.ChoiceField
            label="진행 단계"
            options={e.group.options}
            value={e.group.value ? [e.group.value] : []}
            onChange={next => {
              if (next[0] && e.group) e.group.set(next[0]);
            }}
            changed={e.group.changed}
          />
        )}
        {e.statusField && <FieldEditor field={e.statusField} editor={e} />}
        {e.fields.map(field => (
          <FieldEditor key={field.id} field={field} editor={e} />
        ))}
        {e.subitems && (
          <>
            <P.SubitemList title={e.subitems.title} items={e.subitems.items} empty="하위 줄이 없어요." />
            <P.Notice tone="info" text="하위 줄은 아직 웹에서 고쳐요." />
          </>
        )}
        {e.locked.length > 0 && <P.Notice tone="info" text={`Monday에서만 고칠 수 있는 칸: ${e.locked.join(', ')}`} />}
        {e.webOnly.length > 0 && <P.Notice tone="info" text={`웹에서 고칠 수 있는 칸: ${e.webOnly.join(', ')}`} />}
      </View>
    </P.Sheet>
  );
}

/** 칸 하나 — 종류별 편집기(웹 ColumnInput) */
function FieldEditor({ field, editor }: { field: EditorField; editor: ItemEditorModel }) {
  const P = useParts();
  switch (field.kind) {
    case 'text':
      return (
        <P.TextField
          label={field.label}
          value={field.value}
          onChangeText={text => editor.setText(field, text)}
          multiline={field.multiline}
          keyboardType={field.keyboardType}
          autoCapitalize="none"
          changed={field.changed}
          onFocus={() => editor.focusText(field)}
          onBlur={() => editor.blurText(field)}
        />
      );
    case 'link':
      return (
        <View style={layout.tight}>
          <P.TextField
            label={field.label}
            value={field.value.url}
            placeholder="https://"
            keyboardType="url"
            autoCapitalize="none"
            changed={field.changed}
            onChangeText={url => editor.setValue(field.id, { ...field.value, url })}
          />
          <P.TextField
            value={field.value.text}
            placeholder="보일 글자(선택)"
            autoCapitalize="none"
            onChangeText={text => editor.setValue(field.id, { ...field.value, text })}
          />
        </View>
      );
    case 'choice':
      return (
        <P.ChoiceField
          label={field.label}
          options={field.options}
          value={field.value}
          multiple={field.multiple}
          searchable={field.searchable}
          clearable={field.clearable}
          hint={field.hint}
          changed={field.changed}
          placeholder={field.source === 'status' ? '(비어 있음)' : '고르기'}
          onChange={next =>
            editor.setValue(
              field.id,
              field.source === 'status' ? next[0] ?? '' : field.source === 'assignee' ? next.join(', ') : next,
            )
          }
        />
      );
    case 'relation':
      return <RelationEditor field={field} editor={editor} />;
    case 'date':
      return (
        <P.DateField
          label={field.label}
          value={field.value}
          today={koreaToday()}
          withTime
          clearable
          changed={field.changed}
          onChange={value => editor.setValue(field.id, value)}
        />
      );
    case 'check':
      return (
        <P.CheckField
          label={field.label}
          value={field.value}
          changed={field.changed}
          onChange={value => editor.setValue(field.id, value)}
        />
      );
  }
}

/** 연결 칸(웹 RelationPicker) — 가리키는 보드의 기록에서 고른다 */
function RelationEditor({
  field,
  editor,
}: {
  field: Extract<EditorField, { kind: 'relation' }>;
  editor: ItemEditorModel;
}) {
  const P = useParts();
  const { options, loading } = useRelationOptions(field.linkedBoardKey, field.value, field.fallbackText);
  return (
    <P.ChoiceField
      label={field.label}
      options={options}
      value={field.value}
      multiple
      searchable
      clearable
      changed={field.changed}
      hint={loading ? '목록을 불러오는 중…' : null}
      onChange={next => editor.setValue(field.id, next)}
    />
  );
}
