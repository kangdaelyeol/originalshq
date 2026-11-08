import type { DashboardParts } from '../../dashboard/parts';
import { WaterAppearanceSettings } from '../settings';
import {
  AvatarStack,
  Avatar,
  BarList,
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  KpiGrid,
  Segmented,
  StatCard,
  StatusPill,
  Text,
} from './basic';
import {
  Assignees,
  DetailFields,
  DetailList,
  DetailShell,
  DetailText,
  FileList,
  MiniList,
  PhoneLink,
  RecordList,
  RecordRow,
  SelectionBar,
  StagePill,
  SubitemList,
  UpcomingList,
} from './board';
import { CheckField, ChoiceField, DateField, SearchField, TextField } from './fields';
import { AttentionRow, BoardTile, KingCard, PersonRow, ScheduleDay, TeamCard, WorkRow } from './overview';
import {
  ConfirmDialog,
  EmptyState,
  Notice,
  OptionRow,
  Screen,
  ScreenHeader,
  Section,
  Sheet,
  Skeleton,
  Spinner,
} from './screen';
import { UpdateCard, UpdateComposer } from './updates';

// 물 부품 — 대시보드 짜임 계약(themes/dashboard/parts.ts DashboardParts)의 물 구현. 화면은 한 벌이고, 물 틀(Frame)이
// PartsProvider로 이것을 준다(웹 layout-parts가 "물"이면 물 부품을 그리는 것과 같다).

export const waterParts: DashboardParts = {
  // 기본
  Text,
  Icon,
  Card,
  StatCard,
  KpiGrid,
  Avatar,
  AvatarStack,
  Button,
  IconButton,
  Segmented,
  StatusPill,
  Chip,
  SearchField,
  TextField,
  BarList,
  Spinner,

  // 화면 틀
  Screen,
  ScreenHeader,
  Section,
  EmptyState,
  Notice,
  Skeleton,
  Sheet,
  OptionRow,
  ConfirmDialog,

  // 보드
  RecordList,
  RecordRow,
  SelectionBar,
  StagePill,
  Assignees,
  PhoneLink,
  UpcomingList,
  MiniList,
  DetailShell,
  DetailFields,
  DetailText,
  DetailList,

  // 편집기
  ChoiceField,
  DateField,
  CheckField,

  // 업데이트·파일·하위 아이템
  UpdateComposer,
  UpdateCard,
  FileList,
  SubitemList,

  // 개요·내 업무·팀원·보드 허브
  AttentionRow,
  KingCard,
  TeamCard,
  WorkRow,
  ScheduleDay,
  BoardTile,
  PersonRow,

  // 설정
  AppearanceSettings: WaterAppearanceSettings,
};
