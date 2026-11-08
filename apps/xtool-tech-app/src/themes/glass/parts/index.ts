import type { DashboardParts } from '../../dashboard/parts';
import { AppearanceSettings } from './appearance';
import {
  Assignees,
  Avatar,
  AvatarStack,
  Button,
  Chip,
  IconButton,
  PhoneLink,
  SearchField,
  Segmented,
  StagePill,
  StatusPill,
  TextField,
} from './controls';
import { DetailFields, DetailList, DetailShell, DetailText } from './detail';
import { CheckField, ChoiceField, DateField } from './editors';
import { ConfirmDialog, OptionRow, SelectionBar, Sheet } from './overlays';
import { AttentionRow, BoardTile, KingCard, PersonRow, ScheduleDay, TeamCard, WorkRow } from './overview';
import { MiniList, RecordList, RecordRow, UpcomingList } from './records';
import { Screen, ScreenHeader } from './screen';
import { BarList, Card, EmptyState, KpiGrid, Notice, Section, Skeleton, StatCard } from './surfaces';
import { Icon, Spinner, Text } from './text';
import { FileList, SubitemList, UpdateCard, UpdateComposer } from './updates';

// 글라스 부품 — 대시보드 짜임 계약(themes/dashboard/parts.ts DashboardParts)을 웹 기본 유리 디자인으로 구현한 것.
// Frame이 PartsProvider로 준다.

export const glassParts: DashboardParts = {
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
  AppearanceSettings,
};
