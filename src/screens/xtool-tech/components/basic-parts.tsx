import type { ComponentProps } from 'react'
import { BarList as BaseBarList } from '@/ohq-ui/charts/bar-list'
import { Avatar as BaseAvatar } from '@/ohq-ui/components/avatar'
import { Button as BaseButton } from '@/ohq-ui/components/button'
import { GlassCard as BaseGlassCard } from '@/ohq-ui/components/glass-card'
import { SegmentedControl as BaseSegmentedControl } from '@/ohq-ui/components/segmented-control'
import { StatCard as BaseStatCard } from '@/ohq-ui/components/stat-card'
import { StatusPill as BaseStatusPill } from '@/ohq-ui/components/status-pill'
import { TextField as BaseTextField } from '@/ohq-ui/components/text-field'
import { useWaterLayout } from '../water-layout/load'

// 디자인(설정 > 레이아웃)에 따라 바꿔 끼우는 기본 부품 — 카드·숫자 카드·막대·알약·탭·버튼·아바타·입력. "물"이고 물
// 묶음(water-layout/load)을 받았으면 같은 props의 물 부품을, 아니면 공용 디자인 부품을 그린다. tech 화면은
// layout-parts로, 관리 화면(xtool-admin)은 여기서 바로 받는다 — 보드 부품까지 끌고 오지 않게 따로 둔다.

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

export function TextField(props: ComponentProps<typeof BaseTextField>) {
  const water = useWaterLayout()
  return water ? <water.WaterTextField {...props} /> : <BaseTextField {...props} />
}
