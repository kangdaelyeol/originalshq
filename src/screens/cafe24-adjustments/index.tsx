import { Link } from 'react-router-dom'
import { useAdjustmentsViewModel } from './view-model/use-adjustments-view-model'
import './styles/index.scss'

const won = (value: number) => `${Math.abs(value).toLocaleString('ko-KR')}원`

/** 부호를 말로 풀어 쓴다 — "+/-"만으로는 환불이 늘어난 건지 매출이 늘어난
 * 건지 헷갈린다. */
const effectLabel = (amount: number) =>
  amount > 0 ? `환불 +${won(amount)}` : `환불 −${won(amount)}`

/**
 * Cafe24 환불 수동 보정 관리 페이지(/admin/cafe24).
 *
 * 카페24 API로는 잡히지 않는 환불 변동(취소 후 환불 없이 철회된 주문 등)을
 * 날짜·금액으로 직접 등록한다. 등록한 값은 CMIP 온라인 매출의 환불 금액과
 * 순매출에 반영된다.
 */
export default function Cafe24Adjustments() {
  const { state, actions } = useAdjustmentsViewModel()
  const {
    adjustments,
    loading,
    form,
    submitting,
    deletingId,
    error,
    canSubmit,
    previewAmount,
    netTotal,
  } = state
  const { updateForm, submit, remove } = actions

  return (
    <main className="cafe24-adjust">
      <header className="cafe24-adjust__header">
        <div>
          <h1>Cafe24 환불 수동 보정</h1>
        </div>
        <Link to="/cmip" className="cafe24-adjust__back">
          CMIP
        </Link>
      </header>

      <section className="cafe24-adjust__card">
        <h2>보정 등록</h2>
        <form className="cafe24-adjust__form" onSubmit={submit}>
          <label>
            날짜
            <input
              type="date"
              value={form.date}
              onChange={(e) => updateForm('date', e.target.value)}
              required
            />
          </label>

          <fieldset>
            <legend>방향</legend>
            <label className="cafe24-adjust__radio">
              <input
                type="radio"
                name="direction"
                checked={form.direction === 'decrease'}
                onChange={() => updateForm('direction', 'decrease')}
              />
              환불 차감 (순매출 증가)
            </label>
            <label className="cafe24-adjust__radio">
              <input
                type="radio"
                name="direction"
                checked={form.direction === 'increase'}
                onChange={() => updateForm('direction', 'increase')}
              />
              환불 추가 (순매출 감소)
            </label>
          </fieldset>

          <label>
            금액 (원)
            <input
              inputMode="numeric"
              placeholder="3990000"
              value={form.amount}
              onChange={(e) => updateForm('amount', e.target.value)}
              required
            />
          </label>

          <label>
            <span>
              주문번호 <small>선택</small>
            </span>
            <input
              placeholder="20260821-0000039"
              value={form.orderId}
              onChange={(e) => updateForm('orderId', e.target.value)}
            />
          </label>

          <label className="cafe24-adjust__wide">
            사유
            <input
              placeholder="예: 8/24 취소 처리 후 9/7 취소 철회 — 실제 환불 없음"
              value={form.memo}
              onChange={(e) => updateForm('memo', e.target.value)}
              required
            />
          </label>

          <div className="cafe24-adjust__actions">
            <p className="cafe24-adjust__preview">
              {previewAmount !== null && form.date
                ? `${form.date} · ${effectLabel(previewAmount)}`
                : '날짜와 금액을 입력하면 반영될 내용이 여기 표시됩니다.'}
            </p>
            <button type="submit" disabled={!canSubmit}>
              {submitting ? '등록 중…' : '등록'}
            </button>
          </div>
        </form>
        {error && (
          <p className="cafe24-adjust__error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="cafe24-adjust__card">
        <div className="cafe24-adjust__list-head">
          <h2>등록된 보정 ({adjustments.length})</h2>
          {adjustments.length > 0 && (
            <span>
              합계:{' '}
              {netTotal === 0
                ? '0원 (기간 합계 영향 없음)'
                : effectLabel(netTotal)}
            </span>
          )}
        </div>

        {loading ? (
          <p className="cafe24-adjust__empty">불러오는 중…</p>
        ) : adjustments.length === 0 ? (
          <p className="cafe24-adjust__empty">등록된 보정이 없습니다.</p>
        ) : (
          <div className="cafe24-adjust__table-wrap">
            <table className="cafe24-adjust__table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>반영 내용</th>
                  <th>주문번호</th>
                  <th>사유</th>
                  <th>등록일</th>
                  <th aria-label="삭제" />
                </tr>
              </thead>
              <tbody>
                {adjustments.map((item) => (
                  <tr key={item.id}>
                    <td className="is-mono">{item.date}</td>
                    <td
                      className={
                        item.amount > 0 ? 'is-increase' : 'is-decrease'
                      }
                    >
                      {effectLabel(item.amount)}
                    </td>
                    <td className="is-mono">{item.orderId || '-'}</td>
                    <td>{item.memo}</td>
                    <td className="is-muted">
                      {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cafe24-adjust__delete"
                        disabled={deletingId === item.id}
                        onClick={() => {
                          if (
                            window.confirm(
                              `${item.date} ${effectLabel(item.amount)} 보정을 삭제할까요?`,
                            )
                          )
                            remove(item.id)
                        }}
                      >
                        {deletingId === item.id ? '삭제 중…' : '삭제'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
