import { httpsCallable } from 'firebase/functions'
import { Eye, UserRoundCheck } from 'lucide-react'
import { useState } from 'react'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import { Button } from '@/ohq-ui/components/button'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { GlassCard } from '@/ohq-ui/components/glass-card'
import { BOARD_TABS, type TechBoardKey } from '@xtool-core/tech-boards'
import { functionErrorMessage } from './errors'

// 함수 제한 시간(300초)만큼 기다린다 — 한 번에 3분까지 쓰고 남은 건은 다시 불러 이어서 쓴다.
const LONG_CALL = { timeout: 300_000 }

/** 담당자 칸이 있는 보드 — 서버 tech-boards/assignees.ts ASSIGNEE_BOARDS와 같게 */
const BOARDS: TechBoardKey[] = ['fieldService', 'repair', 'techInquiry', 'techTask', 'rentals']

interface CopyResult {
  boardKey: TechBoardKey
  dryRun: boolean
  column: { id: string | null; title: string; created: boolean }
  total: number
  targetCount: number
  targets: { itemId: string; name: string; assignees: string }[]
  written: number
  alreadyFilled: number
  /** 시간이 모자라 못 쓴 건 — 다시 부르면 이어서 쓴다 */
  remaining: number
  errors: { itemId: string; name: string; error: string }[]
  /** 다 쓴 뒤 보드 다시 동기화 결과 */
  sync: { ok: boolean; error: string | null } | null
}

/** 보드 하나의 결과(실행은 여러 번 부른 것을 합친다) */
interface BoardRow {
  key: TechBoardKey
  preview: CopyResult | null
  written: number
  running: boolean
  done: boolean
  errors: string[]
  sync: CopyResult['sync']
}

const labelOf = (key: TechBoardKey) => BOARD_TABS.find((t) => t.key === key)?.label ?? key

const copy = async (boardKey: TechBoardKey, dryRun: boolean) =>
  (
    await httpsCallable<{ boardKey: TechBoardKey; dryRun: boolean }, CopyResult>(
      xtoolFirebase().functions,
      'techCopyAssignees',
      LONG_CALL,
    )({ boardKey, dryRun })
  ).data

/**
 * 담당자 칸 옮기기 — 담당자는 우리 시스템(기술팀 명단)으로만 정하고 Monday 사용자 계정은 쓰지 않아서,
 * 보드마다 "담당자(엑스툴)" 글자 칸을 만들고 지금 "담당자" 칸에 보이는 이름을 글자 그대로 복사한다
 * (functions-xtool techCopyAssignees). 그 뒤로 tech 화면은 이 칸에 담당자를 쓴다. 미리보기로 대상을 보고
 * 실행한다.
 */
