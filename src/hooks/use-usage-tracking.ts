import { useEffect, useRef } from 'react'
import { API_BASE } from '@/screens/xtool-lead-manager/constants'

// 사용 분석 수집 — 화면이 어떤 탭을 얼마나 실제로 봤는지를 functions-xtool의
// logUsage로 보낸다(/log의 "사용 분석" 탭이 읽는다). 사용자에게 아무것도 묻지
// 않고, 이름·연락처 같은 값은 보내지 않는다.
//
// 탭 방문 하나 = 기록 하나(segment). 들어올 때 만들고, 보는 동안 1분마다 본
// 시간을 갱신하고, 다른 탭으로 가거나 창을 닫을 때 마지막 값으로 닫는다.
// 창을 닫을 때도 빠지지 않게 navigator.sendBeacon으로 보낸다.

export type UsageApp = 'xtool' | 'cmip'

const ENDPOINT = `${API_BASE}/logUsage`
const PING_MS = 60_000
const VISITOR_KEY = 'usage-visitor-id'
// localhost에서 연 화면(개발 중)은 기본으로 보내지 않는다 — 운영 기록에 섞이지
// 않게. 확인이 필요하면 localStorage에 이 키를 '1'로 넣는다.
const DEV_FLAG_KEY = 'usage-tracking-dev'

const randomId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 같은 브라우저면 같은 값 — 저장소를 못 쓰면 이번 방문에만 쓰는 값. */
const visitorIdOf = (): string => {
  const saved = readStorage(VISITOR_KEY)
  if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved
  const id = randomId()
  try {
    localStorage.setItem(VISITOR_KEY, id)
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등) — 이번 방문만 같은 값.
  }
  return id
}

const isEnabled = (): boolean => {
  if (typeof window === 'undefined') return false
  const local = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
  return !local || readStorage(DEV_FLAG_KEY) === '1'
}

interface Segment {
  id: string
  view: string
  startedAt: number
  visibleMs: number
  /** 지금 보고 있으면 본 시간을 세기 시작한 시각, 숨겨져 있으면 null. */
  visibleSince: number | null
  /** 이미 닫아 보낸 방문 — 더 보내지 않는다(창을 떠날 때 pagehide 뒤에
   * visibilitychange가 한 번 더 와서, 그대로 보내면 닫힘이 덮어써졌다). */
  closed: boolean
}

const send = (body: object) => {
  const json = JSON.stringify(body)
  try {
    const blob = new Blob([json], { type: 'text/plain;charset=UTF-8' })
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return
  } catch {
    // beacon을 못 쓰면 아래 fetch로.
  }
  void fetch(ENDPOINT, {
    method: 'POST',
    body: json,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    keepalive: true,
  }).catch(() => {})
}

/**
 * 화면(app)의 지금 탭(view)을 사용 분석으로 보낸다 — view가 바뀌면 이전 탭
 * 방문을 닫고 새로 연다. 화면을 떠나면(언마운트·창 닫기) 마지막 방문을 닫는다.
 */
export const useUsageTracking = (app: UsageApp, view: string) => {
  const trackerRef = useRef<{ setView: (view: string) => void } | null>(null)

  useEffect(() => {
    if (!isEnabled()) return
    const visitorId = visitorIdOf()
    const sessionId = randomId()
    let segment: Segment | null = null

    const isVisible = () => document.visibilityState === 'visible'
    const accumulate = (current: Segment) => {
      if (current.visibleSince === null) return
      const now = Date.now()
      current.visibleMs += now - current.visibleSince
      current.visibleSince = isVisible() ? now : null
    }
    const flush = (current: Segment, closed: boolean) => {
      if (current.closed) return
      current.closed = closed
      send({
        segments: [
          {
            id: current.id,
            app,
            visitorId,
            sessionId,
            view: current.view,
            startedAt: current.startedAt,
            visibleMs: current.visibleMs,
            closed,
          },
        ],
      })
    }

    const setView = (next: string) => {
      if (segment?.view === next) return
      if (segment) {
        accumulate(segment)
        flush(segment, true)
      }
      const now = Date.now()
      segment = {
        id: randomId(),
        view: next,
        startedAt: now,
        visibleMs: 0,
        visibleSince: isVisible() ? now : null,
        closed: false,
      }
      flush(segment, false)
    }

    const onVisibility = () => {
      if (!segment || segment.closed) return
      if (isVisible()) {
        segment.visibleSince = Date.now()
        return
      }
      accumulate(segment)
      segment.visibleSince = null
      flush(segment, false)
    }
    const onPageHide = () => {
      if (!segment || segment.closed) return
      accumulate(segment)
      flush(segment, true)
    }
    // 뒤로 가기 등으로 페이지가 캐시에서 되살아나면(bfcache) 닫았던 방문
    // 대신 같은 탭으로 새 방문을 연다.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !segment?.closed) return
      const view = segment.view
      segment = null
      setView(view)
    }
    const timer = window.setInterval(() => {
      if (!segment || segment.closed || !isVisible()) return
      accumulate(segment)
      flush(segment, false)
    }, PING_MS)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    trackerRef.current = { setView }

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      trackerRef.current = null
      if (segment && !segment.closed) {
        accumulate(segment)
        flush(segment, true)
      }
    }
  }, [app])

  useEffect(() => {
    trackerRef.current?.setView(view)
  }, [view, app])
}
