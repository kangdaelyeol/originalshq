/** 화면 뒤에 고정된 배경 — 검은 파편(public/bg-shards.svg) 위에 강조색 빛 번짐, 대각선
 * 빛줄기, 가장자리 어둡게를 겹친다. 유리 카드가 이걸 흐려서 비춰 보이게 하는 게 핵심. */
export function AppBackground() {
  return (
    <div className="app-bg" aria-hidden>
      <div className="app-bg__shards" />
      <div className="app-bg__glow" />
      <div className="app-bg__streaks" />
      <div className="app-bg__vignette" />
    </div>
  )
}
