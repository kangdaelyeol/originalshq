import type { MondayMissingPhoneItem } from '@/screens/xtool-lead-manager/entity'
import { formatMondayDate } from '@/screens/xtool-lead-manager/utils'
import { CloseIcon } from '../detail/icons'
import '@/screens/xtool-lead-manager/styles/detail.scss'

/**
 * 번호 확인이 필요한 기록 — 전화번호 칸이 비었거나 번호로 볼 수 없어서
 * (자릿수 오타 등) 어느 고객에도 묶이지 못한 Monday 기록들. 여기서는 고칠
 * 수 없고, 각 줄의 링크로 Monday에 가서 번호를 고치면 다음 동기화 때
 * 고객 목록에 들어온다.
 */
export const MondayMissingPanel = ({
  items,
  onClose,
}: {
  items: MondayMissingPhoneItem[]
  onClose: () => void
}) => {
  // 보드별로 모아서 보여준다 — 고치는 사람은 보드 단위로 작업한다.
  const sorted = [...items].sort(
    (a, b) =>
      a.boardName.localeCompare(b.boardName) || a.name.localeCompare(b.name),
  )

  return (
    <div className="lead_manager_detail_modal" onClick={onClose}>
      <div
        className="detail_form monday_detail monday_missing"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="header">
          <div className="header_title">
            <span className="customer_name">번호 확인 필요</span>
            <span className="monday_phone">{items.length}건</span>
          </div>
          <button className="close_btn" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <div className="body">
          <p className="monday_detail_message">
            전화번호가 비었거나 형식이 맞지 않아 고객 목록에서 빠진 기록입니다.
            Monday에서 번호를 고치면 다음 동기화(매일 07시·19시) 때 반영됩니다.
          </p>
          <table className="monday_missing_table">
            <thead>
              <tr>
                <th>보드</th>
                <th>이름</th>
                <th>적힌 값</th>
                <th>최근 수정</th>
                <th aria-label="Monday 링크" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr key={item.id}>
                  <td>{item.boardName}</td>
                  <td>{item.name || '-'}</td>
                  <td className="raw">{item.phoneRaw || '(비어 있음)'}</td>
                  <td>{formatMondayDate(item.updatedAt)}</td>
                  <td>
                    {item.url && (
                      <a
                        className="monday_link"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        열기
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
