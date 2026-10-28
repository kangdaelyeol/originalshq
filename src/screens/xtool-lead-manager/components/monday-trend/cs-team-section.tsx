import { useRef, useState } from 'react'
import { useModal } from '@/screens/xtool-lead-manager/hooks/use-modal'
import type { useCsTeamViewModel } from '@/screens/xtool-lead-manager/view-model'
import type { CsMemberStats } from '@/screens/xtool-lead-manager/utils'

type CsTeam = ReturnType<typeof useCsTeamViewModel>

const count = (value: number) => `${value.toLocaleString('ko-KR')}건`
const rate = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '-'

type MetricKey = 'intake' | 'paid' | 'visit'

const METRICS: {
  key: MetricKey
  title: string
  desc: string
}[] = [
  {
    key: 'intake',
    title: '인입 처리 수',
    desc: '기간에 접수된 상담 중 담당한 건수',
  },
  {
    key: 'paid',
    title: '구매 전환 수',
    desc: '상담 중 결제된 건수 · 전환율',
  },
  {
    key: 'visit',
    title: '방문체험 전환 수',
    desc: '상담 중 방문체험이 확정된 건수 · 전환율',
  },
]

/** 지표 하나(카드 하나) — 담당자를 그 지표가 큰 순으로, 막대와 숫자로. */
const MetricCard = ({
  metric,
  members,
  total,
  allIntake,
}: {
  metric: (typeof METRICS)[number]
  members: CsMemberStats[]
  total: CsMemberStats
  allIntake: number
}) => {
  const rows = [...members].sort(
    (a, b) =>
      b[metric.key] - a[metric.key] || a.name.localeCompare(b.name, 'ko'),
  )
  const max = Math.max(1, ...rows.map((each) => each[metric.key]))
  const isRate = metric.key !== 'intake'

  return (
    <section className="stats_card cs_metric">
      <h2>{metric.title}</h2>
      <p className="stats_desc">{metric.desc}</p>
      <div className="cs_metric_total">
        <strong>{count(total[metric.key])}</strong>
        <span>
          {isRate
            ? `CS팀 전환율 ${rate(total[metric.key], total.intake)}`
            : `전체 상담 ${count(allIntake)} 중 ${rate(total.intake, allIntake)}`}
        </span>
      </div>
      <ul className="cs_metric_rows">
        {rows.map((each) => (
          <li key={each.name}>
            <span className="cs_metric_name">{each.name}</span>
            <span className="cs_metric_bar" aria-hidden="true">
              <span style={{ width: `${(each[metric.key] / max) * 100}%` }} />
            </span>
            <span className="cs_metric_value">
              {count(each[metric.key])}
              {isRate && <small>{rate(each[metric.key], each.intake)}</small>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** CS팀 명단 편집 — 상담 담당자로 나온 이름을 눌러 넣고 뺀다. */
const MemberEditor = ({
  members,
  candidates,
  onSave,
  onClose,
}: {
  members: string[]
  candidates: { name: string; count: number }[]
  onSave: (members: string[]) => void
  onClose: () => void
}) => {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(members),
  )
  const closeRef = useRef<HTMLButtonElement>(null)
  useModal(onClose, closeRef)

  // 명단에는 있는데 최근 상담 담당자에는 없는 이름(퇴사 등)도 뺄 수 있게 보여준다.
  const options = [
    ...candidates,
    ...members
      .filter((name) => !candidates.some((each) => each.name === name))
      .map((name) => ({ name, count: 0 })),
  ]
  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  return (
    <div className="cs_editor_backdrop" onClick={onClose}>
      <div
        className="cs_editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cs-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cs_editor_head">
          <h2 id="cs-editor-title">CS팀 명단</h2>
          <button
            ref={closeRef}
            type="button"
            className="cs_editor_close"
            aria-label="닫기"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="stats_desc">
          상담 보드의 담당자 중 볼 사람을 골라 주세요. 이 브라우저에만 저장돼서
          사람마다 따로 고를 수 있습니다. 숫자는 지금까지 맡은 상담 수입니다.
        </p>
        <div className="cs_editor_options" role="group" aria-label="담당자">
          {options.map(({ name, count: total }) => (
            <button
              key={name}
              type="button"
              aria-pressed={selected.has(name)}
              className={selected.has(name) ? 'is-selected' : ''}
              onClick={() => toggle(name)}
            >
              {name}
              <small>{total.toLocaleString('ko-KR')}</small>
            </button>
          ))}
        </div>
        <div className="cs_editor_actions">
          <span>{selected.size}명 선택</span>
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="is-primary"
            // 후보 순서(많이 맡은 순)대로 저장한다.
            onClick={() =>
              onSave(
                options
                  .map((each) => each.name)
                  .filter((name) => selected.has(name)),
              )
            }
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

/** 인입통계 맨 아래 — CS팀 담당자별 인입 처리·구매 전환·방문체험 전환. 기간은
 * 위 인입통계와 같다. */
export const CsTeamSection = ({ csTeam }: { csTeam: CsTeam }) => {
  const { state, actions } = csTeam
  const { members, stats, candidates, editing } = state

  return (
    <div className="cs_team">
      <div className="cs_team_head">
        <div>
          <h2>CS팀 인입 성과</h2>
          <p className="stats_desc">
            위와 같은 기간에 접수된 상담 기준(오기입 제외) · 결제·방문체험
            확정은 지금까지 된 것까지 센다
          </p>
        </div>
        <button
          type="button"
          className="cs_team_edit"
          onClick={actions.openEditor}
        >
          명단 설정{members.length > 0 && ` (${members.length}명)`}
        </button>
      </div>

      {members.length === 0 && (
        <div className="stats_card cs_team_empty">
          아직 CS팀 명단이 없습니다.{' '}
          <button
            type="button"
            className="cs_team_link"
            onClick={actions.openEditor}
          >
            명단 설정
          </button>
          에서 인입 담당자를 골라 주세요.
        </div>
      )}
      {members.length > 0 && (
        <div className="cs_team_row">
          {METRICS.map((metric) => (
            <MetricCard
              key={metric.key}
              metric={metric}
              members={stats.members}
              total={stats.total}
              allIntake={stats.allIntake}
            />
          ))}
        </div>
      )}

      {editing && (
        <MemberEditor
          members={members}
          candidates={candidates}
          onSave={actions.save}
          onClose={actions.closeEditor}
        />
      )}
    </div>
  )
}
