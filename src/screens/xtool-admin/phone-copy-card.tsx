import { httpsCallable } from 'firebase/functions'
import { Eye, Phone } from 'lucide-react'
import { useState } from 'react'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import { Button } from '@/screens/xtool-tech/components/ui/button'
import { ConfirmDialog } from '@/screens/xtool-tech/components/ui/confirm-dialog'
import { GlassCard } from '@/screens/xtool-tech/components/ui/glass-card'
import { functionErrorMessage } from './errors'

// 함수 제한 시간(300초)만큼 기다린다 — 출장 건 전부를 Monday에 쓰는 데 1분이 넘을 수 있다.
const LONG_CALL = { timeout: 300_000 }

interface CopyResult {
  dryRun: boolean
  column: { id: string | null; title: string; created: boolean }
  total: number
  targetCount: number
  targets: { itemId: string; name: string; phone: string }[]
  written: number
  alreadyFilled: number
  noPhoneCount: number
  noPhone: { itemId: string; name: string }[]
  errors: { itemId: string; name: string; error: string }[]
  /** 실행 뒤 보드 다시 동기화 결과 — 실패하면 새 칸이 캐시에 없어 webhook 자동 채우기가 안 된다. */
  sync: { ok: boolean; error: string | null } | null
}

const formatPhone = (digits: string) =>
  digits.replace(/^(02|0\d{2})(\d{3,4})(\d{4})$/, '$1-$2-$3')

/**
 * 출장업무 "전화번호" 칸 — item 이름(클라이언트)은 그대로 두고 이름에서 번호만 뽑아 새 칸에
 * 복사한다(functions-xtool techCopyPhones). 먼저 미리보기로 대상을 보고 실행한다. 이후 새 건은
 * webhook이 채운다.
 */
export function PhoneCopyCard() {
  const [busy, setBusy] = useState<'preview' | 'run' | null>(null)
  const [result, setResult] = useState<CopyResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const call = async (dryRun: boolean) => {
    setBusy(dryRun ? 'preview' : 'run')
    setError(null)
    setConfirming(false)
    try {
      const { data } = await httpsCallable<{ dryRun: boolean }, CopyResult>(
        xtoolFirebase().functions,
        'techCopyPhones',
        LONG_CALL,
      )({ dryRun })
      setResult(data)
    } catch (e) {
      setError(functionErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const canRun = result?.dryRun && result.targetCount > 0

  return (
    <GlassCard
      title="출장업무 전화번호 칸"
      subtitle="클라이언트(이름)는 그대로 두고, 이름에 적힌 번호만 '전화번호' 칸에 복사해요. 칸이 없으면 클라이언트 바로 옆에 만들고, 이미 채워진 건은 건너뛰어요. 이후 새로 만든 건은 webhook이 자동으로 채워요."
      actions={
        <>
          <Button variant="ghost" size="sm" icon={Eye} disabled={busy !== null} onClick={() => void call(true)}>
            {busy === 'preview' ? '확인하는 중…' : '미리보기'}
          </Button>
          <Button
            size="sm"
            icon={Phone}
            disabled={busy !== null || !canRun}
            title={canRun ? undefined : '먼저 미리보기로 대상을 확인해 주세요'}
            onClick={() => setConfirming(true)}
          >
            {busy === 'run' ? 'Monday에 쓰는 중…' : '복사 실행'}
          </Button>
        </>
      }
    >
      {error && (
        <p className="member-form__result member-form__result--crit admin-table-error" role="alert">
          {error}
        </p>
      )}
      {!result && !error && <p className="phone-copy__hint">미리보기를 누르면 Monday에 쓰지 않고 대상만 보여 줘요.</p>}
      {result && (
        <div className="phone-copy">
          <p className="phone-copy__summary">
            {result.dryRun ? '미리보기' : '실행 결과'} — 전체 {result.total}건 ·{' '}
            {result.dryRun ? `채울 건 ${result.targetCount}` : `채운 건 ${result.written}/${result.targetCount}`} · 이미 채워짐{' '}
            {result.alreadyFilled} · 이름에 번호 없음 {result.noPhoneCount}
            {result.errors.length > 0 && ` · 실패 ${result.errors.length}`}
            <br />
            {result.column.id
              ? `'${result.column.title}' 칸${result.column.created ? '을 새로 만들었어요' : '(이미 있음)'} — ${result.column.id}`
              : `'${result.column.title}' 칸이 아직 없어요 — 실행하면 클라이언트 옆에 만들어요.`}
          </p>
          {result.targets.length > 0 && (
            <div className="table-wrap phone-copy__table">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">클라이언트(그대로)</th>
                    <th scope="col">전화번호 칸에 들어갈 값</th>
                  </tr>
                </thead>
                <tbody>
                  {result.targets.map((t) => (
                    <tr key={t.itemId}>
                      <td>{t.name}</td>
                      <td className="table__strong">{formatPhone(t.phone)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.targetCount > result.targets.length && (
                <p className="phone-copy__hint">외 {result.targetCount - result.targets.length}건</p>
              )}
            </div>
          )}
          {result.noPhone.length > 0 && (
            <p className="phone-copy__hint">
              번호가 없어 건너뛸 건: {result.noPhone.map((n) => n.name).join(', ')}
              {result.noPhoneCount > result.noPhone.length && ` 외 ${result.noPhoneCount - result.noPhone.length}건`}
            </p>
          )}
          {result.sync && !result.sync.ok && (
            <p className="member-form__result member-form__result--crit">
              복사는 끝났지만 보드 다시 동기화에 실패했어요({result.sync.error ?? '알 수 없음'}). 위 Monday 연동 카드에서
              "지금 동기화"를 눌러 주세요 — 그래야 새 출장 건의 전화번호가 자동으로 채워져요.
            </p>
          )}
          {result.errors.length > 0 && (
            <p className="member-form__result member-form__result--crit">
              실패: {result.errors.map((e) => `${e.name}(${e.error})`).join(', ')}
            </p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        tone="primary"
        title={`전화번호 ${result?.targetCount ?? 0}건을 복사할까요?`}
        message="Monday 출장업무 보드의 '전화번호' 칸에 바로 써요(칸이 없으면 만들어요). 클라이언트 이름은 그대로예요."
        confirmLabel="복사 실행"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void call(false)}
      />
    </GlassCard>
  )
}
