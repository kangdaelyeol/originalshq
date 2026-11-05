import { formatPhone, stageLabel, stageTone } from '@xtool-core/tech-stage'
import { StatusPill } from '@/ohq-ui/components/status-pill'

/** 진행 단계 배지 — 완료(초록) · 멈춤(빨강) · 신규(파랑) · 그 밖의 진행 중(노랑). */
export function StagePill({ stage, status }: { stage: string | null; status: string | null }) {
  return (
    <StatusPill tone={stageTone({ stage, status })} dot>
      {stageLabel(stage)}
    </StatusPill>
  )
}

/** 담당자 — 첫 사람 이름 + 나머지 수(전체 이름은 title로). */
export function Assignees({ names }: { names: readonly string[] }) {
  if (names.length === 0) return <span className="table__muted">—</span>
  return (
    <span className="assignees" title={names.join(', ')}>
      {names[0]}
      {names.length > 1 && <span className="assignees__more">+{names.length - 1}</span>}
    </span>
  )
}

/** 전화 걸기 링크(010-1234-5678) — 번호가 없으면 아무것도 안 그린다. */
export function PhoneLink({ phone }: { phone: string | null }) {
  const formatted = formatPhone(phone)
  return formatted ? <a href={`tel:${phone}`}>{formatted}</a> : null
}
