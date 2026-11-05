import { useAppearance } from '@/ohq-ui/appearance/appearance'
import type { ThemeName } from '@/ohq-ui/theme/theme-root'

// 레이아웃 = 구조 × 디자인. 저장 값은 하나(설정 > 레이아웃 — ThemeName)이고, 화면은 여기서 두 축으로 나눠 읽는다.
// "monday인가·water인가"를 화면마다 직접 비교하지 않고, 무엇을 가르는지(짜임인지 모양인지)에 맞는 축을 본다.
//
// - 구조(structure): 보드·내 업무 화면의 짜임
//   dashboard — 숫자 카드·차트 + 목록 + 상세 모달(대시보드·물)
//   table     — Monday 그룹 표, 칸을 눌러 바로 고친다(Monday 표 — components/monday)
// - 디자인(design): 모든 화면의 색·부품 모양
//   glass — 유리 판(기본) · water — 물 부품(water-layout, 부품은 components/layout-parts가 바꿔 끼운다) ·
//   monday — Monday 판·색(styles/_theme-monday.scss)
//
// 대시보드와 물은 구조가 같아 부품만 다르고, Monday 표는 보드·내 업무만 전용 화면이다(나머지 화면은 대시보드
// 구조에 Monday 모양). 구조가 달라도 제공하는 기능은 같아야 한다.

export type LayoutStructure = 'dashboard' | 'table'
export type LayoutDesign = ThemeName

export interface LayoutKind {
  structure: LayoutStructure
  design: LayoutDesign
}

export const layoutKind = (theme: ThemeName): LayoutKind => ({
  structure: theme === 'monday' ? 'table' : 'dashboard',
  design: theme,
})

/** 지금 고른 레이아웃의 구조·디자인 */
export function useLayoutKind(): LayoutKind {
  return layoutKind(useAppearance().theme)
}
