import { useLayoutKind } from '../lib/layout-kind'

// 물 레이아웃(설정 > 레이아웃 "물") 묶음 — 물을 고른 사람만 받는다(물 부품·스타일·화면 틀). 한 번 받으면 모듈을
// 들고 있어서, 레이아웃 부품(components/layout-parts)이 렌더 중에 바로 꺼내 쓴다 — 부품마다 Suspense로 기다리지
// 않는다. 셸(WaterShellGate)이 받기를 마친 뒤에 화면을 그리니, 물 화면 안에서는 늘 받아져 있다.
type WaterLayoutModule = typeof import('./water-layout')

let loaded: WaterLayoutModule | null = null
let pending: Promise<WaterLayoutModule> | null = null

/** 묶음 받기 — 여러 번 불러도 한 번만 받는다(실패하면 다음 번에 다시 받는다). */
export function loadWaterLayout(): Promise<WaterLayoutModule> {
  pending ??= import('./water-layout').then(
    (m) => (loaded = m),
    (error: unknown) => {
      pending = null
      throw error
    },
  )
  return pending
}

/** 물 레이아웃이면 받아 둔 묶음, 아니면(또는 아직 못 받았으면) null — 그때는 지금 부품을 그린다. */
export function useWaterLayout(): WaterLayoutModule | null {
  const { design } = useLayoutKind()
  return design === 'water' ? loaded : null
}
