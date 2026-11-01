import { useEffect } from 'react'
import { AUTO_REFRESH_MS } from '../constants'

/**
 * 처음 한 번, 그 뒤로 AUTO_REFRESH_MS마다 load를 부른다 — 단, 브라우저 탭이
 * 숨겨져 있을 때는 건너뛴다(보지 않는 화면을 위해 받고 다시 그리지 않게).
 * 숨겨진 사이 한 번이라도 건너뛰었으면 다시 볼 때 바로 받는다. load가 바뀌면
 * (기간을 바꾸는 등) 처음부터 다시.
 */
export const useAutoRefresh = (load: () => Promise<unknown>) => {
  useEffect(() => {
    let stale = false
    const tick = () => {
      if (document.hidden) {
        stale = true
        return
      }
      void load()
    }
    const onVisible = () => {
      if (!document.hidden && stale) {
        stale = false
        void load()
      }
    }
    void load()
    const timer = setInterval(tick, AUTO_REFRESH_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])
}
