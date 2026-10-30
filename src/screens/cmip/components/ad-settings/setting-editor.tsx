import { useState, type ReactNode } from 'react'
import { Segmented, Select } from '@/components/glass'
import {
  adEntityKey,
  settingAt,
  versionAt,
  versionStatus,
  EMPTY_AD_SETTING,
  type AdEntity,
  type AdEntityKey,
  type AdSettingFields,
  type AdSettingVersion,
  type AdSettingVersionInput,
  type BudgetPeriod,
  type ConversionGoal,
  type CreativeSet,
  type FunnelStage,
  type SaveAdSettingsRequest,
} from '../../client'
import { addDays } from '../../utils'
import { ChannelTile } from '../channel-insight/channel-label'
import {
  BUDGET_PERIOD_LABEL,
  FUNNEL_LABEL,
  KPI_LABEL,
  formatBudget,
  shortDate,
  won,
} from './labels'

type Funnel = FunnelStage | 'none'

/** 입력 중인 값 — 숫자 칸도 글자로 들고 있다가 저장할 때 바꾼다. */
interface Form {
  effectiveFrom: string
  conversionGoal: string
  budgetAmount: string
  budgetPeriod: BudgetPeriod
  creativeSetId: string
  targetCpa: string
  targetRoas: string
  funnelStage: Funnel
  audience: string
  landingUrl: string
  memo: string
}

const formOf = (fields: AdSettingFields, effectiveFrom: string): Form => ({
  effectiveFrom,
  conversionGoal: fields.conversionGoal ?? '',
  budgetAmount: fields.budget ? String(fields.budget.amount) : '',
  budgetPeriod: fields.budget?.period ?? 'daily',
  creativeSetId: fields.creativeSetId ?? '',
  targetCpa: fields.targetCpa === null ? '' : String(fields.targetCpa),
  targetRoas: fields.targetRoas === null ? '' : String(fields.targetRoas),
  funnelStage: fields.funnelStage ?? 'none',
  audience: fields.audience,
  landingUrl: fields.landingUrl,
  // 바꾼 이유는 장마다 새로 쓴다.
  memo: '',
})

const numberOrNull = (text: string): number | null => {
  const n = Number(text.replace(/,/g, ''))
  return text.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n
}

const FUNNEL_OPTIONS: Record<Funnel, string> = { none: '없음', ...FUNNEL_LABEL }
const STATUS_LABEL = {
  scheduled: '예약',
  current: '적용 중',
  past: '지난 설정',
}

const Field = ({
  label,
  hint,
  children,
  wide = false,
}: {
  label: string
  /** 비워 두면 따르는 값(캠페인 설정) 등. */
  hint?: string | null
  children: ReactNode
  wide?: boolean
}) => (
  <label className={`ad-field${wide ? ' is-wide' : ''}`}>
    <span className="ad-field__label">{label}</span>
    {children}
    {hint && <span className="ad-field__hint">{hint}</span>}
  </label>
)

/** 설정 한 장의 요약 배지들. */
const Summary = ({
  fields,
  goals,
  sets,
}: {
  fields: AdSettingFields
  goals: ReadonlyMap<string, ConversionGoal>
  sets: ReadonlyMap<string, CreativeSet>
}) => {
  const chips = [
    fields.conversionGoal &&
      `목표 ${goals.get(fields.conversionGoal)?.label ?? fields.conversionGoal}`,
    fields.budget && formatBudget(fields.budget),
    fields.creativeSetId &&
      `소재 ${sets.get(fields.creativeSetId)?.name ?? '(지운 셋)'}`,
    fields.targetCpa !== null && `목표 단가 ${won(fields.targetCpa)}`,
    fields.targetRoas !== null && `목표 ROAS ${fields.targetRoas}%`,
    fields.funnelStage && `퍼널 ${FUNNEL_LABEL[fields.funnelStage]}`,
  ].filter(Boolean) as string[]
  return chips.length ? (
    <span className="ad-history__chips">
      {chips.map((chip) => (
        <span key={chip} className="ad-badge">
          {chip}
        </span>
      ))}
    </span>
  ) : (
    <span className="ad-history__chips">
      <span className="ad-badge is-inherited">정한 값 없음</span>
    </span>
  )
}

/**
 * 고른 캠페인·광고셋의 설정 — 위는 새 장(적용 시작일 + 칸들), 아래는 지금까지
 * 쌓인 장. 처음엔 오늘 적용 중인 장의 값이 채워져 있어 바꿀 칸만 고치면 된다.
 * 시작일을 앞날로 고르면 예약, 이미 있는 날짜면 그 장을 고친다.
 */
