import '@/screens/parke/styles/pagination-bar.scss'
import { useState } from 'react'

interface PageButtonProps {
  index: number
  nowIndex: number
  changePage: (_: number) => void
}

const PageButton = ({ index, nowIndex, changePage }: PageButtonProps) => {
  const focused = index === nowIndex
  return (
    <button
      aria-label={`go to ${index} page`}
      onClick={() => changePage(index)}
      className={['pagenation-dot', focused && 'focused']
        .filter(Boolean)
        .join(' ')}
    >
      {index + 1}
    </button>
  )
}

const serialCnt = 201 // temp

const BUTTONS_PER_ROW = 10
const ITEM_PER_PAGE = 20

export const PaginationBar = () => {
  const [page, setPage] = useState(0)
  const [pageRow, setPageRow] = useState(0)

  const changePage = (index: number) => setPage(index)

  const handlePrevRowClick = () => {
    if (pageRow <= 0) return
    setPageRow((prev) => prev - 1)
    setPage(pageRow * BUTTONS_PER_ROW - 1)
  }

  const handleNextRowClick = () => {
    if (pageRow >= maxPageRow) return
    setPageRow((prev) => prev + 1)
    setPage((pageRow + 1) * BUTTONS_PER_ROW)
  }

  const maxPageRow = Math.floor(
    (serialCnt - 1) / (BUTTONS_PER_ROW * ITEM_PER_PAGE),
  )

  const nowPageCount =
    pageRow < maxPageRow
      ? BUTTONS_PER_ROW
      : Math.floor(
          ((serialCnt - 1) % (BUTTONS_PER_ROW * ITEM_PER_PAGE)) / ITEM_PER_PAGE,
        ) + 1

  const pageIndexArr = new Array(nowPageCount)
    .fill(0)
    .map((_, i) => pageRow * 10 + i)

  return (
    <div className="parke-pagination">
      <div className="pagination-row">
        {pageRow !== 0 && (
          <button
            aria-label="go to prev page row"
            onClick={handlePrevRowClick}
            className="row-btn left"
          >
            prev
          </button>
        )}
        {pageRow < maxPageRow && (
          <button
            aria-label="go to next page row"
            onClick={handleNextRowClick}
            className="row-btn right"
          >
            next
          </button>
        )}

        {pageIndexArr.map((i) => (
          <PageButton
            nowIndex={page}
            index={i}
            changePage={changePage}
            key={i}
          />
        ))}
      </div>
    </div>
  )
}
