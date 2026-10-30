import { useState } from 'react'
import { Select } from '@/components/glass'
import type {
  ConversionGoal,
  Creative,
  CreativeFormat,
  CreativeSet,
  GoalKpi,
  SaveAdSettingsRequest,
} from '../../client'
import { CREATIVE_FORMAT_LABEL, KPI_LABEL } from './labels'

type Send = (request: SaveAdSettingsRequest, done: string) => Promise<boolean>

const KPI_OPTIONS = (Object.keys(KPI_LABEL) as GoalKpi[]).map((kpi) => ({
  value: kpi,
  label: KPI_LABEL[kpi],
}))
const FORMAT_OPTIONS = (
  Object.keys(CREATIVE_FORMAT_LABEL) as CreativeFormat[]
).map((format) => ({ value: format, label: CREATIVE_FORMAT_LABEL[format] }))

/** 전환 목표 한 줄 — 이름·판단 지표를 고치고 숨긴다(지우지 않는다: 이미 붙은
 * 기록이 있어서). */
const GoalRow = ({
  goal,
  saving,
  send,
}: {
  goal: ConversionGoal
  saving: boolean
  send: Send
}) => {
  const [label, setLabel] = useState(goal.label)
  const [kpi, setKpi] = useState<GoalKpi>(goal.kpi)
  const dirty = label.trim() !== goal.label || kpi !== goal.kpi
  const save = (archived: boolean) =>
    send(
      {
        action: 'saveGoal',
        key: goal.key,
        goal: { label: label.trim(), kpi, order: goal.order, archived },
      },
      archived
        ? `"${goal.label}" 목표를 숨겼습니다`
        : `"${label.trim()}" 목표를 저장했습니다`,
    )
  return (
    <li className={`ad-goal${goal.archived ? ' is-archived' : ''}`}>
      <input
        className="ad-input"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        aria-label="목표 이름"
      />
      <Select
        value={kpi}
        options={KPI_OPTIONS}
        onChange={setKpi}
        label="판단 지표"
      />
      <span className="ad-goal__key">{goal.key}</span>
      {dirty ? (
        <button
          type="button"
          className="ad-button is-small is-primary"
          disabled={saving || !label.trim()}
          onClick={() => save(goal.archived)}
        >
          저장
        </button>
      ) : (
        <button
          type="button"
          className="ad-button is-small"
          disabled={saving}
          onClick={() => save(!goal.archived)}
        >
          {goal.archived ? '다시 쓰기' : '숨기기'}
        </button>
      )}
    </li>
  )
}

const NewGoal = ({
  goals,
  saving,
  send,
}: {
  goals: readonly ConversionGoal[]
  saving: boolean
  send: Send
}) => {
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [kpi, setKpi] = useState<GoalKpi>('cpa')
  const validKey = /^[a-z][a-z0-9_]{0,31}$/.test(key)
  const taken = goals.some((g) => g.key === key)
  return (
    <li className="ad-goal is-new">
      <input
        className="ad-input"
        placeholder="새 목표 이름"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <Select
        value={kpi}
        options={KPI_OPTIONS}
        onChange={setKpi}
        label="판단 지표"
      />
      <input
        className="ad-input ad-goal__key-input"
        placeholder="영문 키(lead_form)"
        value={key}
        onChange={(e) => setKey(e.target.value.trim())}
        title="기록에 남는 이름 — 영문 소문자로 시작, a-z·0-9·_"
      />
      <button
        type="button"
        className="ad-button is-small is-primary"
        disabled={saving || !label.trim() || !validKey || taken}
        title={taken ? '이미 있는 키입니다' : undefined}
        onClick={async () => {
          const ok = await send(
            {
              action: 'saveGoal',
              key,
              goal: {
                label: label.trim(),
                kpi,
                order: Math.max(0, ...goals.map((g) => g.order)) + 10,
                archived: false,
              },
            },
            `"${label.trim()}" 목표를 추가했습니다`,
          )
          if (ok) {
            setKey('')
            setLabel('')
          }
        }}
      >
        추가
      </button>
    </li>
  )
}

const EMPTY_CREATIVE: Creative = {
  name: '',
  format: 'image',
  url: '',
  memo: '',
}

