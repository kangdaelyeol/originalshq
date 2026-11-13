import { createContext, createElement, useContext, type ComponentType, type ReactElement, type ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { AttentionTile } from '@xtool-core/attention';
import type { KpiTint, KpiTone } from '@xtool-core/board-kpis';
import type { TeamMemberStatus } from '@xtool-core/team-status';
import type { TechBoardKey } from '@xtool-core/tech-boards';
import type { KingDef, KingPeriod, KingResult, KingRow } from '@xtool-core/tech-kings';
import type { PhoneAction } from '../../features/phone-call';

/*
 * ── 바뀐 기록 ────────────────────────────────────────────────────────────────────────────────────────────
 * 이 계약은 글라스(themes/glass)·물(themes/water)이 동시에 구현한다. 1판을 쓴 뒤로는 **더하기만** 한다(새 부품·선택
 * prop). 바꿀 때마다 아래에 한 줄 — 무엇을·왜. 구현하는 쪽은 이 기록을 보고 따라 더한다.
 *
 * 1판 (2026-11-08) — 처음 판. 기본(Text·Icon·Card·StatCard·KpiGrid·Avatar·AvatarStack·Button·IconButton·Segmented·
 *   StatusPill·Chip·SearchField·TextField·BarList·Spinner), 화면 틀(Screen·ScreenHeader·Section·EmptyState·Notice·
 *   Skeleton·Sheet·OptionRow·ConfirmDialog), 보드(RecordList·RecordRow·SelectionBar·StagePill·Assignees·PhoneLink·
 *   UpcomingList·MiniList·DetailShell·DetailFields·DetailText·DetailList·편집기 ChoiceField·DateField·CheckField·
 *   업데이트 UpdateComposer·UpdateCard·FileList·SubitemList), 개요(AttentionRow·KingCard·TeamCard·WorkRow·ScheduleDay·
 *   BoardTile·PersonRow), 설정(AppearanceSettings).
 *   (같은 날 주석만 고침 — 도우미 이름 teamMemberViews·fileView, 동작·props 변화 없음)
 * 1.1 (2026-11-08) — 편집기 칸에 선택 prop 더함: TextField·ChoiceField·DateField·CheckField에 `changed?`(웹 편집 패널의
 *   "바뀜" 표시 — 처음 값과 달라진 칸), TextField에 `onFocus?`·`onBlur?`(빈 연락처 칸에 들어오면 010을 미리 적고, 그대로
 *   나가면 비우는 웹 동작 — 화면이 넘긴다). 포커스 효과는 여전히 형제 레이어로.
 * 1.2 (2026-11-08, 주석만 — props 변화 없음) 화면이 실제로 쓰는 모양을 적어 둠: DetailShell 본문에는 DetailFields·
 *   DetailText·DetailList·FileList·Notice가 차례로 오고(업데이트 탭이면 UpdateComposer·Notice·UpdateCard들) 그 사이 간격·
 *   좌우 여백은 테마가 준다(Screen처럼). Card padded=false 안에는 줄 부품(WorkRow·PersonRow·OptionRow·RecordRow)이 차례로
 *   오고 그 뒤에 "더 보기" Button(plain, block)이 올 수 있다 — 줄 사이 구분선은 테마가. Sheet 안에는 OptionRow가 차례로
 *   오거나(고르기) 화면이 쌓은 View 하나(편집 칸들)가 온다.
 * 1.3 (2026-11-11) — 기록 줄에 선택 칸 더함(출장업무 카드를 Monday 테마와 같게): RecordRowData에 `phone?`(전화 단추 —
 *   {number, beside?}: beside면 이름 오른쪽, 아니면 이름 아래 한 줄. 누르면 전화(part-data callPhone)), `corner?`(오른쪽
 *   아래 작은 글 — '접수 11/9'), `subitems?`({label, count} — 하위 아이템 단추 "설치 품목 3개 ›"), RecordRowProps에
 *   `onPressSubitems?`, RecordListProps에 `onPressSubitems?(id)`. 단추(전화·하위 아이템)는 고르는 중에는 누르지 않게(줄
 *   누름과 같게 고르기로) 그린다. 출장업무는 stage·subtitle을 넣지 않고, 전화번호를 보이던 보드(AS·아톡문의·AS 신청서·
 *   대여품)는 subtitle·meta의 번호 대신 phone으로 넣는다.
 * 1.4 (2026-11-13) — 번호를 누르면 복사(출장업무): RecordRowData `phone`에 `action?`, PhoneLinkProps에 `action?`
 *   ('call' | 'copy', 없으면 전화). 누름은 part-data pressPhone(number, action), 화면 읽기 이름은 phoneActionLabel로.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

// 대시보드 짜임의 부품 계약 — 웹 components/layout-parts.tsx·basic-parts.tsx(레이아웃에 따라 바꿔 끼우는 부품)를 폰에
// 맞춘 것. 화면(themes/dashboard/screens)은 한 벌이고 이 부품만으로 그린다 — 색·글꼴·둥글기·그림자·간격은 모두 부품
// 안(테마)에서 정하고, 화면은 배치(flex·gap)만 한다. 글라스·물이 같은 props로 구현해 PartsProvider로 준다.
//
// 원칙
// - props는 데이터·콜백·ReactNode 칸만. 겉 여백용 style(StyleProp<ViewStyle>)만 받는다(모양은 바꾸지 않는다).
// - 동작(저장·이동·거르기·정렬)은 features 훅이 하고, 부품은 받은 값을 그리고 누름을 알린다. 부품 안에 두어도 되는
//   상태는 "보이는 것"뿐이다(시트 열림, 펼침, 답글 입력 칸 같은 것).
// - 같은 숫자·글이 나와야 하는 계산(막대 몫·"기타" 묶기, 날짜 칸 글, 왕 카드 순위·꼬리 글, 팀 카드 보드 글, 달력 칸)은
//   features/dashboard/part-data.ts의 함수를 부른다 — 테마마다 따로 세지 않는다.
// - Fabric 키보드 함정: 포커스된 TextInput의 조상에서 포커스에 따라 shadow*·opacity·transform·zIndex를 바꾸면 키보드가
//   바로 내려간다(docs/xtool-tech-app/01-keyboard-fabric-flattening.md). 포커스 효과는 형제 레이어(절대 위치)에 준다.
// - 글은 웹과 같은 한국어 낱말. 빈 값은 '—'.

// ── 공용 값 ───────────────────────────────────────────────────────────────────────────────────────────────

/** 상태 색 — 의미가 있을 때만(웹 ohq-ui Tone과 같다: 정상·주의·위험·안내·보통) */
export type Tone = KpiTone;

/** 진행 단계 — 단계 알약 색·글은 core tech-stage의 stageTone·stageLabel로 정한다(웹 cells.tsx StagePill) */
export interface StageValue {
  stage: string | null;
  status: string | null;
}

/** 알약 하나의 데이터 */
export interface PillData {
  label: string;
  tone: Tone;
  /** 앞의 작은 점 — 'pulse'면 깜빡인다 */
  dot?: boolean | 'pulse';
}

/** 고르기 단추 하나(Segmented·Chip 묶음) */
export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** 겉 여백용 — 부품의 바깥 자리만 정한다 */
type Outer = { style?: StyleProp<ViewStyle> };

// ── 기본 부품 (웹 basic-parts — ohq-ui components) ─────────────────────────────────────────────────────────

/**
 * 글자 변형 — 화면의 모든 글은 Text로 쓴다(RN Text를 화면에서 직접 쓰지 않는다).
 * title: 카드 안 큰 제목 · heading: 카드·구역 제목(웹 card__title) · body: 본문 · strong: 본문 굵게(이름) ·
 * small: 작은 글(메타 줄) · caption: 아주 작은 설명(흐림, 웹 card__subtitle) · label: 이름/값 줄의 이름 ·
 * number: 큰 숫자(카드 값·타일 수 — 숫자 폭 고정)
 */
export type TextVariant = 'title' | 'heading' | 'body' | 'strong' | 'small' | 'caption' | 'label' | 'number';
/** 글자 색 — default: 본문색, muted: 흐림, accent: 강조색, 나머지는 Tone 색 */
export type TextTone = 'default' | 'muted' | 'accent' | Tone;

export interface TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  numberOfLines?: number;
  align?: 'left' | 'center' | 'right';
  /** 길게 눌러 고르기(주소·메모 등) */
  selectable?: boolean;
  onPress?: () => void;
  /** 배치용(flex·margin)만 */
  style?: StyleProp<TextStyle>;
  children: ReactNode;
}

