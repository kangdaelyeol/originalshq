import { useState } from 'react'
import { useTechMembers } from '../../../data/tech-members'
import { useWaterLayout } from '../../../water-layout/load'
import { ChipPicker } from './chip-picker'

/**
 * 담당자(엑스툴) 고르기 — 관리자 화면에 등록한 기술팀원 이름에서(Monday 계정과 상관없다). 값은 이름을
 * ", "로 이은 글자. 처음 적혀 있던 이름(예전 담당자)도 명단에 없어도 남겨 둔다.
 */
export function AssigneePicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const members = useTechMembers()
  const selected = value.split(', ').map((s) => s.trim()).filter(Boolean)
  const [remembered] = useState(selected)
  const team = (members ?? []).map((m) => m.name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'))
  const options = [...new Set([...remembered, ...team])].map((name) => ({ value: name, label: name }))
  const Chips = useWaterLayout()?.WaterChipPicker ?? ChipPicker
  return (
    <Chips
      id={id}
      options={options}
      selected={selected}
      onChange={(names) => onChange(names.join(', '))}
      searchable
      empty={members === null ? '기술팀 명단을 불러오는 중…' : '고를 사람이 없어요'}
    />
  )
}