export function AssigneeCopyCard() {
  const [rows, setRows] = useState<BoardRow[]>([])
  const [busy, setBusy] = useState<'preview' | 'run' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const patch = (key: TechBoardKey, next: Partial<BoardRow>) =>
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...next } : row)))

  const preview = async () => {
    setBusy('preview')
    setError(null)
    setRows(BOARDS.map((key) => ({ key, preview: null, written: 0, running: false, done: false, errors: [], sync: null })))
    try {
      for (const key of BOARDS) patch(key, { preview: await copy(key, true) })
    } catch (e) {
      setError(functionErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const run = async () => {
    setConfirming(false)
    setBusy('run')
    setError(null)
    try {
      for (const row of rows) {
        // 칸이 이미 있고 옮길 건도 없으면 건너뛴다.
        if (row.preview?.column.id && row.preview.targetCount === 0) {
          patch(row.key, { done: true })
          continue
        }
        patch(row.key, { running: true })
        let written = 0
        const errors: string[] = []
        for (;;) {
          const result = await copy(row.key, false)
          written += result.written
          errors.push(...result.errors.map((e) => `${e.name}(${e.error})`))
          patch(row.key, { written, errors: [...errors], sync: result.sync })
          if (result.remaining === 0) break
        }
        patch(row.key, { running: false, done: true })
      }
    } catch (e) {
      setError(functionErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const previewed = rows.length > 0 && rows.every((row) => row.preview)
  const total = rows.reduce((sum, row) => sum + (row.preview?.targetCount ?? 0), 0)
  const missingColumns = rows.filter((row) => row.preview && !row.preview.column.id).length

  return (
    <GlassCard
      title="담당자 칸 옮기기"
      subtitle="담당자는 우리 기술팀 명단으로만 정해요(Monday 계정은 쓰지 않아요). 보드마다 '담당자(엑스툴)' 글자 칸을 만들고, 지금 '담당자' 칸에 보이는 이름을 글자 그대로 복사해요. 원래 칸은 그대로 두고, 이미 채워진 건은 건너뛰어요. 그 뒤로 tech 화면은 새 칸에 담당자를 써요."
      actions={
        <>
          <Button variant="ghost" size="sm" icon={Eye} disabled={busy !== null} onClick={() => void preview()}>
            {busy === 'preview' ? '확인하는 중…' : '미리보기'}
          </Button>
          <Button
            size="sm"
            icon={UserRoundCheck}
            disabled={busy !== null || !previewed || (total === 0 && missingColumns === 0)}
            title={previewed ? undefined : '먼저 미리보기로 대상을 확인해 주세요'}
            onClick={() => setConfirming(true)}
          >
            {busy === 'run' ? 'Monday에 쓰는 중…' : '옮기기 실행'}
          </Button>
        </>
      }
    >
      {error && (
        <p className="member-form__result member-form__result--crit admin-table-error" role="alert">
          {error}
        </p>
      )}
      {rows.length === 0 && !error && (
        <p className="phone-copy__hint">미리보기를 누르면 Monday에 쓰지 않고 보드별 대상만 보여 줘요.</p>
      )}
      {rows.length > 0 && (
        <div className="table-wrap phone-copy__table">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">보드</th>
                <th scope="col">담당자(엑스툴) 칸</th>
                <th scope="col">옮길 건</th>
                <th scope="col">이미 채워짐</th>
                <th scope="col">예시</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const p = row.preview
                return (
                  <tr key={row.key}>
                    <td className="table__strong">{labelOf(row.key)}</td>
                    <td>{!p ? '확인하는 중…' : p.column.id ? '있음' : '없음 — 실행하면 만들어요'}</td>
                    <td>
                      {p ? (row.running || row.done ? `${row.written}/${p.targetCount}` : p.targetCount) : '—'}
                      {row.running && ' · 쓰는 중…'}
                      {row.done && ' · 끝'}
                    </td>
                    <td>{p?.alreadyFilled ?? '—'}</td>
                    <td>{p?.targets.slice(0, 2).map((t) => `${t.name} → ${t.assignees}`).join(' · ') || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.some((row) => row.errors.length > 0) && (
        <p className="member-form__result member-form__result--crit">
          실패:{' '}
          {rows
            .filter((row) => row.errors.length > 0)
            .map((row) => `${labelOf(row.key)} — ${row.errors.slice(0, 5).join(', ')}${row.errors.length > 5 ? ` 외 ${row.errors.length - 5}건` : ''}`)
            .join(' / ')}
        </p>
      )}
      {rows.some((row) => row.sync && !row.sync.ok) && (
        <p className="member-form__result member-form__result--crit">
          옮기기는 끝났지만 일부 보드의 다시 동기화에 실패했어요. 위 Monday 연동 카드에서 "지금 동기화"를 눌러 주세요 — 그래야
          tech 화면에 새 담당자 칸이 보여요.
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        tone="primary"
        title={`담당자 ${total}건을 옮길까요?`}
        message={`Monday 보드에 바로 써요${missingColumns ? `(칸이 없는 보드 ${missingColumns}개에는 '담당자(엑스툴)' 칸을 만들어요)` : ''}. 원래 '담당자' 칸은 그대로예요. 건수가 많으면 몇 분 걸려요.`}
        confirmLabel="옮기기 실행"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void run()}
      />
    </GlassCard>
  )
}
