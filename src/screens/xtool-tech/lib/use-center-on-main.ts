import { useLayoutEffect, useRef } from 'react'

// 화면 아래 가운데 떠 있는 막대(고르기 막대 — 대시보드·Monday 표·물)를 창 가운데가 아니라 본문(사이드바 오른쪽)
// 가운데에 둔다. 사이드바를 접고 펴거나 창 크기가 바뀌면 따라간다. 막대 CSS는 left: 50% + translateX(-50%)라 left만
// 본문 가운데 좌표로 바꾼다(재지 못하면 창 가운데 그대로).

const MAIN = '.shell__main, .wl-main'

/** 막대에 붙일 ref — shown이 참인 동안 본문 가운데를 따라간다 */
export function useCenterOnMain<T extends HTMLElement>(shown: boolean) {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const bar = ref.current
    const main = document.querySelector<HTMLElement>(MAIN)
    if (!shown || !bar || !main) return
    const place = () => {
      const b = main.getBoundingClientRect()
      bar.style.left = `${Math.round(b.left + b.width / 2)}px`
    }
    place()
    // 사이드바 접기·펴기(폭이 움직인다)·창 크기
    const observer = new ResizeObserver(place)
    observer.observe(main)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [shown])
  return ref
}
