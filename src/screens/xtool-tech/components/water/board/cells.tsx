import { formatPhone, stageLabel, stageTone } from '@xtool-core/tech-stage'
import { usePhotoOf } from '../../../data/tech-profiles'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { WaterAvatar, WaterStatusPill } from '@/ohq-ui/water/controls'
import { personColor } from './edit-utils'
import { useAssigneeHover } from '../../assignee-hover'

/**
 * 진행 단계 칩(물) — 기본 부품 WaterStatusPill(반투명 흰 칩 + 상태 점). 점 색은 기존 StagePill과 같은
 * 규칙(stageTone): 완료 초록 · 멈춤 빨강 · 신규 파랑 · 그 밖의 진행 중 노랑.
 */
export function WaterStagePill({
  stage,
  status,
}: {
  stage: string | null
  status: string | null
}) {
  return (
    <WaterStatusPill tone={stageTone({ stage, status })} dot>
      {stageLabel(stage)}
    </WaterStatusPill>
  )
}

interface WaterAssigneesProps {
  names: readonly string[]
  /** 동그라미로 보일 사람 수 — 나머지는 "+N"(물 판만) */
  max?: number
}

/**
 * 담당자 — 기본 부품 WaterAvatar(사람 색이 물든 작은 유리 구슬, 이름 두 글자 · 프로필 사진)를 겹쳐 늘어놓고
 * 남은 수를 붙인다. 색은 이름으로 늘 같게 고른다. 칸에는 구슬만 보여서 마우스를 올리면 이름 카드를 띄운다
 * (assignee-hover). 화면 읽기용 글자도 둔다.
 */
export function WaterAssignees({ names, max = 3 }: WaterAssigneesProps) {
  const photoOf = usePhotoOf()
  const hover = useAssigneeHover(names)
  if (names.length === 0)
    return <span className="water-assignees water-assignees--empty">—</span>
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return (
    <span className="water-assignees" {...hover.anchorProps}>
      <span className="water-assignees__stack" aria-hidden>
        {shown.map((name) => (
          <WaterAvatar
            key={name}
            size="xs"
            initials={initialsOf(name, name)}
            color={personColor(name)}
            photo={photoOf(name)}
          />
        ))}
      </span>
      {rest > 0 && (
        <span className="water-assignees__more" aria-hidden>
          +{rest}
        </span>
      )}
      <span className="sr-only">{names.join(', ')}</span>
      {hover.card}
    </span>
  )
}

/** 전화 걸기 링크(010-1234-5678) — 번호가 없으면 아무것도 안 그린다. */
export function WaterPhoneLink({ phone }: { phone: string | null }) {
  const formatted = formatPhone(phone)
  return formatted ? (
    <a className="water-phone" href={`tel:${phone}`}>
      {formatted}
    </a>
  ) : null
}
