import { httpsCallable } from 'firebase/functions'
import { ScanSearch } from 'lucide-react'
import { useState } from 'react'
import type { TechBoardKey, TechBoardMeta, TechColumn } from '@xtool-core/tech-boards'
import { missingDefaultMoves } from '@xtool-core/column-order'
import { visibleColumns } from '@xtool-core/monday-values'
import { missingTimelineTitles } from '@xtool-core/tech-timeline'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import { functionErrorMessage } from './errors'
import { Button, GlassCard } from '@/screens/xtool-tech/components/basic-parts'

interface Problem {
  where: string
  expected: string
  effect: string
  candidates: string[]
}

interface CheckedBoard {
  key: TechBoardKey
  name: string
  syncedAt: number | null
  sampled: number
  problems: Problem[]
  columns: Pick<TechColumn, 'id' | 'title' | 'type'>[]
}

const check = async () =>
  (await httpsCallable<void, { boards: CheckedBoard[] }>(xtoolFirebase().functions, 'techCheckColumns')()).data.boards

const syncedText = (at: number | null) =>
  at
    ? new Date(at).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '동기화 기록 없음'

/** 화면 묶기(타임라인·기본 칸 순서) — 웹이 쓰는 목록(xtool-core)이라 여기서 본다. 칸 이름은 화면 이름(연락처 등)으로. */
function screenProblems(board: CheckedBoard): Problem[] {
  const key = board.key
  const columns = visibleColumns({ columns: board.columns.map((c) => ({ ...c, writable: false })) } as TechBoardMeta)
  const timelineCandidates = columns.filter((c) => c.type === 'date' || c.type === 'time_tracking').map((c) => c.title)
  return [
    ...missingTimelineTitles(key, columns).map((title) => ({
      where: '타임라인 묶기',
      expected: title,
      effect: '타임라인 칸에 묶이지 않고 따로 보여요',
      candidates: timelineCandidates,
    })),
    ...missingDefaultMoves(key, columns).map((move) => ({
      where: '기본 칸 순서',
      expected: `${move.title} → ${move.after} 오른쪽`,
      effect: `${move.missing.join(', ')} 칸을 못 찾아 기본 자리로 못 옮겨요`,
      candidates: [],
    })),
  ]
}

/**
 * 칸 이름 점검 — 코드가 칸·그룹·라벨을 이름으로 찾는 곳(자동화 규칙·보드 화면·타임라인 묶기 등) 중 보드에 없는 것을
 * 보드마다 보여 준다(functions-xtool techCheckColumns + 화면 묶기는 여기서). Monday에서 칸 이름을 바꾸거나 지운 뒤
 * 동기화하고 누른다 — 캐시만 읽는다.
 */
export function ColumnCheckCard() {
  const [busy, setBusy] = useState(false)
  const [boards, setBoards] = useState<(CheckedBoard & { all: Problem[] })[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const list = await check()
      setBoards(list.map((board) => ({ ...board, all: [...board.problems, ...screenProblems(board)] })))
    } catch (e) {
      setError(functionErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const broken = boards?.filter((b) => b.all.length > 0) ?? []
  const fine = boards?.filter((b) => b.all.length === 0) ?? []
  const total = broken.reduce((sum, b) => sum + b.all.length, 0)

  return (
    <GlassCard
      title="칸 이름 점검"
      subtitle="자동화 규칙·보드 화면·타임라인 묶기가 이름으로 찾는 칸 중 보드에 없는 것을 보여 줘요. Monday에서 칸 이름을 바꾸거나 지웠다면 먼저 동기화하고 눌러 주세요."
      actions={
        <Button size="sm" variant="ghost" icon={ScanSearch} disabled={busy} onClick={() => void run()}>
          {busy ? '점검하는 중…' : '점검'}
        </Button>
      }
    >
      {error && (
        <p className="member-form__result member-form__result--crit admin-table-error" role="alert">
          {error}
        </p>
      )}
      {!boards && !error && (
        <p className="phone-copy__hint">
          칸 이름은 빈칸을 빼고 비교해요(예: “장기 상담 일”과 “장기 상담일”은 같아요). 글자가 바뀐 경우만 걸려요.
        </p>
      )}
      {boards && (
        <div className="phone-copy">
          <p className="phone-copy__summary">
            {total === 0 ? '모든 보드에서 찾는 칸이 다 있어요' : `보드 ${broken.length}개에서 ${total}개를 못 찾았어요`}
          </p>
          {broken.map((board) => (
            <div key={board.key} className="column-check__board">
              <p className="column-check__name">
                <strong>{board.name}</strong>
                <span>동기화 {syncedText(board.syncedAt)}</span>
              </p>
              <div className="table-wrap phone-copy__table">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">쓰는 곳</th>
                      <th scope="col">찾는 이름</th>
                      <th scope="col">못 찾으면</th>
                      <th scope="col">지금 이름들</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.all.map((problem) => (
                      <tr key={`${problem.where}:${problem.expected}`}>
                        <td className="table__muted">{problem.where}</td>
                        <td className="table__strong">{problem.expected}</td>
                        <td>{problem.effect}</td>
                        <td className="table__muted column-check__candidates">
                          {problem.candidates.length > 0 ? problem.candidates.join(', ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {fine.length > 0 && <p className="phone-copy__hint">이상 없음: {fine.map((b) => b.name).join(', ')}</p>}
        </div>
      )}
    </GlassCard>
  )
}