/** lucide 아이콘을 테마 색으로 — 화면이 아이콘을 그릴 때(쉐브론·안내 아이콘 등) */
export interface IconProps {
  icon: LucideIcon;
  size?: number;
  tone?: TextTone;
}

/**
 * 판(웹 GlassCard) — 제목·부제·오른쪽 동작 + 내용. 제목·동작이 다 없으면 머리를 그리지 않는다.
 * 웹: 유리 판(.glass .card) / 물: WaterCard.
 */
export interface CardProps extends Outer {
  title?: string;
  /** 제목 아래 한 줄(건수·기간 등) */
  subtitle?: string;
  /** 제목 오른쪽 — 단추·고르기 자리 */
  actions?: ReactNode;
  /** 머리 아래 줄 — 판 폭 전체를 쓰는 고르기(보드 칩·기간 등). 폰은 제목 오른쪽이 좁아 따로 둔다 */
  toolbar?: ReactNode;
  /** false면 내용에 안쪽 여백을 두지 않는다(줄 목록이 판 끝까지 갈 때 — 줄 사이 구분선은 테마가). 기본 true */
  padded?: boolean;
  /** 판 전체를 누를 때 */
  onPress?: () => void;
  children?: ReactNode;
}

/**
 * 숫자 카드(웹 StatCard / 물 WaterStatCard) — 제목·아이콘 칸 / 큰 값 / 알약·설명 한 줄.
 * 보드 숫자 카드는 features/kpis의 useBoardKpis()가 준 KpiCard를 KPI_ICONS로 아이콘만 바꿔 넘긴다.
 */
export interface StatCardProps extends Outer {
  title: string;
  value: string;
  icon?: LucideIcon;
  /** 아이콘 칸 색조 — 장식용 */
  tint?: KpiTint;
  /** 값 아래 한 줄(직전 기간 수·기준 설명) */
  caption?: string;
  /** 값 아래 알약(있으면 설명 앞에) */
  tag?: PillData;
  onPress?: () => void;
}

/** 숫자 카드 하나의 데이터(KpiGrid) */
export interface StatCardData extends Omit<StatCardProps, 'style'> {
  key: string;
}

/**
 * 숫자 카드 묶음(웹 .grid--kpi) — 폰은 두 칸씩. items가 null이면 불러오는 중 — placeholders 장만큼 빈 카드(뼈대).
 */
export interface KpiGridProps extends Outer {
  items: readonly StatCardData[] | null;
  /** 불러오는 중에 그릴 빈 카드 수(기본 4) */
  placeholders?: number;
}

