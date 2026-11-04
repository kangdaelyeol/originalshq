import { useState } from 'react'
import type { TechMondayUser } from '../../../data/tech-boards'
import { useWaterLayout } from '../../../water-layout/load'
import { ChipPicker } from './chip-picker'

/**
 * Monday 사람 칸 고르기(담당자가 아닌 칸 — 담당자는 우리 명단에서 고르는 AssigneePicker) — Monday 사용자
 * 목록(techMeta/mondayUsers) + 처음 열 때 이미 지정돼 있던 사람. 목록 밖 사람(비활성 등)도 처음 본
 * 것을 기억해 두어, 해제해도 사라지지 않고 다시 켤 수 있다.
 */
export function PeoplePicker({
  id,
  selected,
  onChange,
  users,
  currentText,
}: {
  id: string
  selected: string[]
  onChange: (value: string[]) => void
  users: TechMondayUser[] | null
  currentText: string
}) {
  // 처음 열 때 지정돼 있던 사람 — 이름은 Monday 화면 글자에서 빌려 온다(적힌 순서가 같다).
  const [remembered] = useState(() => {
    const names = currentText.split(', ')
    return selected.map((uid, i) => ({ value: uid, label: names[i] ?? `#${uid}` }))
  })
  const fromUsers = (users ?? []).map((u) => ({ value: u.id, label: u.name }))
  const known = new Set(fromUsers.map((o) => o.value))
  const options = [...remembered.filter((o) => !known.has(o.value)), ...fromUsers]
  const Chips = useWaterLayout()?.WaterChipPicker ?? ChipPicker
  return (
    <Chips
      id={id}
      options={options}
      selected={selected}
      onChange={onChange}
      searchable
      empty={users === null ? '사람 목록을 불러오는 중…' : '고를 수 있는 사람이 없어요'}
    />
  )
}
