import '@/screens/parke/styles/list-area.scss'
import { useParkeContext } from '../context'
import { PARKE_URL } from '../constants'

interface RowProps {
  serial: string
}

const Row = ({ serial }: RowProps) => {
  return (
    <div className="row">
      <div className="row-main">
        <div className="row-serial">{serial}</div>
        <div className="row-url">{`${PARKE_URL}/${serial}`}</div>
      </div>
      <div className="row-actions">
        <button
          className="icon-btn dl"
          title="QR 다운로드"
          aria-label="QR 코드 다운로드"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button className="icon-btn del" title="삭제" aria-label="삭제">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export const ListArea = () => {
  const { serialList } = useParkeContext()
  return (
    <div id="listArea">
      <div className="list">
        {serialList.map((v) => (
          <Row serial={v} key={v} />
        ))}
      </div>
    </div>
  )
}