/** 사람 아바타(웹 Avatar) — 이니셜(이름에서), 색은 이름으로 정한다(장식). highlight는 "나"(강조색). */
export interface AvatarProps extends Outer {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  highlight?: boolean;
  /** 프로필 사진 주소 — 있으면 이니셜 대신(앱은 아직 없다) */
  photo?: string | null;
}

/** 아바타 겹침 — 담당자 여럿. max를 넘으면 "+N" */
export interface AvatarStackProps extends Outer {
  names: readonly string[];
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}

/**
 * 단추(웹 Button) — primary: 강조색(주요 행동) · secondary: 판 위 보조(웹 ghost) · plain: 글자만("더 보기" 등) ·
 * danger: 지우기 확인 같은 위험한 행동
 */
export interface ButtonProps extends Outer {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'plain' | 'danger';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  /** 아이콘을 글 뒤에(쉐브론 등) */
  iconAfter?: boolean;
  disabled?: boolean;
  /** 돌아가는 표시 + 누를 수 없음 */
  loading?: boolean;
  /** 폭을 가득 */
  block?: boolean;
}

/** 아이콘 단추(웹 icon-button) — 닫기·지우기·뒤로 등. label은 접근성 이름 */
export interface IconButtonProps extends Outer {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  /** plain: 바탕 없음 · soft: 옅은 판 */
  variant?: 'plain' | 'soft';
  tone?: 'default' | 'danger';
  /** 오른쪽 위 작은 수(업데이트 수 등) — 0이면 안 그린다 */
  badge?: number;
  disabled?: boolean;
}

/**
 * 고르기 줄(웹 SegmentedControl / 물 WaterSegmented) — segmented: 한 판 위 단추들(기간·진행 상태) · chips: 떨어진 알약
 * (보드 거르기). scroll이면 넘칠 때 가로로 민다(보기 탭처럼 많은 것).
 */
export interface SegmentedProps<T extends string> extends Outer {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  variant?: 'segmented' | 'chips';
  scroll?: boolean;
  /** 접근성 이름 */
  label?: string;
}

/** 상태 알약(웹 StatusPill) */
export interface StatusPillProps extends Outer {
  tone: Tone;
  label: string;
  dot?: boolean | 'pulse';
}

/**
 * 칩 — 거르기·고르기 단추(웹 record-select의 "담당자 전체 ▾", 정렬 고르기). selected면 켜진 모양. trailing은
 * 'chevron'(누르면 고르기 시트가 열린다는 표시) 또는 'clear'(누르면 onClear — 고른 것 풀기).
 */
export interface ChipProps extends Outer {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  icon?: LucideIcon;
  /** 글 뒤 작은 수 */
  count?: number;
  trailing?: 'chevron' | 'clear';
  onClear?: () => void;
}

/** 검색 칸(웹 record-search) — 돋보기 + 입력 + 지우기(×). 포커스 효과는 형제 레이어로(키보드 함정) */
export interface SearchFieldProps extends Outer {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
}

/** 글 입력(웹 TextField / 물 WaterTextField) — 이름표 + 입력. 편집 시트의 글·숫자·전화·이메일·긴 글·링크 칸도 이것 */
export interface TextFieldProps extends Outer {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** 긴 글(여러 줄) */
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'phone-pad' | 'email-address' | 'url';
  autoCapitalize?: 'none' | 'sentences';
  autoFocus?: boolean;
  returnKeyType?: 'done' | 'next' | 'search' | 'send' | 'default';
  onSubmitEditing?: () => void;
  editable?: boolean;
  /** 이름표 옆 "필수" 등 */
  required?: boolean;
  /** 아래 빨간 안내(덜 적은 번호 등) */
  error?: string | null;
  /** 아래 흐린 안내 */
  hint?: string | null;
  maxLength?: number;
  /** (1.1) 처음 값과 달라진 칸 — 이름표 옆 "바뀜" */
  changed?: boolean;
  /** (1.1) 입력에 들어올 때·나갈 때 — 화면이 연락처 010 미리 적기에 쓴다 */
  onFocus?: () => void;
  onBlur?: () => void;
}

/** 막대 목록 한 줄(웹 BarListItem) */
export interface BarListItem {
  key: string;
  label: string;
  value: number;
}

/**
 * 항목별 개수(웹 BarList / 물 WaterBarList) — 이름 · 값(단위·몫%) 한 줄 아래 가는 막대. 줄 고르기·"기타" 묶기·몫은
 * part-data의 barListRows(items, limit)를 그대로 쓴다(웹과 같은 숫자).
 */
export interface BarListProps extends Outer {
  items: readonly BarListItem[];
  /** 값 뒤 단위(기본 '건') */
  unit?: string;
  /** 이 개수를 넘으면 나머지를 "기타"로(기본 6) */
  limit?: number;
  /** 없을 때 글(기본 '자료가 없어요') */
  empty?: string;
}

/** 돌아가는 표시(불러오는 중) */
export interface SpinnerProps extends Outer {
  size?: 'small' | 'large';
}

// ── 화면 틀 ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * 화면 바탕 — 위 안전 영역(header가 없을 때), 세로 스크롤, 당겨서 새로고침, 아래 고정 자리. 자식(판들) 사이 간격과
 * 좌우 여백은 테마가 정한다(화면은 판을 차례로 넣기만 한다). 스크롤은 키보드를 피하게(automaticallyAdjustKeyboardInsets,
 * keyboardShouldPersistTaps="handled").
 */
