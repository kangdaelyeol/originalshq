import { useCallback, useState } from 'react'
import {
  mortarScore as fetchMortarScore,
  alertCheck as recomputeAlerts,
  listAlerts as fetchAlerts,
  CallableError,
  type MortarScoreResult,
  type AlertSummary,
} from '../client'

export const useBrandDashboardViewModel = () => {
  const [brandId, setBrandId] = useState('')
  const [score, setScore] = useState<MortarScoreResult | null>(null)
  const [alerts, setAlerts] = useState<AlertSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const describeError = (err: unknown, fallback: string): string =>
    err instanceof CallableError || err instanceof Error
      ? err.message
      : fallback

  /** 현재 점수 + 미확인 알림 목록을 조회 (재계산 없이 있는 걸 그대로 보여줌). */
  const load = useCallback(async () => {
    const id = brandId.trim()
    if (!id) return
    setError(null)
    setLoading(true)
    try {
      const [scoreResult, alertsResult] = await Promise.all([
        fetchMortarScore({ brandId: id }),
        fetchAlerts({ brandId: id }),
      ])
      setScore(scoreResult)
      setAlerts(alertsResult.alerts)
    } catch (err) {
      setError(describeError(err, '조회 중 오류가 발생했습니다.'))
    } finally {
      setLoading(false)
    }
  }, [brandId])

  /** 이상 징후 재검사(새 알림 생성) 후 목록을 새로 불러옴. */
  const recheck = useCallback(async () => {
    const id = brandId.trim()
    if (!id) return
    setError(null)
    setChecking(true)
    try {
      await recomputeAlerts({ brandId: id })
      await load()
    } catch (err) {
      setError(describeError(err, '재검사 중 오류가 발생했습니다.'))
    } finally {
      setChecking(false)
    }
  }, [brandId, load])

  return {
    brandId,
    setBrandId,
    score,
    alerts,
    loading,
    checking,
    error,
    load,
    recheck,
  }
}
