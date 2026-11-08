import { Component, type ErrorInfo, type ReactNode } from 'react'

/** 탭 내용을 그리다 오류가 나면 — 화면 전체가 흰 화면이 되지 않게 그 탭 자리에만 안내와 '다시 그리기'를 둔다.
 * resetKey(기간 등)가 바뀌면 다시 그려 본다. */
export class TabErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('탭을 그리다 오류가 났습니다:', error, info.componentStack)
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <section className="channel-insight__section">
        <p className="channel-insight__result-empty">
          이 보기를 그리다 오류가 났습니다 — {error.message}{' '}
          <button
            type="button"
            className="channel-insight__btn channel-insight__ghost"
            onClick={() => this.setState({ error: null })}
          >
            다시 그리기
          </button>
        </p>
      </section>
    )
  }
}
