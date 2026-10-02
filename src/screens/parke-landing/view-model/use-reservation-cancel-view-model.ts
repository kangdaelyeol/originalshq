import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

/*
 * Cancellation page controller.
 *
 * The id travels in the query string and the cancel key in the hash, so the
 * key never reaches a server log.
 */
export const useReservationCancelViewModel = () => {
  const [params] = useSearchParams()
  const { hash } = useLocation()
  const [key, setKey] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const id = params.get('id') || ''

  useEffect(() => {
    setKey(decodeURIComponent(hash.slice(1)))
  }, [hash])

  async function cancel() {
    setBusy(true)
    setStatus('')
    try {
      const response = await fetch('/api/reservations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, key }),
      })
      // The reservation API is not wired up in this app yet, so a non-JSON
      // response is a realistic outcome; fall back to the message below.
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      if (!response.ok) throw new Error(body.error)
      setDone(true)
      setStatus('예약이 취소되었고 예약 정보가 삭제되었습니다.')
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setBusy(false)
    }
  }

  return {
    state: { id, status, busy, done, canCancel: Boolean(id && key) && !busy },
    actions: { cancel },
  }
}
