import '@/screens/parke/styles/pagination-bar.scss'
import { PAGE_BUTTONS_PER_ROW } from '@/screens/parke/constants'
import { useParkeContext } from '@/screens/parke/context'

interface PageButtonProps {
  index: number
  nowIndex: number
  changePage: (_: number) => void
}

const PageButton = ({ index, nowIndex, changePage }: PageButtonProps) => {
  const focused = index === nowIndex
  return (
    <button
      aria-label={`${index + 1}쪽으로 이동`}
      aria-current={focused ? 'page' : undefined}
      onClick={() => changePage(index)}
      className={['pagination-dot', focused && 'focused']
        .filter(Boolean)
        .join(' ')}
    >
      {index + 1}
    </button>
  )
}

/** 시리얼 목록의 쪽 번호 — 목록과 같은 context의 page를 본다. 한 줄에
 * PAGE_BUTTONS_PER_ROW개씩 보여주고, 넘으면 prev/next로 앞뒤 묶음으로 간다.
 * 한 쪽뿐이면 그리지 않는다. */
export const PaginationBar = () => {
  const { page, pageCount, setPage } = useParkeContext()

  if (pageCount <= 1) return null

  // 지금 쪽이 들어 있는 묶음의 첫 쪽과 그 묶음의 쪽 번호들.
  const rowStart =
    Math.floor(page / PAGE_BUTTONS_PER_ROW) * PAGE_BUTTONS_PER_ROW
  const rowEnd = Math.min(rowStart + PAGE_BUTTONS_PER_ROW, pageCount)
  const pageIndexArr = Array.from(
    { length: rowEnd - rowStart },
    (_, i) => rowStart + i,
  )

  return (
    <nav className="parke-pagination" aria-label="시리얼 목록 쪽">
      <div className="pagination-row">
        {rowStart > 0 && (
          <button
            aria-label="이전 쪽 묶음"
            // 앞 묶음의 마지막 쪽으로.
            onClick={() => setPage(rowStart - 1)}
            className="row-btn left"
          >
            prev
          </button>
        )}
        {rowEnd < pageCount && (
          <button
            aria-label="다음 쪽 묶음"
            // 뒤 묶음의 첫 쪽으로.
            onClick={() => setPage(rowEnd)}
            className="row-btn right"
          >
            next
          </button>
        )}

        {pageIndexArr.map((i) => (
          <PageButton nowIndex={page} index={i} changePage={setPage} key={i} />
        ))}
      </div>
    </nav>
  )
}
