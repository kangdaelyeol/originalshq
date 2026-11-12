import { Eye, Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/xtool-auth/auth-fetch'
import { API_BASE } from '@/screens/xtool-lead-manager/constants'
import { relativeTime } from './errors'
import { Button, GlassCard, StatusPill } from '@/screens/xtool-tech/components/basic-parts'
import './crm-boards-card.scss'

// 리드 매니저 보드 — 리드 매니저(Monday 고객·통계·리드 분석·CAPI 자동 전송)가 읽는 Monday 보드를 등록·해제한다.
// functions-xtool의 관리자 함수(listMondayBoards · previewMondayBoard · registerMondayBoard · removeMondayBoard)를 부른다.
// 등록한 보드만 예약 동기화(하루 여섯 번)가 받는다 — 웹 문의가 보드에 들어가는 것(submitInquiry)과는 따로다.

/** 등록된 보드 — functions-xtool monday/types.ts의 MondayBoard에서 화면에 쓰는 것만 */
interface CrmBoard {
  id: string
  name: string
  kind: string
  columns: { id: string; title: string; type: string }[]
  resolvedPhoneColumnId: string | null
  registeredAt: number
  lastSync: {
    ok: boolean
    at: number
    itemCount: number
    missingPhoneCount: number
    error?: string
  } | null
}

/** 미리보기 — 저장하지 않고 보드를 한 번 읽은 요약(MondayBoardPreview) */
interface BoardPreview {
  boardId: string
  name: string
  itemCount: number
  columns: { id: string; title: string; type: string }[]
  phone: { columnId: string | null; missingCount: number; duplicatedPhoneCount: number }
}

type Notice = { tone: 'good' | 'crit'; text: string }

// 보드 종류(서버가 컬럼 제목으로 추정한 것) — 통합 고객의 어느 목록에 들어가는지
const KIND_LABEL: Record<string, string> = {
  consultation: '상담',
  visit: '방문체험',
  purchase: '결제',
  survey: '만족도 조사',
  sampleTest: '샘플테스트',
  fieldService: '출장',
  repair: 'AS',
  techInquiry: '아톡문의',
  techTask: '기타업무',
  other: '기타',
}
// 종류 순서 — 표를 이 순서로, 같은 종류는 이름 순
const KIND_ORDER = Object.keys(KIND_LABEL)

/** 관리자 토큰을 붙여 부르고, 실패하면 서버가 준 문구로 던진다 */
const call = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await authFetch(`${API_BASE}/${path}`, init)
  const body = (await response.json().catch(() => ({}))) as T & { error?: string; board?: CrmBoard }
  if (!response.ok) {
    // 등록은 됐지만 첫 동기화가 실패한 경우(502 + board)
    if (body.board?.lastSync?.error)
      throw new Error(`등록은 됐지만 첫 동기화가 실패했어요: ${body.board.lastSync.error}`)
    throw new Error(body.error ?? `요청이 실패했어요 (HTTP ${response.status})`)
  }
  return body
}

const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/** Monday 보드 id — 숫자만(주소를 통째로 붙여 넣어도 /boards/ 뒤 숫자를 꺼낸다) */
const boardIdOf = (text: string) => {
  const fromUrl = /boards\/(\d+)/.exec(text)
  return fromUrl ? fromUrl[1] : text.replace(/\D/g, '')
}

