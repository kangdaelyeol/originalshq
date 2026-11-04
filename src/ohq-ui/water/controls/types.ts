import type { ComponentType } from 'react'
import type { Option } from '../../types'
import type { WaterDropEffect } from '../fx'

/** 물 부품 아이콘 — lucide 아이콘이나 className을 받는 SVG 컴포넌트 */
export type WaterIcon = ComponentType<{ className?: string }>

/** 고를 것 하나 — 기존 Option에 아이콘을 더했다(iconOnly면 아이콘만 보이고 label은 읽어 주기용) */
export interface WaterOption<T extends string> extends Option<T> {
  icon?: WaterIcon
}

/** 고를 때 물방울 — bounce: 튀어 올랐다 통통, splash: 떨어져 흩어짐, none: 표시 알약만 옮긴다 */
export type WaterEffect = WaterDropEffect | 'none'