export function SettingEditor({
  entity,
  campaign,
  byEntity,
  goals,
  creativeSets,
  today,
  saving,
  send,
}: {
  entity: AdEntity
  /** 광고셋이면 소속 캠페인(목록에 있으면). */
  campaign: AdEntity | null
  byEntity: ReadonlyMap<AdEntityKey, AdSettingVersion[]>
  goals: readonly ConversionGoal[]
  creativeSets: readonly CreativeSet[]
  today: string
  saving: boolean
  send: (request: SaveAdSettingsRequest, done: string) => Promise<boolean>
}) {
  const history = byEntity.get(entity.key) ?? []
  const [form, setForm] = useState<Form>(() =>
    formOf(versionAt(history, today) ?? EMPTY_AD_SETTING, today),
  )
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const goalMap = new Map(goals.map((g) => [g.key, g]))
  const setMap = new Map(creativeSets.map((s) => [s.id, s]))
  const isAdset = entity.level === 'adset'
  // 광고셋이 비워 둔 칸이 따를 캠페인 설정(새 장의 시작일 기준).
  const parent = isAdset
    ? settingAt(
        {
          key: adEntityKey(entity.channel, 'campaign', entity.campaignId),
          channel: entity.channel,
          level: 'campaign',
          campaignId: entity.campaignId,
        },
        byEntity,
        form.effectiveFrom || today,
      )
    : null
  const inherit = (value: string | null | false | undefined) =>
    parent && value ? `비우면 캠페인 설정: ${value}` : null

  const sameDay = history.find((v) => v.effectiveFrom === form.effectiveFrom)
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(form.effectiveFrom)
  const amount = numberOrNull(form.budgetAmount)

  const save = async () => {
    const version: AdSettingVersionInput = {
      entityKey: entity.key,
      effectiveFrom: form.effectiveFrom,
      conversionGoal: form.conversionGoal || null,
      budget: amount === null ? null : { amount, period: form.budgetPeriod },
      creativeSetId: form.creativeSetId || null,
      targetCpa: numberOrNull(form.targetCpa),
      targetRoas: numberOrNull(form.targetRoas),
      funnelStage: form.funnelStage === 'none' ? null : form.funnelStage,
      audience: form.audience,
      landingUrl: form.landingUrl,
      memo: form.memo,
    }
    const done =
      form.effectiveFrom > today
        ? `${shortDate(form.effectiveFrom, today)}부터 적용되도록 예약했습니다`
        : sameDay
          ? `${shortDate(form.effectiveFrom, today)} 설정을 고쳤습니다`
          : '저장했습니다'
    if (await send({ action: 'saveVersion', version }, done)) {
      setForm((prev) => ({ ...prev, memo: '' }))
    }
  }

  const goalOptions = [
    { value: '', label: isAdset ? '정하지 않음(캠페인 따름)' : '정하지 않음' },
    ...goals
      .filter((g) => !g.archived || g.key === form.conversionGoal)
      .map((g) => ({
        value: g.key,
        label: `${g.label} · ${KPI_LABEL[g.kpi]}`,
      })),
  ]
  const setOptions = [
    { value: '', label: '없음' },
    ...creativeSets.map((s) => ({ value: s.id, label: s.name })),
  ]

  return (
    <div className="ad-editor">
      <header className="ad-editor__head">
        <ChannelTile channelKey={entity.channel} />
        <div className="ad-editor__titles">
          <span className="ad-editor__level">
            {isAdset ? '광고셋' : '캠페인'}
            {isAdset && campaign && ` · ${campaign.name}`}
          </span>
          <h3>{entity.name}</h3>
          <span className="ad-editor__meta">
            ID {entity.platformId} · 성과 {entity.firstSeenDate} ~{' '}
            {entity.lastSeenDate}
            {entity.platformResultType &&
              ` · 플랫폼 결과 유형 ${entity.platformResultType}`}
          </span>
        </div>
      </header>

      <section className="ad-editor__form">
        <div className="ad-editor__date">
          <Field label="적용 시작일">
            <input
              type="date"
              className="ad-input"
              value={form.effectiveFrom}
              onChange={(e) => set('effectiveFrom', e.target.value)}
            />
          </Field>
          <span className="ad-editor__date-note">
            {!validDate
              ? '날짜를 골라 주세요'
              : form.effectiveFrom > today
                ? '예약 — 이 날부터 적용됩니다'
                : sameDay
                  ? '이 날짜에 이미 장이 있어 그 장을 고칩니다'
                  : '이 날부터 새 장으로 적용됩니다(이전 장은 그 전날까지)'}
          </span>
        </div>

        <div className="ad-editor__grid">
          <Field
            label="전환 목표"
            hint={inherit(
              parent?.conversionGoal &&
                goalMap.get(parent.conversionGoal)?.label,
            )}
          >
            <Select
              value={form.conversionGoal}
              options={goalOptions}
              onChange={(v) => set('conversionGoal', v)}
              label="전환 목표"
            />
          </Field>
          <Field
            label="소비 설정 비용"
            hint={inherit(parent?.budget && formatBudget(parent.budget))}
          >
            <span className="ad-field__row">
              <Segmented
                options={BUDGET_PERIOD_LABEL}
                value={form.budgetPeriod}
                onChange={(v) => set('budgetPeriod', v)}
                label="예산 기준"
                role="buttons"
              />
              <input
                className="ad-input is-number"
                inputMode="numeric"
                placeholder="원"
                value={form.budgetAmount}
                onChange={(e) => set('budgetAmount', e.target.value)}
              />
            </span>
          </Field>
          <Field
            label="소재 셋"
            hint={inherit(
              parent?.creativeSetId && setMap.get(parent.creativeSetId)?.name,
            )}
          >
            <Select
              value={form.creativeSetId}
              options={setOptions}
              onChange={(v) => set('creativeSetId', v)}
              label="소재 셋"
            />
          </Field>
          <Field label="퍼널 단계">
            <Segmented
              options={FUNNEL_OPTIONS}
              value={form.funnelStage}
              onChange={(v) => set('funnelStage', v)}
              label="퍼널 단계"
              role="buttons"
            />
          </Field>
          <Field
            label="목표 전환 단가"
            hint={inherit(parent?.targetCpa != null && won(parent.targetCpa))}
          >
            <input
              className="ad-input is-number"
              inputMode="numeric"
              placeholder="원"
              value={form.targetCpa}
              onChange={(e) => set('targetCpa', e.target.value)}
            />
          </Field>
          <Field
            label="목표 ROAS"
            hint={inherit(
              parent?.targetRoas != null && `${parent.targetRoas}%`,
            )}
          >
            <input
              className="ad-input is-number"
              inputMode="decimal"
              placeholder="%"
              value={form.targetRoas}
              onChange={(e) => set('targetRoas', e.target.value)}
            />
          </Field>
          <Field label="타깃 오디언스" wide>
            <input
              className="ad-input"
              placeholder="관심사·연령·리타깃 등"
              value={form.audience}
              onChange={(e) => set('audience', e.target.value)}
            />
          </Field>
          <Field label="랜딩 URL" wide>
            <input
              className="ad-input"
              placeholder="https://"
              value={form.landingUrl}
              onChange={(e) => set('landingUrl', e.target.value)}
            />
          </Field>
          <Field label="바꾼 이유·메모" wide>
            <textarea
              className="ad-input"
              rows={2}
              placeholder="예: 소재 B안으로 교체, 일 예산 3만 → 5만"
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
            />
          </Field>
        </div>

        <div className="ad-editor__actions">
          <button
            type="button"
            className="ad-button"
            onClick={() =>
              setForm(
                formOf(versionAt(history, today) ?? EMPTY_AD_SETTING, today),
              )
            }
            disabled={saving}
          >
            되돌리기
          </button>
          <button
            type="button"
            className="ad-button is-primary"
            onClick={save}
            disabled={saving || !validDate}
          >
            {saving
              ? '저장 중…'
              : form.effectiveFrom > today
                ? '예약 저장'
                : sameDay
                  ? '이 장 고치기'
                  : '새 장 저장'}
          </button>
        </div>
      </section>

      <section className="ad-history">
        <h4>
          변경 이력 <span>{history.length}장</span>
        </h4>
        {history.length === 0 ? (
          <p className="ad-settings__empty">
            아직 설정이 없습니다.
            {isAdset && ' 비어 있는 칸은 캠페인 설정을 따릅니다.'}
          </p>
        ) : (
          <ol className="ad-history__list">
            {[...history].reverse().map((version) => {
              const next = history.find(
                (v) => v.effectiveFrom > version.effectiveFrom,
              )
              const status = versionStatus(history, version, today)
              return (
                <li
                  key={version.id}
                  className={`ad-history__item is-${status}`}
                >
                  <div className="ad-history__when">
                    <span className={`ad-badge is-${status}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    <span>
                      {shortDate(version.effectiveFrom, today)} ~{' '}
                      {next
                        ? shortDate(addDays(next.effectiveFrom, -1), today)
                        : ''}
                    </span>
                  </div>
                  <Summary fields={version} goals={goalMap} sets={setMap} />
                  {version.memo && (
                    <p className="ad-history__memo">{version.memo}</p>
                  )}
                  <div className="ad-history__actions">
                    <button
                      type="button"
                      className="ad-button is-small"
                      onClick={() =>
                        setForm({
                          ...formOf(version, version.effectiveFrom),
                          memo: version.memo,
                        })
                      }
                    >
                      불러오기
                    </button>
                    {confirmDelete === version.id ? (
                      <button
                        type="button"
                        className="ad-button is-small is-danger"
                        disabled={saving}
                        onClick={async () => {
                          setConfirmDelete(null)
                          await send(
                            { action: 'deleteVersion', id: version.id },
                            `${shortDate(version.effectiveFrom, today)} 장을 지웠습니다`,
                          )
                        }}
                      >
                        정말 지우기
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ad-button is-small"
                        onClick={() => setConfirmDelete(version.id)}
                      >
                        지우기
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
