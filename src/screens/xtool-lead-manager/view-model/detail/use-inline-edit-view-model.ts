import { useState } from 'react'

/*
 * 클릭하면 그 자리에서 고치는 정보 행(EditableInfoRow, EditableUserAgentRow)의
 * 편집 상태 — 편집 중인지와 입력 중인 값(draft)을 갖는다.
 *
 * 편집을 시작할 때마다 draft를 현재 저장값(rawValue)으로 다시 채운다. 저장
 * 후에는 서버가 정제한 값(전화번호 숫자만, 이메일 소문자 등)이 내려오므로,
 * 지난번에 입력했던 원본이 아니라 그 값에서 다시 시작해야 한다.
 */
export const useInlineEditViewModel = (
  rawValue: string,
  onSave: (value: string) => Promise<void>,
) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rawValue)

  return {
    state: { editing, draft },
    actions: {
      setDraft,
      start: () => {
        setDraft(rawValue)
        setEditing(true)
      },
      cancel: () => setEditing(false),
      save: async () => {
        await onSave(draft)
        setEditing(false)
      },
    },
  }
}
