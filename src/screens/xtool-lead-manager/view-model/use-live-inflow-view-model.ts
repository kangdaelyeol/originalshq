import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  inquiryClient,
  type LiveInquiry,
} from '@/screens/xtool-lead-manager/client'

// 보고 있는 동안 1분마다 다시 받는다.
const REFRESH_MS = 60_000

/** 한국 날짜(YYYY-MM-DD) — 신청의 접수일(receivedDate)과 같은 기준. */
const koreaDate = (ms: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(ms)

/** 테스트 신청 — 서버가 자동 문자를 보내지 않는 기준과 같다(고객명·회사명에
 * "테스트"나 "test"). 통계에서는 빼고 몇 건 뺐는지만 보여준다. */
const isTest = (inquiry: LiveInquiry) =>
  /테스트|test/i.test(`${inquiry.name} ${inquiry.company ?? ''}`)

/**
 * 인입통계 맨 위 "오늘 웹 문의 · 실시간" — 웹사이트 상담 신청(/log 문의 접수와
 * 같은 데이터)을 바로 센다. Monday 인입통계는 하루 여섯 번 동기화라 늦는데,
 * 그 사이에 들어온 웹 문의를 먼저 보여주는 용도다. 합계에 섞지 않는다(같은
 * 문의가 동기화 뒤 인입통계에도 잡히므로).
 *
 * active일 때(인입통계를 보고 있을 때)만 받고 1분마다 다시 받는다.
 */
export const useLiveInflowViewModel = (
  active: boolean,
  syncedAt: number | null,
) => {
  const [inquiries, setInquiries] = useState<LiveInquiry[]>([])
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )

  const load = useCallback(async () => {
    // 오늘 0시(한국)를 넘기려면 이틀 치를 받아 오늘만 고른다.
    const res = await inquiryClient.listRecent(2)
    if (!res.ok) {
      setStatus((prev) => (prev === 'ready' ? prev : 'error'))
      return
    }
    setInquiries(res.data.inquiries)
    setFetchedAt(res.data.fetchedAt)
    setStatus('ready')
  }, [])

  useEffect(() => {
    if (!active) return
    ;(async () => {
      await load()
    })()
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [active, load])

  const summary = useMemo(() => {
    if (fetchedAt === null) return null
    const today = koreaDate(fetchedAt)
    const todays = inquiries.filter((each) => each.receivedDate === today)
    const real = todays.filter((each) => !isTest(each))

    const byBoard = new Map<string, number>()
    for (const each of real) {
      byBoard.set(each.boardName, (byBoard.get(each.boardName) ?? 0) + 1)
    }

    return {
      today: real.length,
      tests: todays.length - real.length,
      // 마지막 Monday 동기화 뒤에 들어와 아직 인입통계에 없는 웹 문의.
      sinceSync:
        syncedAt === null
          ? null
          : real.filter((each) => each.receivedAt > syncedAt).length,
      // Monday 등록이 안 된(실패·대기) 건 — 처리는 /log 문의 접수에서.
      problems: real.filter((each) => each.monday.status !== 'success').length,
      byBoard: [...byBoard.entries()]
        .map(([board, total]) => ({ board, total }))
        .sort((a, b) => b.total - a.total || a.board.localeCompare(b.board)),
      latestAt: real[0]?.receivedAt ?? null,
    }
  }, [inquiries, fetchedAt, syncedAt])

  return { state: { status, summary, fetchedAt } }
}
