import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View, type TextInputProps } from 'react-native';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Search,
  X,
} from 'lucide-react-native';
import { labelColor } from '@xtool-core/monday-colors';
import type { TechCellValue, TechColumn } from '@xtool-core/tech-boards';
import {
  filterPick,
  MONDAY_WEEKDAYS,
  statusCommit,
  statusOptions,
  useAssigneePick,
  useDateEditor,
  useDropdownPick,
  useFormEditor,
  useInlineEditor,
  usePeoplePick,
  useRelationPick,
  type CellCommit,
  type CellEditorKind,
  type PickModel,
} from '../../../features/cell-edit';
import { useAddressSearch, type LocationState } from '../../../features/address-search';
import { FONT, INK, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';
import { Avatar, MText } from './basics';
import { SearchField, Sheet, SheetRow } from './chrome';

// 칸 편집기 — 웹 Monday 팝오버(monday-editors·monday-date-picker)를 폰에서는 아래 시트로, 안의 짜임은 같게(§11.6).
// 고르기·달력·칸 입력은 바깥을 누르면 저장(웹 바깥 누르기), 긴 글·링크는 "취소"·"적용"(바깥은 저장). 값 다루기는
// features/cell-edit(주소 검색은 features/address-search), 저장은 부르는 쪽(onCommit → item-view commitCell).

type EditorProps = {
  column: TechColumn;
  cell: TechCellValue | undefined;
  onCommit: (commit: CellCommit) => void;
  onClose: () => void;
};

/** 칸 종류에 맞는 편집 시트 — 체크(바로 바뀜)·파일(파일 보기)은 부르는 쪽이 따로 한다. single은 하위 아이템 부품 칸 */
export function CellEditorSheet({
  kind,
  single,
  ...props
}: EditorProps & { kind: Exclude<CellEditorKind, 'check' | 'file'>; single?: boolean }) {
  switch (kind) {
    case 'status':
      return <StatusSheet {...props} />;
    case 'dropdown':
      return <DropdownSheet {...props} />;
    case 'people':
      return <PeopleSheet {...props} />;
    case 'assignee':
      return <AssigneeSheet {...props} />;
    case 'relation':
      return <RelationSheet {...props} single={single} />;
    case 'date':
      return <DateSheet {...props} />;
    case 'inline':
      return <InlineSheet {...props} />;
    case 'long_text':
      return <LongTextSheet {...props} />;
    case 'link':
      return <LinkSheet {...props} />;
    case 'location':
      return <LocationSheet {...props} />;
  }
}

/** 저장할 것이 있으면 저장하고 닫는다 */
const finishWith = (commit: CellCommit | null, { onCommit, onClose }: Pick<EditorProps, 'onCommit' | 'onClose'>) => {
  if (commit) onCommit(commit);
  onClose();
};

// ── 상태 ─────────────────────────────────────────────────────────────────────────────────────────────────

/** 상태 — 라벨 색 판(44, 반경 2)을 눌러 바로 고른다. 지금 값에는 흰 고리, 맨 끝 "비우기"(점선). */
function StatusSheet({ column, cell, onCommit, onClose }: EditorProps) {
  const p = useMon();
  const s = useStyles(styles);
  const current = cell?.text ?? '';
  const pick = (label: string) => finishWith(statusCommit(column, current, label), { onCommit, onClose });
  return (
    <Sheet visible onClose={onClose} title={column.title}>
      <ScrollView contentContainerStyle={s.statusList}>
        {statusOptions(column, current).map(label => (
          <Pressable
            key={label}
            onPress={() => pick(label)}
            accessibilityState={{ selected: label === current }}
            style={[
              s.statusOption,
              { backgroundColor: labelColor(label) },
              label === current && { boxShadow: `0 0 0 2px ${p.pop}, 0 0 0 3px ${INK}` },
            ]}
          >
            {({ pressed }) => (
              <>
                {/* 웹 눌림 brightness(1.12) — iOS 필터는 어둡게만 돼서 흰 막을 얹는다 */}
                {pressed && <View style={s.brighten} />}
                <MText color={INK} numberOfLines={1}>
                  {label}
                </MText>
              </>
            )}
          </Pressable>
        ))}
        <Pressable
          onPress={() => pick('')}
          style={({ pressed }) => [s.statusOption, s.statusClear, pressed && { backgroundColor: p.overlay }]}
        >
          <MText color={p.text2}>비우기</MText>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

// ── 고르기 목록 ──────────────────────────────────────────────────────────────────────────────────────────

function DropdownSheet(props: EditorProps) {
  return <PickSheet {...props} model={useDropdownPick(props.column, props.cell)} />;
}

function PeopleSheet(props: EditorProps) {
  return <PickSheet {...props} model={usePeoplePick(props.column, props.cell)} />;
}

function AssigneeSheet(props: EditorProps) {
  return <PickSheet {...props} model={useAssigneePick(props.column, props.cell)} />;
}

function RelationSheet(props: EditorProps & { single?: boolean }) {
  return <PickSheet {...props} model={useRelationPick(props.column, props.cell, props.single)} />;
}

/**
 * 여러 개 고르기(웹 PickList) — 위에 고른 것(토큰), 검색, 목록(사람은 26 동그라미). 목록을 누르면 토큰으로 옮긴다.
 * 닫을 때 저장(웹 바깥 누르기). 하나만 잇는 칸은 고르면 바로 저장하고 닫는다.
 */
function PickSheet({ column, model, onCommit, onClose }: EditorProps & { model: PickModel }) {
  const p = useMon();
  const s = useStyles(styles);
  const [query, setQuery] = useState('');
  const shown = filterPick(model.options, model.selected, query);
  const close = () => finishWith(model.finish(), { onCommit, onClose });
  const now = (commit: CellCommit | null) => {
    if (model.single) finishWith(commit, { onCommit, onClose });
  };
  return (
    <Sheet visible onClose={close} title={column.title} tall>
      <View style={s.pickHead}>
        {model.selected.length > 0 && (
          <View style={s.tokens}>
            {model.selected.map(value => (
              <View key={value} style={s.token}>
                <MText size={13} numberOfLines={1} style={s.tokenLabel}>
                  {model.labelOf(value)}
                </MText>
                <Pressable
                  onPress={() => now(model.remove(value))}
                  hitSlop={6}
                  accessibilityLabel={`${model.labelOf(value)} 빼기`}
                  style={({ pressed }) => [s.tokenX, pressed && { backgroundColor: p.overlayStrong }]}
                >
                  <X size={11} color={p.text} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={model.searchPlaceholder}
          autoFocus={false}
          focusBorder
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.pickList}>
        {shown.length === 0 && (
          <MText size={13} color={p.text2} style={s.pickEmpty}>
            {model.empty}
          </MText>
        )}
        {shown.map(option => (
          <Pressable
            key={option.value}
            onPress={() => now(model.add(option.value))}
            style={({ pressed }) => [s.pickOption, pressed && { backgroundColor: p.overlay }]}
          >
            {model.people && <Avatar name={option.label} size={26} />}
            <MText numberOfLines={1} style={s.flex}>
              {option.label}
            </MText>
            {option.sub ? (
              <MText size={12} color={p.text2} numberOfLines={1} style={s.pickSub}>
                {option.sub}
              </MText>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

// ── 날짜 ─────────────────────────────────────────────────────────────────────────────────────────────────

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * 날짜 칸 달력(웹 DatePicker) — "오늘"·시각 켜기, 날짜 입력(YYYY-MM-DD 등)·시각(HH:MM), 월·연도 고르기와 화살표, 월요일부터
 * 6주. 날짜를 누르면 저장하고 닫힌다. 원래 날짜가 있던 칸은 아래 "날짜 지우기".
 */
function DateSheet({ column, cell, onCommit, onClose }: EditorProps) {
  const p = useMon();
  const s = useStyles(styles);
  const m = useDateEditor(column, cell);
  const [select, setSelect] = useState<'month' | 'year' | null>(null);
  const done = (commit: CellCommit | null) => finishWith(commit, { onCommit, onClose });
  return (
    <Sheet visible onClose={() => done(m.finish())} title={column.title}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.date}>
        <View style={s.dateTop}>
          <Pressable onPress={m.goToday} style={({ pressed }) => [s.today, pressed && { backgroundColor: p.overlay }]}>
            <MText size={13}>오늘</MText>
          </Pressable>
          <Pressable
            onPress={m.toggleTime}
            accessibilityLabel={m.withTime ? '시각 빼기' : '시각 넣기'}
            accessibilityState={{ selected: m.withTime }}
            style={({ pressed }) => [s.clock, pressed && { backgroundColor: p.overlay }]}
          >
            <Clock size={16} color={m.withTime ? p.link : p.text2} />
          </Pressable>
        </View>
        <View style={s.dateInputs}>
          <FieldInput
            value={m.text}
            onChangeText={m.typeDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            selectTextOnFocus
            onSubmitEditing={() => {
              const commit = m.submitText();
              if (commit) done(commit);
            }}
            compact
            style={s.flex}
          />
          {m.withTime && (
            <FieldInput
              value={m.time}
              onChangeText={m.typeTime}
              placeholder="HH:MM"
              keyboardType="number-pad"
              selectTextOnFocus
              compact
              style={s.time}
            />
          )}
        </View>
        <View style={s.nav}>
          <BareSelect label={`${m.view.month}월`} onPress={() => setSelect('month')} />
          <BareSelect label={String(m.view.year)} onPress={() => setSelect('year')} />
          <View style={s.flex} />
          <Pressable onPress={() => m.shift(-1)} hitSlop={4} accessibilityLabel="이전 달" style={s.arrow}>
            <ChevronLeft size={16} color={p.text} />
          </Pressable>
          <Pressable onPress={() => m.shift(1)} hitSlop={4} accessibilityLabel="다음 달" style={s.arrow}>
            <ChevronRight size={16} color={p.text} />
          </Pressable>
        </View>
        <View style={s.week}>
          {MONDAY_WEEKDAYS.map(w => (
            <MText key={w} size={13} color={p.text2} style={s.weekday}>
              {w}
            </MText>
          ))}
        </View>
        <View style={s.days}>
          {m.grid.map(d => {
            const selected = d.date === m.date;
            return (
              <View key={d.date} style={s.dayCell}>
                <Pressable
                  onPress={() => done(m.pick(d.date))}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    s.day,
                    selected ? { backgroundColor: p.primary } : pressed && { backgroundColor: p.overlayStrong },
                  ]}
                >
                  <MText size={14} color={selected ? INK : !d.inMonth ? p.muted : d.date === m.today ? p.link : p.text}>
                    {d.day}
                  </MText>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {m.hadDate && (
        <Pressable
          onPress={() => done(m.clear())}
          style={({ pressed }) => [s.dateFoot, pressed && { backgroundColor: p.overlay }]}
        >
          <MText color={p.text2}>날짜 지우기</MText>
        </Pressable>
      )}
      <SelectSheet
        visible={select === 'month'}
        title="월"
        options={MONTHS.map(month => ({ value: String(month), label: `${month}월` }))}
        value={String(m.view.month)}
        onPick={month => m.setView({ ...m.view, month: Number(month) })}
        onClose={() => setSelect(null)}
      />
      <SelectSheet
        visible={select === 'year'}
        title="연도"
        options={m.years.map(year => ({ value: String(year), label: String(year) }))}
        value={String(m.view.year)}
        onPick={year => m.setView({ ...m.view, year: Number(year) })}
        onClose={() => setSelect(null)}
      />
    </Sheet>
  );
}

/** 테두리 없는 고르기 단추(웹 MonSelect bare — 달력의 월·연도) — 30 높이, 아래 갈매기 */
export function BareSelect({ label, onPress }: { label: string; onPress: () => void }) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.bare, pressed && { backgroundColor: p.overlay }]}>
      <MText>{label}</MText>
      <ChevronDown size={14} color={p.text2} />
    </Pressable>
  );
}

/** 고르기 단추(웹 MonSelect) — 34 높이, 1px 진한 줄, 반경 4, 오른쪽 갈매기. 누르면 SelectSheet를 연다 */
export function SelectButton({ label, onPress, style }: { label: string; onPress: () => void; style?: object }) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.select, pressed && { borderColor: p.control }, style]}>
      <MText numberOfLines={1} style={s.flex}>
        {label}
      </MText>
      <ChevronDown size={14} color={p.text2} />
    </Pressable>
  );
}

/** 하나 고르기 목록(웹 MonSelect 펼친 목록) — 고른 것은 파란 기운 + 체크, 9개부터 "찾기" 칸 */
export function SelectSheet({
  visible,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const p = useMon();
  const s = useStyles(styles);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter(o => o.label.toLowerCase().includes(needle)) : options;
  return (
    <Sheet visible={visible} onClose={onClose} title={title} tall={options.length > 12}>
      {options.length >= 9 && (
        <View style={s.selectSearch}>
          <SearchField value={query} onChange={setQuery} placeholder="찾기" autoFocus={false} focusBorder />
        </View>
      )}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.selectList}>
        {shown.length === 0 && (
          <MText size={13} color={p.text2} style={s.pickEmpty}>
            찾는 것이 없어요
          </MText>
        )}
        {shown.map(o => (
          <SheetRow
            key={o.value}
            label={o.label}
            on={o.value === value}
            onPress={() => {
              onPick(o.value);
              onClose();
            }}
            right={o.value === value ? <Check size={14} color={p.link} /> : null}
          />
        ))}
      </ScrollView>
    </Sheet>
  );
}

// ── 칸 안 입력·긴 글·링크 ────────────────────────────────────────────────────────────────────────────────

/**
 * 입력 칸(웹 field input의 Monday 모양) — 1px 진한 회색 줄, 반경 4, 포커스 때 파란 줄. 줄 색은 입력 칸 자신에만 준다
 * (조상 스타일을 포커스로 바꾸면 Fabric이 입력 칸을 옮겨 달아 키보드가 내려간다).
 */
export function FieldInput({
  compact,
  style,
  multiline,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { compact?: boolean }) {
  const p = useMon();
  const s = useStyles(styles);
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={p.text2}
      keyboardAppearance={p.scheme}
      autoCorrect={false}
      {...props}
      multiline={multiline}
      onFocus={e => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={e => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        s.field,
        compact && s.fieldCompact,
        multiline && s.textarea,
        { borderColor: compact ? p.text2 : p.control },
        style,
        focused && { borderColor: p.primary },
      ]}
    />
  );
}

/** 취소 · 적용 — 오른쪽 끝(웹 .mon-form__actions). disabled면 적용이 흐리다 */
export function FormActions({
  onCancel,
  onApply,
  disabled,
  applyLabel = '적용',
}: {
  onCancel: () => void;
  onApply: () => void;
  disabled?: boolean;
  applyLabel?: string;
}) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    <View style={s.actions}>
      <Pressable onPress={onCancel} style={({ pressed }) => [s.cancel, pressed && { backgroundColor: p.overlay }]}>
        <MText size={14}>취소</MText>
      </Pressable>
      <Pressable
        onPress={onApply}
        disabled={disabled}
        style={({ pressed }) => [s.apply, disabled && s.disabled, pressed && { backgroundColor: p.primaryHi }]}
      >
        <Check size={13} strokeWidth={2.6} color={INK} />
        <MText size={14} color={INK}>
          {applyLabel}
        </MText>
      </Pressable>
    </View>
  );
}

/**
 * 한 줄 입력 시트 — 칸 글자·이름 바꾸기. 키보드 위에 입력 하나(바로 포커스), 완료(엔터)·적용·바깥 누르기는 저장, 취소는
 * 그대로. 숫자·전화 키패드엔 완료 키가 없어 아래 적용 단추가 있다.
 */
export function TextSheet({
  title,
  value,
  onChangeText,
  onDone,
  onCancel,
  keyboardType = 'default',
  selectAll = true,
  placeholder,
  disabled,
}: {
  title: string;
  value: string;
  onChangeText: (text: string) => void;
  onDone: () => void;
  onCancel: () => void;
  keyboardType?: TextInputProps['keyboardType'];
  /** 처음 포커스 때 글자 전체 선택(바로 덮어 쓴다) — 미리 적은 010은 끝에 커서 */
  selectAll?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const s = useStyles(styles);
  return (
    <Sheet
      visible
      onClose={onDone}
      title={title}
      closeButton={false}
      footer={<FormActions onCancel={onCancel} onApply={onDone} disabled={disabled} />}
    >
      <View style={s.form}>
        <FieldInput
          value={value}
          onChangeText={onChangeText}
          autoFocus
          selectTextOnFocus={selectAll}
          keyboardType={keyboardType}
          autoCapitalize="none"
          returnKeyType="done"
          placeholder={placeholder}
          onSubmitEditing={onDone}
        />
      </View>
    </Sheet>
  );
}

/** 글·숫자·연락처·이메일 칸(웹 InlineInput) — 연락처는 010 미리·하이픈·9자리 미만은 저장 안 함 */
function InlineSheet({ column, cell, onCommit, onClose }: EditorProps) {
  const m = useInlineEditor(column, cell);
  return (
    <TextSheet
      title={column.title}
      value={m.value}
      onChangeText={m.setValue}
      keyboardType={m.keyboardType}
      selectAll={!m.prefilled}
      onDone={() => finishWith(m.finish(), { onCommit, onClose })}
      onCancel={onClose}
    />
  );
}

/** 긴 글(웹 FormEditor long_text) — 6줄 글 칸 */
function LongTextSheet({ column, cell, onCommit, onClose }: EditorProps) {
  const s = useStyles(styles);
  const m = useFormEditor<string>(column, cell);
  const apply = () => finishWith(m.finish(), { onCommit, onClose });
  return (
    <Sheet
      visible
      onClose={apply}
      title={column.title}
      closeButton={false}
      tall
      footer={<FormActions onCancel={onClose} onApply={apply} disabled={!m.changed} />}
    >
      <View style={s.form}>
        <FieldInput value={m.value} onChangeText={m.setValue} multiline autoFocus autoCapitalize="none" />
      </View>
    </Sheet>
  );
}

/** 링크(웹 FormEditor link) — 주소 + 보일 글자(선택) */
function LinkSheet({ column, cell, onCommit, onClose }: EditorProps) {
  const s = useStyles(styles);
  const m = useFormEditor<{ url: string; text: string }>(column, cell);
  const apply = () => finishWith(m.finish(), { onCommit, onClose });
  return (
    <Sheet
      visible
      onClose={apply}
      title={column.title}
      closeButton={false}
      footer={<FormActions onCancel={onClose} onApply={apply} disabled={!m.changed} />}
    >
      <View style={s.form}>
        <FieldInput
          value={m.value.url}
          onChangeText={url => m.setValue({ ...m.value, url })}
          placeholder="https://"
          keyboardType="url"
          autoCapitalize="none"
          autoFocus
        />
        <FieldInput
          value={m.value.text}
          onChangeText={text => m.setValue({ ...m.value, text })}
          placeholder="보일 글자(선택)"
        />
      </View>
    </Sheet>
  );
}

/**
 * 주소(웹 FormEditor location + LocationInput) — 지금 주소(좌표 없으면 안내)·지우기, 상세 주소, 검색 칸 + "검색" → 결과 줄
 * (장소·도로명 + 지번)을 누르면 좌표까지 들어간다. 오류·빈 결과는 안내, 좌표 없는 주소는 저장하지 않는다(적용 흐림).
 * 검색·고르기는 features/address-search, 저장 규칙은 cell-edit useFormEditor.
 */
function LocationSheet({ column, cell, onCommit, onClose }: EditorProps) {
  const p = useMon();
  const s = useStyles(styles);
  const m = useFormEditor<LocationState>(column, cell);
  const a = useAddressSearch(m.value, m.setValue);
  const value = m.value;
  const apply = () => finishWith(m.finish(), { onCommit, onClose });
  return (
    <Sheet
      visible
      onClose={apply}
      title={column.title}
      closeButton={false}
      tall
      footer={<FormActions onCancel={onClose} onApply={apply} disabled={!m.changed || !m.savable} />}
    >
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.form}>
        {value.address ? (
          <View style={s.address}>
            <MapPin size={15} color={p.text2} style={s.addressPin} />
            <View style={s.flex}>
              <MText style={s.addressText}>{value.address}</MText>
              {!a.hasCoords && (
                <MText size={12} color={p.dangerText} style={s.addressText}>
                  좌표 없음 — 다시 검색해 고르면 저장할 수 있어요
                </MText>
              )}
            </View>
            <Pressable onPress={a.clear} hitSlop={8} accessibilityRole="button">
              <MText size={13} color={p.link}>
                지우기
              </MText>
            </Pressable>
          </View>
        ) : (
          <MText size={13} color={p.text2} style={s.addressEmpty}>
            주소 없음 — 아래에서 검색해 골라 주세요
          </MText>
        )}
        {!!value.address && (
          <FieldInput
            value={value.detail}
            onChangeText={a.setDetail}
            placeholder="상세 주소(동·호수, 층 등)"
            editable={a.hasCoords}
            style={!a.hasCoords && s.disabled}
          />
        )}
        {a.maps && (
          <View style={s.mapLinks}>
            <Pressable onPress={a.maps.view} hitSlop={8} accessibilityRole="link" style={s.mapLink}>
              <ExternalLink size={14} color={p.link} />
              <MText size={13} color={p.link}>
                카카오맵에서 보기
              </MText>
            </Pressable>
            {a.maps.route && (
              <Pressable onPress={a.maps.route} hitSlop={8} accessibilityRole="link" style={s.mapLink}>
                <Navigation size={14} color={p.link} />
                <MText size={13} color={p.link}>
                  길찾기
                </MText>
              </Pressable>
            )}
          </View>
        )}
        <View style={s.searchRow}>
          <FieldInput
            value={a.query}
            onChangeText={a.setQuery}
            placeholder={value.address ? '다른 주소로 바꾸기 — 도로명·지번, 장소' : '도로명·지번 주소나 장소 이름'}
            returnKeyType="search"
            onSubmitEditing={() => void a.run()}
            autoFocus={!value.address}
            style={s.flex}
          />
          <Pressable
            onPress={() => void a.run()}
            disabled={a.searching}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.searchButton,
              a.searching && s.disabled,
              pressed && { backgroundColor: p.overlay },
            ]}
          >
            {a.searching ? <ActivityIndicator size="small" color={p.text2} /> : <Search size={14} color={p.text} />}
            <MText size={14}>{a.searching ? '찾는 중…' : '검색'}</MText>
          </Pressable>
        </View>
        {!!a.error && (
          <View style={s.addressError}>
            <MText size={13} color={p.dangerText} style={s.flex}>
              {a.error}
            </MText>
            {a.query.trim().length >= 2 && !a.searching && (
              <Pressable onPress={() => void a.run()} hitSlop={8}>
                <MText size={13} color={p.link}>
                  다시 찾기
                </MText>
              </Pressable>
            )}
          </View>
        )}
        {a.results?.length === 0 && (
          <Notice>{`‘${a.searched}’에 맞는 주소가 없어요\n도로명·지번 주소나 건물 이름으로 다시 찾아 보세요.`}</Notice>
        )}
        {!!a.results?.length && (
          <View style={s.results}>
            {a.results.map((r, i) => (
              <Pressable
                key={`${r.lat},${r.lng},${r.label}`}
                onPress={() => a.pick(r)}
                style={({ pressed }) => [s.result, i > 0 && s.resultLine, pressed && { backgroundColor: p.overlay }]}
              >
                <MText numberOfLines={2}>{r.label}</MText>
                {r.label !== r.address && (
                  <MText size={13} color={p.textSoft} numberOfLines={2}>
                    {r.address}
                  </MText>
                )}
                {!!r.jibun && (
                  <MText size={12} color={p.text2} numberOfLines={1}>
                    지번 {r.jibun}
                  </MText>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

/** 안내 한 줄 — 흐린 글, 바탕 살짝 */
export function Notice({ children }: { children: ReactNode }) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    <View style={s.notice}>
      <MText size={13} color={p.text2} style={s.noticeText}>
        {children}
      </MText>
    </View>
  );
}

const styles = (p: MonPalette) => ({
  flex: { flex: 1 },
  statusList: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 6 },
  statusOption: {
    height: 44,
    borderRadius: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 12,
    overflow: 'visible' as const,
  },
  brighten: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  statusClear: { borderWidth: 1, borderStyle: 'dashed' as const, borderColor: p.text2 },
  pickHead: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 8 },
  tokens: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 4 },
  token: {
    height: 24,
    maxWidth: '100%' as const,
    paddingLeft: 8,
    paddingRight: 3,
    borderRadius: 12,
    backgroundColor: p.chip,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
  },
  tokenLabel: { flexShrink: 1 },
  tokenX: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pickList: { paddingHorizontal: 8, paddingBottom: 8 },
  pickEmpty: { paddingHorizontal: 8, paddingVertical: 10 },
  pickOption: {
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  pickSub: { maxWidth: '45%' as const },
  date: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 },
  dateTop: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  today: {
    height: 30,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: p.text2,
    borderRadius: 4,
    justifyContent: 'center' as const,
  },
  clock: { width: 30, height: 30, borderRadius: 4, alignItems: 'center' as const, justifyContent: 'center' as const },
  dateInputs: { flexDirection: 'row' as const, gap: 8 },
  time: { width: 112 },
  nav: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2 },
  bare: {
    height: 30,
    paddingLeft: 8,
    paddingRight: 6,
    borderRadius: 4,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  arrow: { width: 30, height: 30, borderRadius: 4, alignItems: 'center' as const, justifyContent: 'center' as const },
  week: { flexDirection: 'row' as const },
  weekday: { flex: 1, height: 30, lineHeight: 30, textAlign: 'center' as const },
  days: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, rowGap: 4 },
  dayCell: { width: `${100 / 7}%` as const, alignItems: 'center' as const },
  day: { width: 40, height: 36, borderRadius: 4, alignItems: 'center' as const, justifyContent: 'center' as const },
  dateFoot: {
    borderTopWidth: 1,
    borderColor: p.line,
    paddingVertical: 12,
    alignItems: 'center' as const,
  },
  select: {
    height: 34,
    paddingLeft: 10,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: p.lineStrong,
    borderRadius: 4,
    backgroundColor: p.bg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  selectSearch: { paddingHorizontal: 16, paddingBottom: 8 },
  selectList: { paddingHorizontal: 8, paddingBottom: 8, gap: 2 },
  form: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, gap: 8 },
  field: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontFamily: FONT.medium,
    fontSize: 15,
    color: p.text,
    backgroundColor: 'transparent',
  },
  fieldCompact: { minHeight: 32, height: 32, paddingHorizontal: 8, fontSize: 14 },
  textarea: { minHeight: 150, maxHeight: 320, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' as const },
  actions: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 8 },
  cancel: { height: 36, paddingHorizontal: 14, borderRadius: 4, justifyContent: 'center' as const },
  apply: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 4,
    backgroundColor: p.primary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  disabled: { opacity: 0.45 },
  address: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8, paddingVertical: 6 },
  addressPin: { marginTop: 3 },
  addressText: { lineHeight: 21 },
  addressEmpty: { paddingVertical: 6 },
  mapLinks: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 18, paddingVertical: 2 },
  mapLink: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  searchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  searchButton: {
    height: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: p.control,
    borderRadius: 4,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  addressError: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  results: { borderWidth: 1, borderColor: p.line, borderRadius: 4, overflow: 'hidden' as const },
  result: { paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  resultLine: { borderTopWidth: 1, borderColor: p.line },
  notice: { borderRadius: 6, backgroundColor: p.overlay, paddingHorizontal: 12, paddingVertical: 10 },
  noticeText: { lineHeight: 19 },
});