export interface ScreenProps {
  children: ReactNode;
  /** 위에 고정 — 보통 ScreenHeader(안전 영역을 그것이 맡는다) */
  header?: ReactNode;
  /** 아래에 고정 — 고르기 막대(SelectionBar) 등. 내용 위에 떠 있다 */
  footer?: ReactNode;
  /** false면 스크롤하지 않는다(안이 직접 스크롤할 때). 기본 true */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** 아래 탭 안의 화면 — 테마의 탭바 높이만큼 아래를 띄운다(떠 있는 탭바에 가리지 않게) */
  inTabs?: boolean;
}

/**
 * 화면 머리(웹 topbar — 제목·저장 상태) — 위 안전 영역 포함. onBack이 있으면 뒤로 단추(밀어 넣은 화면), 없으면 큰 제목
 * (탭 화면). 저장 상태(core tech-outbox useSyncStatus: 저장 중 N건 / 저장됨)는 sync가 false가 아니면 오른쪽에 그린다.
 */
export interface ScreenHeaderProps {
  title: string;
  /** 제목 위 작은 글(보드 이름 등) */
  eyebrow?: string;
  /** 제목 아래 한 줄 */
  subtitle?: string;
  onBack?: () => void;
  /** 오른쪽 동작(저장 상태 앞) */
  right?: ReactNode;
  /** 저장 상태 표시 — 기본 true */
  sync?: boolean;
}

/** 구역(웹 king-section·attention 제목) — 판 밖의 제목 + 오른쪽 작은 글/동작 + 내용 */
export interface SectionProps extends Outer {
  title?: string;
  /** 제목 옆 흐린 글(기간 등) */
  aside?: string;
  right?: ReactNode;
  children: ReactNode;
}

/**
 * 빈 화면·불러오는 중·오류(웹 board-page의 .empty 판) — 아이콘(또는 돌아가는 표시)·제목·설명·단추.
 * tone 'error'면 오류 색 아이콘.
 */
export interface EmptyStateProps extends Outer {
  title: string;
  text?: string;
  icon?: LucideIcon;
  loading?: boolean;
  tone?: 'default' | 'error';
  action?: { label: string; onPress: () => void };
}

/** 안내 줄 — 판 안의 짧은 알림(다시 읽지 못함 + 다시 불러오기, 불러오는 중 …) */
export interface NoticeProps extends Outer {
  text: string;
  tone?: 'info' | 'warn' | 'error';
  loading?: boolean;
  action?: { label: string; onPress: () => void };
}

/** 뼈대 블록(불러오는 중) — 깜빡이는 빈 판 */
export interface SkeletonProps extends Outer {
  width?: number | `${number}%`;
  height: number;
  radius?: 'sm' | 'md' | 'lg' | 'pill';
}

/**
 * 아래에서 올라오는 판(웹 팝오버·편집 패널·이동 메뉴를 폰에서는 시트로) — Modal(transparent) + 막 + KeyboardAvoidingView.
 * 내용은 스크롤(scroll=false면 안 함), footer는 아래 고정(취소·저장 단추). tall이면 화면 높이 88%까지.
 */
export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
  scroll?: boolean;
}

/**
 * 고르기 줄 — 시트 안 목록(사람·정렬·그룹 이동·레이아웃 고르기)과 설정 목록. selected면 체크·강조.
 * description은 아래 흐린 한 줄, right는 오른쪽 작은 것(건수 등).
 */
