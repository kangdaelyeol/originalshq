import { Camera, LoaderCircle, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { Avatar, Button, GlassCard } from '../../components/layout-parts'
import { useCurrentMember } from '../../context/member-context'
import { deleteProfilePhoto, PROFILE_ACCEPT, uploadProfilePhoto, useProfilePhoto } from '../../data/tech-profiles'
import { pushToast } from '../../data/tech-save-queue'
import { errorText } from '../../lib/error-text'

/** 내 프로필 사진 — 올리면 담당자 동그라미·팀 현황·사이드바에 이 사진이 보인다. */
export function ProfilePhotoCard() {
  const member = useCurrentMember()
  const photo = useProfilePhoto(member?.email)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  if (!member) return null

  const run = (task: Promise<void>, done: string, failed: string) => {
    setBusy(true)
    task
      .then(() => pushToast({ tone: 'success', title: done }))
      .catch((error: unknown) => pushToast({ tone: 'error', title: failed, message: errorText(error) }))
      .finally(() => setBusy(false))
  }

  const upload = (file: File | undefined) => {
    if (input.current) input.current.value = ''
    if (file) run(uploadProfilePhoto(file, member), '프로필 사진을 바꿨어요', '사진을 올리지 못했어요')
  }

  return (
    <GlassCard title="프로필 사진" subtitle="담당자 칸·팀 현황·사이드바에 이름 대신 보이는 사진이에요. 팀 모두가 봐요.">
      <div className="profile-photo">
        <Avatar
          initials={initialsOf(member.name, member.email)}
          color="var(--accent)"
          ink="var(--accent-ink)"
          photo={photo}
          className="profile-photo__avatar"
        />
        <div className="profile-photo__meta">
          <strong>{member.name || member.email}</strong>
          <span>{member.email}</span>
        </div>
        <div className="profile-photo__actions">
          <Button icon={busy ? LoaderCircle : Camera} disabled={busy} onClick={() => input.current?.click()}>
            {photo ? '사진 바꾸기' : '사진 올리기'}
          </Button>
          {photo && (
            <Button
              variant="ghost"
              icon={Trash2}
              disabled={busy}
              onClick={() => run(deleteProfilePhoto(member.email), '프로필 사진을 지웠어요', '사진을 지우지 못했어요')}
            >
              지우기
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={PROFILE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </div>
    </GlassCard>
  )
}
