import { useEffect, useState } from 'react'
import { subscribeDeletionLogs, type DeletionLog } from '../client/card-client'

/** 삭제 기록(최신순)을 실시간으로 받는다. */
export const useDeletionLogs = () => {
  const [logs, setLogs] = useState<DeletionLog[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(
    () =>
      subscribeDeletionLogs(
        (next) => {
          setLogs(next)
          setStatus('ready')
        },
        () => setStatus('error'),
      ),
    [],
  )

  return { logs, status }
}