/** 소재 셋 하나 편집(새 셋이면 set이 null). */
const CreativeSetForm = ({
  set,
  saving,
  send,
  onDone,
}: {
  set: CreativeSet | null
  saving: boolean
  send: Send
  onDone: () => void
}) => {
  const [name, setName] = useState(set?.name ?? '')
  const [description, setDescription] = useState(set?.description ?? '')
  const [creatives, setCreatives] = useState<Creative[]>(
    set?.creatives.length ? set.creatives : [EMPTY_CREATIVE],
  )
  const update = (i: number, patch: Partial<Creative>) =>
    setCreatives((prev) =>
      prev.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    )
  const filled = creatives.filter((c) => c.name.trim())

  return (
    <div className="ad-set-form">
      <input
        className="ad-input"
        placeholder="셋 이름(예: F2 가을 영상 A/B)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="ad-input"
        placeholder="설명(선택)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <ul className="ad-set-form__creatives">
        {creatives.map((creative, i) => (
          <li key={i}>
            <input
              className="ad-input"
              placeholder={`소재 ${i + 1} 이름`}
              value={creative.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <Select
              value={creative.format}
              options={FORMAT_OPTIONS}
              onChange={(format) => update(i, { format })}
              label="형식"
            />
            <input
              className="ad-input"
              placeholder="링크(선택)"
              value={creative.url}
              onChange={(e) => update(i, { url: e.target.value })}
            />
            <button
              type="button"
              className="ad-button is-small"
              aria-label="소재 빼기"
              onClick={() =>
                setCreatives((prev) =>
                  prev.length > 1 ? prev.filter((_, j) => j !== i) : prev,
                )
              }
            >
              빼기
            </button>
          </li>
        ))}
      </ul>
      <div className="ad-set-form__actions">
        <button
          type="button"
          className="ad-button is-small"
          onClick={() => setCreatives((prev) => [...prev, EMPTY_CREATIVE])}
        >
          소재 추가
        </button>
        <span className="ad-set-form__note">
          {set &&
            '이미 설정에 붙은 셋의 소재를 바꾸면 지난 구간 기록도 바뀐 것처럼 보입니다 — 소재가 바뀌면 새 셋을 만드세요.'}
        </span>
        <button type="button" className="ad-button is-small" onClick={onDone}>
          취소
        </button>
        <button
          type="button"
          className="ad-button is-small is-primary"
          disabled={saving || !name.trim()}
          onClick={async () => {
            const ok = await send(
              {
                action: 'saveCreativeSet',
                id: set?.id ?? null,
                set: {
                  name: name.trim(),
                  description: description.trim(),
                  creatives: filled.map((c) => ({
                    ...c,
                    name: c.name.trim(),
                    url: c.url.trim(),
                  })),
                },
              },
              `"${name.trim()}" 소재 셋을 저장했습니다`,
            )
            if (ok) onDone()
          }}
        >
          저장
        </button>
      </div>
    </div>
  )
}

/** 전환 목표·소재 셋 관리 — 설정에서 고르는 목록 자체를 고친다. */
export function CatalogManager({
  goals,
  creativeSets,
  saving,
  send,
}: {
  goals: readonly ConversionGoal[]
  creativeSets: readonly CreativeSet[]
  saving: boolean
  send: Send
}) {
  // 펴서 고치는 소재 셋(new면 새로 만들기).
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <div className="ad-catalog">
      <section className="ad-catalog__card">
        <h4>전환 목표</h4>
        <p className="ad-catalog__desc">
          판단 지표 — 같은 목표의 광고셋끼리 이 지표로 비교합니다.
        </p>
        <ul className="ad-goal-list">
          {goals.map((goal) => (
            // 저장 뒤 서버 값으로 다시 시작하게(updatedAt).
            <GoalRow
              key={`${goal.key}:${goal.updatedAt}`}
              goal={goal}
              saving={saving}
              send={send}
            />
          ))}
          <NewGoal goals={goals} saving={saving} send={send} />
        </ul>
      </section>

      <section className="ad-catalog__card">
        <h4>소재 셋</h4>
        <p className="ad-catalog__desc">
          여러 광고셋이 같이 쓰는 소재 묶음 — 설정에서 골라 붙입니다.
        </p>
        <ul className="ad-set-list">
          {creativeSets.map((set) =>
            editing === set.id ? (
              <li key={set.id}>
                <CreativeSetForm
                  set={set}
                  saving={saving}
                  send={send}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={set.id} className="ad-set">
                <div className="ad-set__text">
                  <strong>{set.name}</strong>
                  <span>
                    {set.creatives
                      .map(
                        (c) => `${c.name}(${CREATIVE_FORMAT_LABEL[c.format]})`,
                      )
                      .join(' · ') || '소재 없음'}
                  </span>
                </div>
                <button
                  type="button"
                  className="ad-button is-small"
                  onClick={() => setEditing(set.id)}
                >
                  고치기
                </button>
                {confirmDelete === set.id ? (
                  <button
                    type="button"
                    className="ad-button is-small is-danger"
                    disabled={saving}
                    onClick={async () => {
                      setConfirmDelete(null)
                      await send(
                        { action: 'deleteCreativeSet', id: set.id },
                        `"${set.name}" 소재 셋을 지웠습니다`,
                      )
                    }}
                  >
                    정말 지우기
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ad-button is-small"
                    onClick={() => setConfirmDelete(set.id)}
                  >
                    지우기
                  </button>
                )}
              </li>
            ),
          )}
          {editing === 'new' ? (
            <li>
              <CreativeSetForm
                set={null}
                saving={saving}
                send={send}
                onDone={() => setEditing(null)}
              />
            </li>
          ) : (
            <li>
              <button
                type="button"
                className="ad-button is-small"
                onClick={() => setEditing('new')}
              >
                새 소재 셋
              </button>
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}
