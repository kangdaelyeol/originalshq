import { Check, Copy, KeyRound, X } from 'lucide-react'
import { useState } from 'react'
import { xtPath } from '@/screens/xtool-tech/paths'

// 복사됨 표시를 보여 주는 시간
const COPIED_MS = 1800

/**
 * 방금 발급한 아이디·임시 비밀번호 — 이 화면을 떠나면 다시 볼 수 없어서(비밀번호는 어디에도 남기지
 * 않는다) 직원에게 보낼 문구째 복사해 둘 수 있게 한다.
 */
export function CredentialNote({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const loginUrl = `${window.location.origin}${xtPath('/login')}`
  const copy = () => {
    const text = `xtool 기술팀 보드 계정\n접속: ${loginUrl}\n아이디: ${email}\n임시 비밀번호: ${password}\n처음 로그인하면 쓸 비밀번호를 새로 정해 주세요.`
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_MS)
    })
  }
  return (
    <div className="credential-note" role="status">
      <KeyRound size={16} className="credential-note__icon" aria-hidden />
      <dl className="credential-note__list">
        <div>
          <dt>아이디</dt>
          <dd>{email}</dd>
        </div>
        <div>
          <dt>임시 비밀번호</dt>
          <dd className="credential-note__password">{password}</dd>
        </div>
      </dl>
      <p className="credential-note__hint">이 비밀번호는 지금만 보여요. 직원에게 전달하면 첫 로그인 때 새 비밀번호로 바꿔요.</p>
      <div className="credential-note__actions">
        <button type="button" className="credential-note__copy" onClick={copy}>
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? '복사했어요' : '안내 문구 복사'}
        </button>
        <button type="button" className="credential-note__close" aria-label="닫기" onClick={onClose}>
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}