export function CrmBoardsCard() {
  const [boards, setBoards] = useState<CrmBoard[] | null>(null)
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<BoardPreview | null>(null)
  const [busy, setBusy] = useState<'list' | 'preview' | 'register' | `remove:${string}` | null>(null)
  // 해제 확인 중인 보드 — 한 번 더 눌러야 해제한다
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const boardId = boardIdOf(input)

  const load = useCallback(async () => {
    setBusy('list')
    try {
      const { boards: list } = await call<{ boards: CrmBoard[] }>('listMondayBoards')
      setBoards(
        [...list].sort(
          (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name, 'ko'),
        ),
      )
    } catch (e) {
      setNotice({ tone: 'crit', text: `보드 목록을 읽지 못했어요: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const runPreview = async () => {
    if (!boardId) return
    setBusy('preview')
    setNotice(null)
    setPreview(null)
    try {
      setPreview(await call<BoardPreview>(`previewMondayBoard?boardId=${boardId}&samples=0`))
    } catch (e) {
      setNotice({ tone: 'crit', text: `보드를 읽지 못했어요: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(null)
    }
  }

  const runRegister = async () => {
    if (!preview) return
    setBusy('register')
    setNotice(null)
    try {
      const { board } = await call<{ board: CrmBoard }>('registerMondayBoard', postJson({ boardId: preview.boardId }))
      setNotice({
        tone: 'good',
        text: `"${board.name}" 보드를 등록하고 ${board.lastSync?.itemCount ?? 0}건을 받아 왔어요. 리드 매니저에 바로 반영돼요.`,
      })
      setPreview(null)
      setInput('')
    } catch (e) {
      setNotice({ tone: 'crit', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
      void load()
    }
  }

  const runRemove = async (board: CrmBoard) => {
    setBusy(`remove:${board.id}`)
    setNotice(null)
    try {
      const { deletedItemCount } = await call<{ deletedItemCount: number }>(
        'removeMondayBoard',
        postJson({ boardId: board.id }),
      )
      setNotice({
        tone: 'good',
        text: `"${board.name}" 보드 등록을 해제했어요. 저장해 둔 ${deletedItemCount}건은 리드 매니저에서 빠졌어요(Monday 보드는 그대로예요).`,
      })
    } catch (e) {
      setNotice({ tone: 'crit', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
      setConfirmRemove(null)
      void load()
    }
  }

  const registered = preview ? boards?.find((b) => b.id === preview.boardId) : undefined
  const phoneColumn = preview?.columns.find((c) => c.id === preview.phone.columnId)

  return (
    <GlassCard
      title="리드 매니저 보드"
      subtitle="리드 매니저(Monday 고객·통계·리드 분석)가 읽는 Monday 보드예요. 등록한 보드만 하루 여섯 번 동기화하고, 새로 등록하면 그 자리에서 한 번 받아 와요."
      actions={
        <>
          <input
            className="field__input crm-boards__input"
            aria-label="Monday 보드 id 또는 보드 주소"
            placeholder="보드 id 또는 보드 주소"
            inputMode="numeric"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setPreview(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runPreview()
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Eye}
            disabled={!boardId || busy !== null}
            onClick={() => void runPreview()}
          >
            {busy === 'preview' ? '읽는 중…' : '미리보기'}
          </Button>
          <Button size="sm" icon={Plus} disabled={!preview || busy !== null} onClick={() => void runRegister()}>
            {busy === 'register' ? '등록하는 중…(1~2분)' : registered ? '다시 동기화' : '등록'}
          </Button>
        </>
      }
    >
      {notice && (
        <p
          className={`member-form__result member-form__result--${notice.tone} admin-table-error`}
          role={notice.tone === 'crit' ? 'alert' : 'status'}
        >
          {notice.text}
        </p>
      )}

      {preview && (
        <dl className="crm-boards__preview" aria-label="미리보기">
          <div>
            <dt>보드</dt>
            <dd>
              {preview.name} <span className="table__muted">{preview.boardId}</span>
              {registered && <span className="table__muted"> · 이미 등록된 보드예요(등록하면 다시 받아 와요)</span>}
            </dd>
          </div>
          <div>
            <dt>항목</dt>
            <dd>{preview.itemCount.toLocaleString('ko-KR')}건</dd>
          </div>
          <div>
            <dt>휴대폰 칸</dt>
            <dd>
              {phoneColumn ? (
                <>
                  {phoneColumn.title}
                  {preview.phone.missingCount > 0 && (
                    <span className="table__muted"> · 번호 없는 항목 {preview.phone.missingCount}건</span>
                  )}
                </>
              ) : (
                <span className="crm-boards__warn">못 찾았어요 — 이 보드의 기록은 고객으로 묶이지 않아요</span>
              )}
            </dd>
          </div>
        </dl>
      )}

      <div className="crm-boards__list-head">
        <p className="phone-copy__hint">
          등록된 보드 {boards ? `${boards.length}개` : ''} · 해제하면 그 보드의 저장된 기록이 리드 매니저에서
          빠져요(Monday 보드는 그대로예요).
        </p>
        <Button variant="ghost" size="sm" icon={RefreshCw} disabled={busy !== null} onClick={() => void load()}>
          새로 읽기
        </Button>
      </div>
      <div className="table-wrap">
        <table className="table table--roomy">
          <thead>
            <tr>
              <th scope="col">보드</th>
              <th scope="col">종류</th>
              <th scope="col">항목</th>
              <th scope="col">마지막 동기화</th>
              <th scope="col">
                <span className="sr-only">해제</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {boards === null && (
              <tr>
                <td colSpan={5} className="table__empty">
                  불러오는 중…
                </td>
              </tr>
            )}
            {boards?.length === 0 && (
              <tr>
                <td colSpan={5} className="table__empty">
                  등록된 보드가 없어요.
                </td>
              </tr>
            )}
            {boards?.map((board) => {
              const removing = busy === `remove:${board.id}`
              return (
                <tr key={board.id}>
                  <td>
                    <p className="person__name">{board.name || board.id}</p>
                    <p className="person__sub">{board.id}</p>
                  </td>
                  <td className="table__muted">{KIND_LABEL[board.kind] ?? board.kind}</td>
                  <td className="table__muted">
                    {board.lastSync?.ok ? `${board.lastSync.itemCount.toLocaleString('ko-KR')}건` : '—'}
                    {board.lastSync?.ok && board.lastSync.missingPhoneCount > 0 && (
                      <p className="person__sub">번호 없음 {board.lastSync.missingPhoneCount}건</p>
                    )}
                  </td>
                  <td>
                    {board.lastSync ? (
                      <span className="sync-cell">
                        <StatusPill tone={board.lastSync.ok ? 'good' : 'crit'} dot>
                          {board.lastSync.ok ? '성공' : '실패'}
                        </StatusPill>
                        <span className="table__muted">{relativeTime(board.lastSync.at)}</span>
                        {board.lastSync.error && <span className="sync-cell__error">{board.lastSync.error}</span>}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="crm-boards__actions">
                    {confirmRemove === board.id ? (
                      <>
                        <Button
                          size="sm"
                          className="crm-boards__danger"
                          disabled={busy !== null}
                          onClick={() => void runRemove(board)}
                        >
                          {removing ? '해제하는 중…' : '정말 해제'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => setConfirmRemove(null)}
                        >
                          취소
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => setConfirmRemove(board.id)}
                      >
                        해제
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}
