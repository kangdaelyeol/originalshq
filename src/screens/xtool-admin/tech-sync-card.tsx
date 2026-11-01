import { collection, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { RefreshCw, Webhook } from 'lucide-react'
import { useEffect, useState } from 'react'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import { Button } from '@/screens/xtool-tech/components/ui/button'
import { GlassCard } from '@/screens/xtool-tech/components/ui/glass-card'
import { StatusPill } from '@/screens/xtool-tech/components/ui/status-pill'
import type { TechBoardMeta } from '@/screens/xtool-tech/data/tech-boards'
import { relativeTime } from './errors'

// 보드 순서 — functions-xtool/src/tech-boards/boards.ts의 TECH_BOARDS와 같게.
const ORDER = ['fieldService', 'repair', 'techInquiry', 'techTask', 'records', 'asRequests', 'parts', 'rentals', 'serials']

type Notice = { tone: 'good' | 'crit'; text: string }

// 함수 호출 클라이언트는 기본 70초만 기다린다 — 전체 동기화·webhook 설정은 1분을 넘길 수
// 있어 함수 제한 시간(300초)만큼 기다린다.
const LONG_CALL = { timeout: 300_000 }

/** Monday 연동 — 보드별 마지막 동기화·webhook 상태, 지금 동기화·webhook 다시 설정. */
export function TechSyncCard() {
  const [metas, setMetas] = useState<TechBoardMeta[] | null>(null)
  const [busy, setBusy] = useState<'sync' | 'webhooks' | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(
    () =>
      onSnapshot(
        collection(xtoolFirebase().db, 'techBoardMeta'),
        (snap) =>
          setMetas(
            snap.docs.map((d) => d.data() as TechBoardMeta).sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key)),
          ),
        (error) => setNotice({ tone: 'crit', text: `보드 정보를 읽지 못했어요: ${error.message}` }),
      ),
    [],
  )

  const run = async (kind: 'sync' | 'webhooks') => {
    setBusy(kind)
    setNotice(null)
    try {
      const { functions } = xtoolFirebase()
      if (kind === 'sync') {
        const { data } = await httpsCallable<void, { okCount: number; failedCount: number }>(functions, 'techSyncNow', LONG_CALL)()
        setNotice({
          tone: data.failedCount ? 'crit' : 'good',
          text: `동기화 끝 — 성공 ${data.okCount}개${data.failedCount ? `, 실패 ${data.failedCount}개(아래 표 참고)` : ''}`,
        })
      } else {
        const { data } = await httpsCallable<void, { boards: { key: string; created: number; errors: string[] }[] }>(
          functions,
          'techSetupWebhooks',
          LONG_CALL,
        )()
        const failed = data.boards.filter((b) => b.errors.length)
        setNotice({
          tone: failed.length ? 'crit' : 'good',
          text: failed.length
            ? `webhook 일부 실패 — ${failed.map((b) => `${b.key}: ${b.errors[0]}`).join(' / ')}`
            : `webhook ${data.boards.reduce((sum, b) => sum + b.created, 0)}개를 만들었어요.`,
        })
      }
    } catch (e) {
      setNotice({ tone: 'crit', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <GlassCard
      title="Monday 연동"
      subtitle="기술지원팀 보드 — Monday 변경은 webhook으로 몇 초 안에, 놓친 것은 정기 동기화(하루 여섯 번)가 메워요."
      actions={
        <>
          <Button variant="ghost" size="sm" icon={Webhook} disabled={busy !== null} onClick={() => void run('webhooks')}>
            {busy === 'webhooks' ? '설정하는 중…' : 'webhook 다시 설정'}
          </Button>
          <Button size="sm" icon={RefreshCw} disabled={busy !== null} onClick={() => void run('sync')}>
            {busy === 'sync' ? '동기화하는 중…(1분 남짓)' : '지금 동기화'}
          </Button>
        </>
      }
    >
      {notice && (
        <p className={`member-form__result member-form__result--${notice.tone} admin-table-error`} role="status">
          {notice.text}
        </p>
      )}
      <div className="table-wrap">
        <table className="table table--roomy">
          <thead>
            <tr>
              <th scope="col">보드</th>
              <th scope="col">항목</th>
              <th scope="col">마지막 동기화</th>
              <th scope="col">webhook</th>
            </tr>
          </thead>
          <tbody>
            {metas?.length === 0 && (
              <tr>
                <td colSpan={4} className="table__empty">
                  아직 동기화된 보드가 없어요. "지금 동기화"를 눌러 주세요.
                </td>
              </tr>
            )}
            {metas?.map((meta) => (
              <tr key={meta.key}>
                <td>
                  <p className="person__name">{meta.name || meta.key}</p>
                  <p className="person__sub">{meta.key}</p>
                </td>
                <td className="table__muted">{meta.lastSync?.ok ? `${meta.lastSync.count}건` : '—'}</td>
                <td>
                  {meta.lastSync ? (
                    <span className="sync-cell">
                      <StatusPill tone={meta.lastSync.ok ? 'good' : 'crit'} dot>
                        {meta.lastSync.ok ? '성공' : '실패'}
                      </StatusPill>
                      <span className="table__muted">{relativeTime(meta.lastSync.at)}</span>
                      {meta.lastSync.error && <span className="sync-cell__error">{meta.lastSync.error}</span>}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {meta.webhooks ? (
                    <span className="sync-cell">
                      <StatusPill tone={meta.webhooks.errors.length ? 'warn' : 'good'} dot>
                        {meta.webhooks.ids.length}개
                      </StatusPill>
                      {meta.webhooks.errors.length > 0 && (
                        <span className="sync-cell__error" title={meta.webhooks.errors.join('\n')}>
                          실패 {meta.webhooks.errors.length}개
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="table__muted">설정 전</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}