export interface OptionRowProps extends Outer {
  label: string;
  onPress: () => void;
  description?: string;
  selected?: boolean;
  icon?: LucideIcon;
  /** 왼쪽에 아이콘 대신 그릴 것(아바타·색 점) */
  left?: ReactNode;
  right?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

/** 확인 창(웹 ConfirmDialog) — 지우기 등. danger면 확인 단추가 위험 색 */
export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  /** 기본 '취소' */
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ── 보드 (웹 layout-parts — board/*) ──────────────────────────────────────────────────────────────────────

/**
 * 기록 목록 한 줄의 데이터 — 웹 RecordTable의 칸들을 폰 한 줄(카드)에 맞춘 것. 보드마다 무엇을 넣는지는
 * features/dashboard의 줄 정의가 정한다. 없는 것은 그리지 않는다.
 */
export interface RecordRowData {
  /** 항목 id(itemId) */
  id: string;
  /** 이름(비었으면 '(이름 없음)'을 넣어 준다) */
  title: string;
  /** 이름 아래 한 줄 — 연락처·기기 등(웹 cell-person의 작은 글) */
  subtitle?: string | null;
  /**
   * 전화 단추 — number는 칸의 번호 그대로(보일 때 part-data phoneText로 다듬고, 누르면 callPhone). beside면 이름 오른쪽(이름이
   * 길면 이름이 먼저 줄어든다), 아니면 이름 아래 한 줄(subtitle 다음). 고르는 중에는 누르지 않는다(1.3).
   * action이 'copy'면 누를 때 전화 대신 번호를 복사한다(출장업무, part-data pressPhone)(1.4)
   */
  phone?: { number: string; beside?: boolean; action?: PhoneAction } | null;
  /** 오른쪽 아래 작은 글('접수 11/9')(1.3) */
  corner?: string | null;
  /** 하위 아이템 단추 "설치 품목 3개 ›" — 누르면 onPressSubitems(1.3) */
  subitems?: { label: string; count: number } | null;
  /** 단계 알약(웹 StagePill) */
  stage?: StageValue | null;
  /** 단계 대신 다른 알약(대여품 상태·재고 상태 등) */
  pill?: PillData | null;
  /** 작은 정보 조각들(출장 종류·지역 …) — 부품이 ' · '로 잇거나 작은 칩으로 */
  meta?: readonly string[];
  /** 담당자 — 첫 사람 + 나머지 수(웹 Assignees) */
  assignees?: readonly string[];
  /** 오른쪽 위 날짜 — text '11/9'·hint '내일'·tone(지난 날 crit, 흐림 muted) */
  date?: { text: string; hint?: string | null; tone?: 'default' | 'muted' | 'crit' } | null;
  /** 오른쪽 값(재고 3개 등) — alert면 위험 색(웹 mini-list__value is-alert) */
  value?: { text: string; alert?: boolean } | null;
  /** 업데이트 말풍선 수 — 업데이트 보드만(null·undefined면 안 그림, 0이면 "쓰기" 모양) */
  updates?: number | null;
  /** Monday에 저장하는 중(웹 record-row__saving "저장 중") */
  saving?: boolean;
  /** 완료된 기록 — 조금 흐리게 해도 된다 */
  done?: boolean;
}

/** 기록 줄 하나(웹 record-table 한 줄 / 물 표 한 줄) — 누르면 상세, 길게 누르면 고르기 시작 */
export interface RecordRowProps extends Outer {
  row: RecordRowData;
  onPress: () => void;
  onLongPress?: () => void;
  /** 말풍선을 누르면 — 화면이 업데이트 시트를 연다 */
  onPressUpdates?: () => void;
  /** 하위 아이템 단추를 누르면 — 화면이 하위 아이템 시트를 연다(1.3) */
  onPressSubitems?: () => void;
  /** 고르는 중 — 왼쪽에 체크 칸 */
  selecting?: boolean;
  selected?: boolean;
}

/**
 * 기록 목록(웹 RecordTable / 물 WaterRecordTable) — 판 머리(제목·건수·동작) + 도구 줄(화면이 Segmented·SearchField·
 * Chip으로 짠다) + 줄들(RecordRow) + 빈 글 + "더 보기". 거르기·정렬·더 보기 계산은 features/dashboard의 useRecordRows가
 * 하고 여기는 그린다. 고르는 중이면 줄을 눌러도 상세를 열지 않는다 — 화면이 onPressRow에서 가른다(부품은 그대로 알림).
 */
export interface RecordListProps extends Outer {
  title: string;
  /** 건수 등 */
  subtitle?: string;
  /** 제목 오른쪽 — "새로 만들기" */
  actions?: ReactNode;
  /** 머리 아래 도구 줄 — 진행 상태·검색·담당자·정렬 */
  toolbar?: ReactNode;
  rows: readonly RecordRowData[];
  /** 줄이 없을 때 */
  emptyText: string;
  /** 처음 불러오는 중 — 줄 대신 뼈대 */
  loading?: boolean;
  onPressRow: (id: string) => void;
  /** 길게 눌러 고르기 — 편집할 수 있는 보드만 */
  onLongPressRow?: (id: string) => void;
  onPressUpdates?: (id: string) => void;
  /** 하위 아이템 단추(1.3) */
  onPressSubitems?: (id: string) => void;
  selecting?: boolean;
  selected?: ReadonlySet<string>;
  /** "더 보기 · N건 남음" — 남은 것이 없으면 null */
  more?: { remaining: number; onPress: () => void } | null;
}

/** 고르기 막대 동작 하나 */
export interface SelectionAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  onPress: () => void;
}

/**
 * 고르기 막대(웹 RecordSelectionBar / 물 WaterSelectionBar) — 줄을 고르면 아래에 뜬다: "N개 선택" + 동작(이동·삭제) +
 * 고르기 풀기. Screen의 footer 자리에 넣는다. count가 0이면 화면이 그리지 않는다.
 */
export interface SelectionBarProps extends Outer {
  count: number;
  actions: readonly SelectionAction[];
  onClear: () => void;
}

/** 단계 알약(웹 StagePill) — 색·글은 core tech-stage stageTone·stageLabel */
export interface StagePillProps extends Outer, StageValue {}

/** 담당자(웹 Assignees) — 첫 사람 이름 + "+N". 없으면 '—' */
export interface AssigneesProps extends Outer {
  names: readonly string[];
}

/** 전화 걸기(웹 PhoneLink) — 010-1234-5678 모양(part-data phoneText), 누르면 전화(part-data callPhone). 없으면 안 그림 */
export interface PhoneLinkProps extends Outer {
  phone: string | null;
  /** 'copy'면 누를 때 전화 대신 번호 복사(출장업무, part-data pressPhone) — 없으면 전화(1.4) */
  action?: PhoneAction;
}

/** 다가오는 일정 한 줄(웹 UpcomingItem) */
export interface UpcomingItem {
  key: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  meta?: string;
  onPress?: () => void;
}

/**
 * 날짜순 일정(웹 UpcomingList) — 왼쪽 날짜 칸(월/일·요일) + 이름·한 줄 + 오른쪽 "내일"/"3일째". 날짜 칸 글·지남·오늘은
 * part-data의 upcomingRow(item, today, mode)로.
 */
export interface UpcomingListProps extends Outer {
  items: readonly UpcomingItem[];
  today: string;
  empty: string;
  /** due: 다가오는 날(지난 날은 위험 색) · since: 시작한 날부터 며칠째 */
  mode?: 'due' | 'since';
}

/** 짧은 목록 한 줄(웹 MiniListItem) */
export interface MiniListItem {
  key: string;
  title: string;
  meta?: string;
  /** 오른쪽 값(재고 수 등) */
  value?: string;
  alert?: boolean;
  onPress?: () => void;
}

/** 짧은 목록(웹 MiniList) — 재고 부족·중복 SN처럼 바로 챙길 것 */
export interface MiniListProps extends Outer {
  items: readonly MiniListItem[];
  empty: string;
}

/** 상세 위 동작 하나(수정·삭제) */
export interface DetailAction {
  key: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  onPress: () => void;
}

/**
 * 상세 화면 틀(웹 RecordDrawer + DrawerShell — 가운데 뜨는 유리 판을 폰에서는 한 화면으로) — 위 안전 영역, 머리
 * (뒤로 · 이름 위 보드 이름(누르면 그 보드로) · 이름 · 단계 알약 · 동작 단추), 탭(정보·업데이트 N), 본문 스크롤.
 * 본문 스크롤은 키보드를 피한다.
 */
export interface DetailShellProps {
  title: string;
  eyebrow?: string;
  /** 보드 이름을 누르면 — 내 업무에서 연 상세는 그 보드로 간다(웹 BoardLink "보드에서 보기") */
  onPressEyebrow?: () => void;
  stage?: StageValue | null;
  pill?: PillData | null;
  onBack: () => void;
  /** 오른쪽 위 동작 — 수정·삭제(웹 서랍 머리 단추) */
  actions?: readonly DetailAction[];
  /** 본문 위 탭 — 지금 화면은 쓰지 않는다(업데이트는 머리 단추 → 시트, 2차) */
  tabs?: { options: readonly SegmentOption<string>[]; value: string; onChange: (value: string) => void } | null;
  /** 본문(스크롤 안) — 상세 부품들이 차례로 온다. 그 사이 간격·좌우 여백은 테마가(Screen처럼) */
  children: ReactNode;
  /** 아래 고정 */
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** 상세 이름/값 한 줄 */
export interface DetailFieldData {
  key: string;
  label: string;
  /** 보일 값 — null·''이면 '—' */
  value?: string | null;
  /** 값 대신 그릴 것(단계 알약·담당자·전화 링크 …) */
  content?: ReactNode;
  /** 누르면 이 칸 고치기(고칠 수 있는 칸만) — 연필 표시 */
  onPress?: () => void;
}

/** 상세 이름/값 목록(웹 drawer__fields dl) */
export interface DetailFieldsProps extends Outer {
  title?: string;
  fields: readonly DetailFieldData[];
}

/** 상세 긴 글 구역(웹 drawer__section — 증상·문의 내용·비고). 화면이 빈 글은 빼고 넘긴다 */
export interface DetailTextProps extends Outer {
  label: string;
  text: string;
  onPress?: () => void;
}

/** 상세 작은 목록 한 줄 */
export interface DetailListItem {
  key: string;
  label: string;
  /** 오른쪽 흐린 글(수량 등) */
  meta?: string;
}

/** 상세 작은 목록(웹 DrawerList — 설치 품목·청구 부품) */
export interface DetailListProps extends Outer {
  title: string;
  items: readonly DetailListItem[];
}

// ── 편집기 (웹 item-editor·editors/ / 물 chip-picker·multi-select·date-time-input) ─────────────────────────
// 편집 시트(Sheet tall + footer 취소·저장)는 화면이 짜고, 칸마다 아래 편집기(글 칸은 TextField)를 넣는다.
// 값·저장은 features/dashboard의 편집 훅이 가진다 — 편집기는 받은 값을 보이고 바뀐 값을 onChange로 알린다.

/** 고르기 칸의 고를 것 하나 */
export interface ChoiceOption {
  value: string;
  label: string;
  /** 상태 라벨 색(Monday 라벨 색 — 있으면 점이나 바탕으로) */
  color?: string | null;
  /** 아래 흐린 글(사람 이메일·연결 항목 보드 등) */
  sub?: string | null;
}

/**
 * 고르기 칸 — 상태(하나)·드롭다운(여럿)·사람(여럿)·연결 보드(여럿). 칸에는 고른 것(알약·칩)을 보이고, 누르면 시트에서
 * 고른다(시트 열림·검색어는 부품 안 상태). multiple이 아니면 고르는 즉시 시트를 닫는다. clearable이면 "비우기".
 */
export interface ChoiceFieldProps extends Outer {
  label: string;
  options: readonly ChoiceOption[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  /** 고른 것이 없을 때 글(기본 '고르기') */
  placeholder?: string;
  /** 목록이 길 때 시트 위 검색 칸 */
  searchable?: boolean;
  clearable?: boolean;
  required?: boolean;
  disabled?: boolean;
  hint?: string | null;
  /** (1.1) 처음 값과 달라진 칸 — 이름표 옆 "바뀜" */
  changed?: boolean;
}

/** 날짜·시각 값 — date 'YYYY-MM-DD'(없으면 ''), time 'HH:MM'(없으면 '') */
export interface DateTimeValue {
  date: string;
  time: string;
}

/**
 * 날짜 칸(웹 date-time-input) — 칸에는 '11/9 (월) 14:00', 누르면 시트에 달력(part-data monthGrid)과 시각 고르기
 * (part-data TIME_SLOTS 또는 직접 입력). withTime이 false면 날짜만. clearable이면 "지우기".
 */
export interface DateFieldProps extends Outer {
  label: string;
  value: DateTimeValue;
  onChange: (next: DateTimeValue) => void;
  /** 오늘(한국 날짜) — 달력의 오늘 표시·"오늘" 단추 */
  today: string;
  withTime?: boolean;
  clearable?: boolean;
  required?: boolean;
  disabled?: boolean;
  hint?: string | null;
  /** (1.1) 처음 값과 달라진 칸 — 이름표 옆 "바뀜" */
  changed?: boolean;
}

/** 체크 칸(웹 checkbox) — 스위치나 체크 모양 */
export interface CheckFieldProps extends Outer {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** (1.1) 처음 값과 달라진 칸 — 이름표 옆 "바뀜" */
  changed?: boolean;
}

// ── 업데이트·파일·하위 아이템 (웹 item-updates·item-files·subitems) ───────────────────────────────────────

/** 업데이트(댓글) 하나 — part-data updateView로 core TechUpdate에서 만든다 */
export interface UpdateView {
  id: string;
  author: string;
  /** '3분 전' 등 — 올리는 중이면 '' */
  when: string;
  text: string;
  /** 올리는 중(아직 Monday에 없음) — 흐리게 + "올리는 중" */
  pending: boolean;
  replies: readonly UpdateView[];
}

/** 업데이트 쓰기 칸(웹 item-updates 위 입력) — 값은 화면이 들고, "업데이트" 단추로 onSend */
export interface UpdateComposerProps extends Outer {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  /** 보낼 수 있는지(빈 글이 아닌지) */
  canSend: boolean;
  /** 올라갈 이름 — "{me} 이름으로 올라가요" */
  me: string;
  placeholder?: string;
}

/**
 * 업데이트 카드(웹 item-updates 한 개 / 물 water-item-updates) — 쓴 사람·때·글, 답글들, "답변" 단추를 누르면 답글 칸
 * (답글 입력은 부품 안 상태). onReply가 true를 돌려주면 칸을 비우고 닫는다.
 */
export interface UpdateCardProps extends Outer {
  update: UpdateView;
  me: string;
  onReply: (text: string) => boolean;
}

/** 파일 하나 — features/dashboard의 useItemFiles가 항목의 파일 칸에서 만든다(part-data fileView) */
export interface FileView {
  key: string;
  name: string;
  kind: 'image' | 'pdf' | 'file';
  /** 열 주소(없으면 열 수 없음 — 흐리게) */
  url: string | null;
  /** 사진 미리보기 주소 */
  thumbUrl?: string | null;
  /** 작은 글(칸 이름·크기) */
  meta?: string;
}

/** 파일 목록(웹 ItemFiles — 사진은 썸네일) — 누르면 onPressFile(화면이 연다) */
export interface FileListProps extends Outer {
  title: string;
  files: readonly FileView[];
  empty?: string;
  onPressFile: (file: FileView) => void;
}

/** 하위 아이템 한 줄 */
export interface SubitemView {
  key: string;
  name: string;
  meta?: string;
  pill?: PillData | null;
}

/** 하위 아이템 목록(웹 subitems-editor를 읽기 전용으로) */
export interface SubitemListProps extends Outer {
  title: string;
  items: readonly SubitemView[];
  empty?: string;
}

// ── 개요·내 업무·팀원·보드 허브 (웹 overview/*, my-work, team) ────────────────────────────────────────────

/** 챙겨야 할 것(웹 AttentionRow) — 한 줄 요약 타일들. 누르면 그 보드로. 0건이면 흐리게, 아니면 tile.tone 색 */
export interface AttentionRowProps extends Outer {
  tiles: readonly AttentionTile[];
  loading: boolean;
  onPressTile: (tile: AttentionTile) => void;
}

/**
 * 기술팀 왕 카드(웹 KingCard) — 기간 안 담당자 순위(막대), 줄을 누르면 센 기록이 펼쳐진다(펼침은 부품 안 상태).
 * 순위·막대 몫·꼬리 글은 part-data kingCardView(props)로.
 */
export interface KingCardProps extends Outer {
  def: KingDef;
  /** '이번 주'·'이번 달' */
  spanLabel: string;
  /** '지난주'·'지난달' */
  previousLabel: string;
  period: KingPeriod;
  /** null이면 불러오는 중 */
  result: KingResult | null;
  previousTop: KingRow | null;
}

/** 팀 현황(웹 TeamCard) — 사람마다 진행 중(보드별)·오늘 방문·이번 주 처리. 나는 강조. 보드 글·막대는 part-data teamMemberViews */
export interface TeamCardProps extends Outer {
  members: readonly TeamMemberStatus[];
  me: ReadonlySet<string>;
  loading: boolean;
  /** 사람을 누르면 그 사람의 업무 */
  onPressMember?: (name: string) => void;
}

/** 내 업무 한 줄 — part-data workRowView로 core MyWorkItem에서 만든다 */
export interface WorkRowView {
  key: string;
  boardKey: TechBoardKey;
  itemId: string;
  /** 보드 이름(출장업무 …) */
  boardLabel: string;
  title: string;
  /** '방문 11/9 14:00 · 접수 11/2' */
  detail: string;
  stage: StageValue;
  /** 오른쪽 글 — alert: 지남(위험 색) · soon: 오늘·곧(주의 색) · plain: 흐림 (core urgencyText) */
  urgency: { text: string; tone: 'alert' | 'soon' | 'plain' };
  done: boolean;
}

/** 내 업무 줄(웹 MyWorkRow) — 보드 이름 · 이름·한 줄 · 단계 · 남은 날 · 쉐브론 */
export interface WorkRowProps extends Outer {
  row: WorkRowView;
  onPress: () => void;
}

/** 일정 하나 — part-data scheduleView로 core buildSchedule에서 만든다 */
export interface ScheduleEventView {
  key: string;
  boardKey: TechBoardKey;
  itemId: string;
  /** '14:00'·'종일'(지난 일정은 날짜) */
  time: string;
  /** '방문'·'마감'·'반납' … — 보드마다 색이 다르다(웹 schedule__kind is-{boardKey}) */
  kind: string;
  title: string;
  meta?: string | null;
}

/** 하루 — 날짜 머리('오늘' 11/9 (월) · N건) + 일정들, 없으면 '일정 없음' */
export interface ScheduleDayView {
  key: string;
  /** '오늘'·'내일'·null */
  rel: string | null;
  /** '11/9 (월)' — 지난 일정 묶음은 그 제목 */
  label: string;
  isToday: boolean;
  events: readonly ScheduleEventView[];
}

/** 일정 하루(웹 schedule-card의 하루 줄) */
export interface ScheduleDayProps extends Outer {
  day: ScheduleDayView;
  onPressEvent: (event: ScheduleEventView) => void;
}

/** 보드 허브의 보드 하나(앱만 — 웹은 사이드바 메뉴) — 아이콘·메뉴 이름·Monday 보드 이름·진행 중 수 */
export interface BoardTileProps extends Outer {
  label: string;
  /** Monday 보드 이름(메뉴 이름과 다를 때) */
  title?: string | null;
  icon: LucideIcon;
  /** 오른쪽 큰 수(진행 중 N) — 불러오는 중이면 null */
  count?: string | null;
  /** 아래 흐린 글 */
  caption?: string | null;
  onPress: () => void;
}

/** 사람 줄(웹 team-table 한 줄·사람 고르기) — 아바타·이름·한 줄·알약들·오른쪽 */
export interface PersonRowProps extends Outer {
  name: string;
  sub?: string | null;
  highlight?: boolean;
  pills?: readonly PillData[];
  right?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
}

// ── 계약 ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * 대시보드 짜임의 부품 — 글라스(glassParts)·물(waterParts)이 구현한다. 화면은 useParts()로 받아 그린다.
 * 함수 부품이면 된다(memo·forwardRef 아니어도 된다).
 */
export interface DashboardParts {
  // 기본
  Text: ComponentType<TextProps>;
  Icon: ComponentType<IconProps>;
  Card: ComponentType<CardProps>;
  StatCard: ComponentType<StatCardProps>;
  KpiGrid: ComponentType<KpiGridProps>;
  Avatar: ComponentType<AvatarProps>;
  AvatarStack: ComponentType<AvatarStackProps>;
  Button: ComponentType<ButtonProps>;
  IconButton: ComponentType<IconButtonProps>;
  Segmented: <T extends string>(props: SegmentedProps<T>) => ReactElement | null;
  StatusPill: ComponentType<StatusPillProps>;
  Chip: ComponentType<ChipProps>;
  SearchField: ComponentType<SearchFieldProps>;
  TextField: ComponentType<TextFieldProps>;
  BarList: ComponentType<BarListProps>;
  Spinner: ComponentType<SpinnerProps>;

