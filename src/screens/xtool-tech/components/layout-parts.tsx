import type { ComponentProps } from 'react'
import { BarList as BaseBarList } from '@/ohq-ui/charts/bar-list'
import { Avatar as BaseAvatar } from '@/ohq-ui/components/avatar'
import { Button as BaseButton } from '@/ohq-ui/components/button'
import { GlassCard as BaseGlassCard } from '@/ohq-ui/components/glass-card'
import { SegmentedControl as BaseSegmentedControl } from '@/ohq-ui/components/segmented-control'
import { StatCard as BaseStatCard } from '@/ohq-ui/components/stat-card'
import { StatusPill as BaseStatusPill } from '@/ohq-ui/components/status-pill'
import { useWaterLayout } from '../water-layout/load'
import { Assignees as BaseAssignees, PhoneLink as BasePhoneLink, StagePill as BaseStagePill } from './board/cells'
import { DrawerShell as BaseDrawerShell } from './board/drawer-shell'
import { MiniList as BaseMiniList } from './board/mini-list'
import { DrawerList as BaseDrawerList, RecordDrawer as BaseRecordDrawer } from './board/record-drawer'
import { RecordTable as BaseRecordTable } from './board/record-table'
import { UpcomingList as BaseUpcomingList } from './board/upcoming-list'
import { AttentionRow as BaseAttentionRow } from './overview/attention-row'
import { KingCard as BaseKingCard } from './overview/king-card'
import { TeamCard as BaseTeamCard } from './overview/team-card'

// 화면 모양(설정 > 레이아웃)에 따라 바꿔 끼우는 부품 — 보드·개요·내 업무·팀 화면은 카드·표·서랍·알약을 여기서
// 받는다. "물"이면 같은 props의 물 부품(ohq-ui/water·components/water)을, 아니면 지금 부품을 그대로 그린다.
// 물 부품은 물을 고른 사람만 받는다(water-layout/load — 물 셸이 받기를 마친 뒤에 화면을 그린다).

interface RecordLike {
  itemId: string
  stage: string | null
  status: string | null
}

export function GlassCard(props: ComponentProps<typeof BaseGlassCard>) {
  const water = useWaterLayout()
  return water ? <water.WaterCard {...props} /> : <BaseGlassCard {...props} />
}

export function StatCard(props: ComponentProps<typeof BaseStatCard>) {
  const water = useWaterLayout()
  return water ? <water.WaterStatCard {...props} /> : <BaseStatCard {...props} />
}

export function BarList(props: ComponentProps<typeof BaseBarList>) {
  const water = useWaterLayout()
  return water ? <water.WaterBarList {...props} /> : <BaseBarList {...props} />
}

export function StatusPill(props: ComponentProps<typeof BaseStatusPill>) {
  const water = useWaterLayout()
  return water ? <water.WaterStatusPill {...props} /> : <BaseStatusPill {...props} />
}

export function SegmentedControl<T extends string>(props: ComponentProps<typeof BaseSegmentedControl<T>>) {
  const water = useWaterLayout()
  return water ? <water.WaterSegmented {...props} /> : <BaseSegmentedControl {...props} />
}

export function Button(props: ComponentProps<typeof BaseButton>) {
  const water = useWaterLayout()
  return water ? <water.WaterButton {...props} /> : <BaseButton {...props} />
}

export function Avatar(props: ComponentProps<typeof BaseAvatar>) {
  const water = useWaterLayout()
  return water ? <water.WaterAvatar {...props} /> : <BaseAvatar {...props} />
}

export function RecordTable<T extends RecordLike>(props: ComponentProps<typeof BaseRecordTable<T>>) {
  const water = useWaterLayout()
  return water ? <water.WaterRecordTable {...props} /> : <BaseRecordTable {...props} />
}

export function RecordDrawer(props: ComponentProps<typeof BaseRecordDrawer>) {
  const water = useWaterLayout()
  return water ? <water.WaterRecordDrawer {...props} /> : <BaseRecordDrawer {...props} />
}

export function DrawerList(props: ComponentProps<typeof BaseDrawerList>) {
  const water = useWaterLayout()
  return water ? <water.WaterDrawerList {...props} /> : <BaseDrawerList {...props} />
}

export function UpcomingList(props: ComponentProps<typeof BaseUpcomingList>) {
  const water = useWaterLayout()
  return water ? <water.WaterUpcomingList {...props} /> : <BaseUpcomingList {...props} />
}

export function MiniList(props: ComponentProps<typeof BaseMiniList>) {
  const water = useWaterLayout()
  return water ? <water.WaterMiniList {...props} /> : <BaseMiniList {...props} />
}

export function Assignees(props: ComponentProps<typeof BaseAssignees>) {
  const water = useWaterLayout()
  return water ? <water.WaterAssignees {...props} /> : <BaseAssignees {...props} />
}

export function PhoneLink(props: ComponentProps<typeof BasePhoneLink>) {
  const water = useWaterLayout()
  return water ? <water.WaterPhoneLink {...props} /> : <BasePhoneLink {...props} />
}

export function StagePill(props: ComponentProps<typeof BaseStagePill>) {
  const water = useWaterLayout()
  return water ? <water.WaterStagePill {...props} /> : <BaseStagePill {...props} />
}

export function AttentionRow(props: ComponentProps<typeof BaseAttentionRow>) {
  const water = useWaterLayout()
  return water ? <water.WaterAttentionRow {...props} /> : <BaseAttentionRow {...props} />
}

export function KingCard(props: ComponentProps<typeof BaseKingCard>) {
  const water = useWaterLayout()
  return water ? <water.WaterKingCard {...props} /> : <BaseKingCard {...props} />
}

export function TeamCard(props: ComponentProps<typeof BaseTeamCard>) {
  const water = useWaterLayout()
  return water ? <water.WaterTeamCard {...props} /> : <BaseTeamCard {...props} />
}

export function DrawerShell(props: ComponentProps<typeof BaseDrawerShell>) {
  const water = useWaterLayout()
  return water ? <water.WaterDrawerShell {...props} /> : <BaseDrawerShell {...props} />
}
