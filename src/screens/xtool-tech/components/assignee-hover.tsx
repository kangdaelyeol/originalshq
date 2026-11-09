import { Avatar } from '@/ohq-ui/components/avatar'
import { useHoverCard } from '@/ohq-ui/lib/use-hover-card'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { usePhotoOf } from '../data/tech-profiles'
import { personColor } from '../lib/person-color'

/**
 * 담당자 칸에 마우스를 올리면 누가 맡았는지 이름(과 사진)을 작은 카드로 보여 준다 — 여러 명이면 칸에는 첫
 * 사람·"+N"만 보여서. 레이아웃(대시보드·Monday 표·물)마다 칸 모양은 달라도 카드는 같다. enabled가 false면
 * 열지 않는다(이름이 이미 다 보이는 칸).
 */
export function useAssigneeHover(names: readonly string[], enabled = true) {
  const photoOf = usePhotoOf()
  return useHoverCard(
    enabled && names.length > 0 ? (
      <>
        <span className="hover-card__title">담당자 {names.length}명</span>
        <ul className="hover-card__list">
          {names.map((name, i) => (
            <li key={`${name}-${i}`} className="hover-card__row">
              <Avatar size="xs" initials={initialsOf(name, name)} color={personColor(name)} photo={photoOf(name)} />
              <span>{name}</span>
            </li>
          ))}
        </ul>
      </>
    ) : null,
  )
}