  // 화면 틀
  Screen: ComponentType<ScreenProps>;
  ScreenHeader: ComponentType<ScreenHeaderProps>;
  Section: ComponentType<SectionProps>;
  EmptyState: ComponentType<EmptyStateProps>;
  Notice: ComponentType<NoticeProps>;
  Skeleton: ComponentType<SkeletonProps>;
  Sheet: ComponentType<SheetProps>;
  OptionRow: ComponentType<OptionRowProps>;
  ConfirmDialog: ComponentType<ConfirmDialogProps>;

  // 보드
  RecordList: ComponentType<RecordListProps>;
  RecordRow: ComponentType<RecordRowProps>;
  SelectionBar: ComponentType<SelectionBarProps>;
  StagePill: ComponentType<StagePillProps>;
  Assignees: ComponentType<AssigneesProps>;
  PhoneLink: ComponentType<PhoneLinkProps>;
  UpcomingList: ComponentType<UpcomingListProps>;
  MiniList: ComponentType<MiniListProps>;
  DetailShell: ComponentType<DetailShellProps>;
  DetailFields: ComponentType<DetailFieldsProps>;
  DetailText: ComponentType<DetailTextProps>;
  DetailList: ComponentType<DetailListProps>;

  // 편집기
  ChoiceField: ComponentType<ChoiceFieldProps>;
  DateField: ComponentType<DateFieldProps>;
  CheckField: ComponentType<CheckFieldProps>;

