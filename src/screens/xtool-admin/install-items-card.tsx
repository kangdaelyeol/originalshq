import { httpsCallable } from 'firebase/functions'
import { Eye, ListChecks } from 'lucide-react'
import { useState } from 'react'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { functionErrorMessage } from './errors'
import { Button, GlassCard } from '@/screens/xtool-tech/components/basic-parts'

// 함수 제한 시간(300초)만큼 기다린다 — 한 번에 3분까지 고치고 남은 줄은 다시 불러 이어서 고친다.
const LONG_CALL = { timeout: 300_000 }

interface InstallRow {
  itemId: string
  name: string
  current: string | null
  expected: string
  fixes: { subId: string; subName: string; from: string | null; to: string }[]
}

interface CheckResult {
  dryRun: boolean
  total: number
  withSubitems: number
  mismatchCount: number
  mismatches: InstallRow[]
  mirrorOnlyCount: number
  mirrorOnly: InstallRow[]
  fixCount: number
  written: number
  remaining: number
  errors: { itemId: string; name: string; error: string }[]
  mirror: { id: string | null; title: string }
  sync: { ok: boolean; error: string | null } | null
}

const call = async (dryRun: boolean) =>
  (
    await httpsCallable<{ dryRun: boolean }, CheckResult>(
      xtoolFirebase().functions,
      'techCheckInstallItems',
      LONG_CALL,
    )({ dryRun })
  ).data

/**
 * 출장업무 설치 품목 점검 — 설치 품목은 하위 줄 "품명"을 비추는 미러 칸이라, 품명이 "{품목명} {수량}개"와 다른
 * 하위 줄을 찾아 보여 주고 "채워넣기"로 고친다(functions-xtool techCheckInstallItems). 품명은 맞는데 설치 품목
 * 글자만 다른 건은 따로 알린다(미러 칸은 우리가 쓸 수 없다). 그 뒤로 새로 고친 줄은 webhook 규칙이 맞춘다.
 */
export function InstallItemsCard() {
  const [busy, setBusy] = useState<'check' | 'fill' | null>(null)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [filled, setFilled] = useState<{ written: number; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const check = async () => {
    setBusy('check')
    setError(null)
    try {
      setResult(await call(true))
      setFilled(null)
    } catch (e) {
      setError(functionErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  // 남은 줄이 없을 때까지 이어서 부른다 — 끝나면 다시 점검해 지금 상태를 보여 준다.
  const fill = async () => {
    setConfirming(false)
    setBusy('fill')
    setError(null)
    let written = 0
    const errors: string[] = []
    try {
      for (;;) {
        const run = await call(false)
        written += run.written
        errors.push(...run.errors.map((e) => `${e.name}(${e.error})`))
        setFilled({ written, errors: [...errors] })
        if (run.sync && !run.sync.ok)
          setError(`고친 뒤 보드 다시 동기화에 실패했어요(${run.sync.error ?? '알 수 없음'})`)
        if (run.remaining === 0) break
      }
      setResult(await call(true))
    } catch (e) {
      setError(functionErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const canFill = !!result && result.fixCount > 0

  return (
    <GlassCard
      title="출장업무 설치 품목 점검"
      subtitle="설치 품목은 하위 줄 '품명'을 이어 보여 주는 미러 칸이에요. 품명이 '{품목명} {수량}개'와 다른 하위 줄을 찾아 보여 주고, 채워넣기로 맞춰요. 품명이 맞으면 설치 품목도 저절로 맞아요."
      actions={
        <>
          <Button variant="ghost" size="sm" icon={Eye} disabled={busy !== null} onClick={() => void check()}>
            {busy === 'check' ? '점검하는 중…' : '점검'}
          </Button>
          <Button
            size="sm"
            icon={ListChecks}
            disabled={busy !== null || !canFill}
            title={canFill ? undefined : '먼저 점검으로 고칠 줄을 확인해 주세요'}
            onClick={() => setConfirming(true)}
          >
            {busy === 'fill' ? `채우는 중… ${filled?.written ?? 0}/${result?.fixCount ?? 0}` : '채워넣기'}
          </Button>
        </>
      }
    >
      {error && (
        <p className="member-form__result member-form__result--crit admin-table-error" role="alert">
          {error}
        </p>
      )}
      {!result && !error && (
        <p className="phone-copy__hint">
          점검을 누르면 Monday에서 출장 보드를 새로 읽어, 고치지 않고 다른 곳만 보여 줘요.
        </p>
      )}
      {result && (
        <div className="phone-copy">
          <p className="phone-copy__summary">
            전체 {result.total}건 · 하위 줄 있는 건 {result.withSubitems} · 품명이 다른 건 {result.mismatchCount}
            {result.fixCount > 0 && `(고칠 하위 줄 ${result.fixCount})`} · 품명은 맞는데 설치 품목이 다른 건{' '}
            {result.mirrorOnlyCount}
            {result.mismatchCount === 0 && result.mirrorOnlyCount === 0 && ' — 모두 맞아요'}
          </p>
          {filled && (
            <p className="phone-copy__summary">
              채워넣기 — 고친 하위 줄 {filled.written}
              {filled.errors.length > 0 && ` · 실패 ${filled.errors.length}: ${filled.errors.join(', ')}`}
            </p>
          )}
          {!result.mirror.id && (
            <p className="phone-copy__hint">'{result.mirror.title}' 미러 칸을 찾지 못해 품명만 점검했어요.</p>
          )}
          {result.mismatches.length > 0 && (
            <div className="table-wrap phone-copy__table">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">클라이언트</th>
                    <th scope="col">고칠 품명</th>
                    <th scope="col">지금 설치 품목</th>
                    <th scope="col">맞춘 뒤 설치 품목</th>
                  </tr>
                </thead>
                <tbody>
                  {result.mismatches.map((row) => (
                    <tr key={row.itemId}>
                      <td>{row.name}</td>
                      <td>
                        <span className="install-check__fixes">
                          {row.fixes.map((fix) => (
                            <span key={fix.subId}>
                              {fix.from ?? '(비어 있음)'} → <strong>{fix.to}</strong>
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="table__muted">{row.current || '—'}</td>
                      <td className="table__strong">{row.expected || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.mismatchCount > result.mismatches.length && (
                <p className="phone-copy__hint">외 {result.mismatchCount - result.mismatches.length}건</p>
              )}
            </div>
          )}
          {result.mirrorOnly.length > 0 && (
            <p className="phone-copy__hint">
              품명은 맞는데 설치 품목 글자가 다른 건(미러 칸 설정이 품명이 아니거나, Monday가 아직 바꾸지 않았을 수
              있어요 — 잠시 뒤 다시 점검해 보세요): {result.mirrorOnly.map((row) => row.name).join(', ')}
              {result.mirrorOnlyCount > result.mirrorOnly.length &&
                ` 외 ${result.mirrorOnlyCount - result.mirrorOnly.length}건`}
            </p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        tone="primary"
        title={`하위 줄 ${result?.fixCount ?? 0}개의 품명을 맞출까요?`}
        message="Monday 출장업무 하위 줄의 '품명' 칸을 '{품목명} {수량}개'로 바로 고쳐요. 설치 품목은 미러라 저절로 따라 바뀌어요."
        confirmLabel="채워넣기"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void fill()}
      />
    </GlassCard>
  )
}