  // 업데이트·파일·하위 아이템
  UpdateComposer: ComponentType<UpdateComposerProps>;
  UpdateCard: ComponentType<UpdateCardProps>;
  FileList: ComponentType<FileListProps>;
  SubitemList: ComponentType<SubitemListProps>;

  // 개요·내 업무·팀원·보드 허브
  AttentionRow: ComponentType<AttentionRowProps>;
  KingCard: ComponentType<KingCardProps>;
  TeamCard: ComponentType<TeamCardProps>;
  WorkRow: ComponentType<WorkRowProps>;
  ScheduleDay: ComponentType<ScheduleDayProps>;
  BoardTile: ComponentType<BoardTileProps>;
  PersonRow: ComponentType<PersonRowProps>;

  // 설정
  /** 테마마다 다른 외관 설정 카드들(웹 AppearanceSettings — 글라스: 배경·강조색·유리 / 물: 벽·강조색·판). 값은 테마 Provider가 든다 */
  AppearanceSettings: ComponentType;
}

const PartsContext = createContext<DashboardParts | null>(null);

/** 테마 틀(Frame)이 대시보드 화면 바깥에 둔다 — value는 glassParts·waterParts */
export function PartsProvider({ value, children }: { value: DashboardParts; children: ReactNode }) {
  return createElement(PartsContext.Provider, { value }, children);
}

/** 지금 테마의 부품 — PartsProvider 밖에서 부르면 잘못 짠 것이라 바로 알린다 */
export function useParts(): DashboardParts {
  const parts = useContext(PartsContext);
  if (!parts) throw new Error('useParts는 PartsProvider 안에서만 쓸 수 있어요 — 테마 Frame에 PartsProvider를 두세요');
  return parts;
}
