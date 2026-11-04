import { useEffect, useState, type ReactNode } from 'react'
import { Segmented, Select } from '@/components/glass'
import {
  adEntityKey,
  platformAt,
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
  type PlatformSetting,
  type PlatformSettingEntry,
  type SaveAdSettingsRequest,
} from '../../client'
import { addDays } from '../../utils'
import { ChannelTile } from '../channel-insight/channel-label'
import {
  BUDGET_PERIOD_LABEL,
  FUNNEL_LABEL,
  formatBudget,
  goalOptionLabel,
  platformLine,
  platformValue,
  shortDate,
} from './labels'
import { NumberInput } from './number-input'
import { CreativePicker } from './creative-picker'
import { ResultMetrics } from './result-metrics'
import { useAdCreatives } from '../../view-model/use-ad-creatives'

type Funnel = FunnelStage | 'none'

/** 입력 중인 값 — 숫자 칸도 글자로 들고 있다가 저장할 때 바꾼다. */
interface Form {
  effectiveFrom: string
  conversionGoal: string
  budgetAmount: string
  budgetPeriod: BudgetPeriod
  creativeSetId: string
  creativeIds: string[]
  funnelStage: Funnel
  audience: string
  memo: string
  /** 화면에서 뺀 칸(목표 단가·목표 ROAS·랜딩 URL) — 결과 지표로 대신 보고,
   * 예전에 넣은 값은 지우지 않고 새 장에도 그대로 넘긴다. */
  kept: Pick<AdSettingFields, 'targetCpa' | 'targetRoas' | 'landingUrl'>
}

const formOf = (fields: AdSettingFields, effectiveFrom: string): Form => ({
  effectiveFrom,
  conversionGoal: fields.conversionGoal ?? '',
  budgetAmount: fields.budget ? String(fields.budget.amount) : '',
  budgetPeriod: fields.budget?.period ?? 'daily',
  creativeSetId: fields.creativeSetId ?? '',
  creativeIds: fields.creativeIds,
  funnelStage: fields.funnelStage ?? 'none',
  audience: fields.audience,
  // 바꾼 이유는 장마다 새로 쓴다.
  memo: '',
  kept: {
    targetCpa: fields.targetCpa,
    targetRoas: fields.targetRoas,
    landingUrl: fields.landingUrl,
  },
})

/** 새 장의 칸을 매체 값으로 — 매체가 준 칸만(광고셋이 캠페인 예산을 쓰면
 * 예산 칸은 그대로 비어 캠페인 것을 따른다). */
const withPlatform = (form: Form, now: PlatformSettingEntry | null): Form =>
  now
    ? {
        ...form,
        ...(now.budget
          ? {
              budgetAmount: String(now.budget.amount),
              budgetPeriod: now.budget.period,
            }
          : {}),
        ...(now.audience ? { audience: now.audience } : {}),
      }
    : form

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

/**
 * 칸 하나 — 위에 이름, 아래에 힌트. 기본 입력칸(input·textarea)은 <label>로
 * 감싸 이름을 눌러도 칸에 들어가게 한다. 직접 그린 드롭다운·버튼 묶음(custom)은
 * <div>로 감싼다 — <label> 안이면 목록 항목을 누를 때 브라우저가 label의 첫
 * 버튼(드롭다운 열기)을 한 번 더 눌러 목록이 다시 열리고, 이름을 누르면 첫
 * 버튼("일" 등)이 눌려 값이 바뀐다.
 */
const Field = ({
  label,
  hint,
  children,
  wide = false,
  custom = false,
}: {
  label: string
  /** 비워 두면 따르는 값(캠페인 설정) 등. */
  hint?: string | null
  children: ReactNode
  wide?: boolean
  custom?: boolean
}) => {
  const className = `ad-field${wide ? ' is-wide' : ''}`
  const body = (
    <>
      <span className="ad-field__label">{label}</span>
      {children}
      {hint && <span className="ad-field__hint">{hint}</span>}
    </>
  )
  return custom ? (
    <div className={className} role="group" aria-label={label}>
      {body}
    </div>
  ) : (
    <label className={className}>{body}</label>
  )
}

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
      `소재 셋 ${sets.get(fields.creativeSetId)?.name ?? '(지운 셋)'}`,
    fields.creativeIds.length > 0 && `소재 ${fields.creativeIds.length}개`,
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
  platform,
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
  /** 매체에서 읽은 설정 기록(자동). */
  platform: ReadonlyMap<AdEntityKey, PlatformSetting>
  goals: readonly ConversionGoal[]
  creativeSets: readonly CreativeSet[]
  today: string
  saving: boolean
  send: (request: SaveAdSettingsRequest, done: string) => Promise<boolean>
}) {
  const history = byEntity.get(entity.key) ?? []
  const todayVersion = history.find((v) => v.effectiveFrom === today)
  // 매체에서 읽은 오늘 값 — 하루 넘게 못 읽었으면(꺼졌으면) 칸을 채우지 않고
  // 보여 주기만 한다.
  const platformSetting = platform.get(entity.key)
  const platformNow = platformAt(platformSetting, today)
  const platformFresh =
    !!platformSetting && platformSetting.lastSeenDate >= addDays(today, -1)
  // 광고셋이 캠페인 예산을 쓰면(Meta CBO·Google) 예산은 캠페인 기록에 있다.
  const parentPlatform =
    entity.level === 'adset'
      ? platformAt(
          platform.get(
            adEntityKey(entity.channel, 'campaign', entity.campaignId),
          ),
          today,
        )
      : null
  // 새 장(오늘 시작하는 장이 아직 없을 때)은 매체 값으로 예산·오디언스를 채운다.
  const startForm = () => {
    const base = formOf(versionAt(history, today) ?? EMPTY_AD_SETTING, today)
    return todayVersion || !platformFresh
      ? base
      : withPlatform(base, platformNow)
  }
  const [form, setForm] = useState<Form>(startForm)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  // 소재 — 새 장을 열면 지금 집행 중인 소재를 미리 체크한다(오늘 시작하는 장이
  // 이미 있으면 그 장의 소재 그대로). 직접 올린 소재는 매체가 집행 여부를 알려
  // 주지 않아서, 지난 장에서 골랐으면 계속 고른다. 손으로 고르거나 지난 장을
  // 불러온 뒤에는 건드리지 않는다.
  const creatives = useAdCreatives(entity.key)
  const [creativesTouched, setCreativesTouched] = useState(false)
  const lastCreativeIds = versionAt(history, today)?.creativeIds ?? []
  const activeCreativeIds =
    creatives.status === 'ready'
      ? creatives.creatives
          .filter(
            (c) =>
              c.active || (c.upload !== null && lastCreativeIds.includes(c.id)),
          )
          .map((c) => c.id)
      : null
  const freshForm = (): Form => ({
    ...startForm(),
    ...(activeCreativeIds && !todayVersion
      ? { creativeIds: activeCreativeIds }
      : {}),
  })
  useEffect(() => {
    if (creativesTouched || todayVersion || !activeCreativeIds) return
    setForm((prev) =>
      prev.effectiveFrom === today
        ? { ...prev, creativeIds: activeCreativeIds }
        : prev,
    )
    // 소재 목록이 처음 도착했을 때 한 번만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatives.status])
  const toggleCreative = (id: string) => {
    setCreativesTouched(true)
    setForm((prev) => ({
      ...prev,
      creativeIds: prev.creativeIds.includes(id)
        ? prev.creativeIds.filter((x) => x !== id)
        : [...prev.creativeIds, id],
    }))
  }

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
  /** 칸 아래 매체 값 — 칸과 같으면 언제부터인지만, 다르면 매체 값을. */
  const platformHint = (key: 'budget' | 'audience', current: string) => {
    const value = platformNow ? platformValue(platformNow, key) : ''
    if (!platformNow || !value)
      return key === 'budget' && parentPlatform?.budget
        ? `매체: 캠페인 예산 ${formatBudget(parentPlatform.budget)}`
        : null
    return value === current
      ? `매체 값(${shortDate(platformNow.from, today)}부터)`
      : `매체: ${value}`
  }
  const hints = (...parts: (string | null)[]) =>
    parts.filter(Boolean).join(' · ') || null

  const save = async () => {
    const version: AdSettingVersionInput = {
      entityKey: entity.key,
      effectiveFrom: form.effectiveFrom,
      conversionGoal: form.conversionGoal || null,
      budget: amount === null ? null : { amount, period: form.budgetPeriod },
      creativeSetId: form.creativeSetId || null,
      creativeIds: form.creativeIds,
      funnelStage: form.funnelStage === 'none' ? null : form.funnelStage,
      audience: form.audience,
      memo: form.memo,
      ...form.kept,
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
      .map((g) => ({ value: g.key, label: goalOptionLabel(g) })),
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
            <span className={`ad-editor__level-tag is-${entity.level}`}>
              {isAdset ? '광고셋' : '캠페인'}
            </span>
            {isAdset && campaign && (
              <span className="ad-editor__level-parent">{campaign.name}</span>
            )}
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

      <ResultMetrics entityKey={entity.key} today={today} />

      <CreativePicker
        entityKey={entity.key}
        state={creatives}
        selected={form.creativeIds}
        onToggle={toggleCreative}
        onUploaded={(id) => {
          setCreativesTouched(true)
          setForm((prev) =>
            prev.creativeIds.includes(id)
              ? prev
              : { ...prev, creativeIds: [...prev.creativeIds, id] },
          )
        }}
        onDeleted={(id) =>
          setForm((prev) => ({
            ...prev,
            creativeIds: prev.creativeIds.filter((x) => x !== id),
          }))
        }
      />

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

        {platformNow && (
          <p className="ad-editor__platform">
            <span className="ad-badge is-platform">매체</span>
            <span>
              {shortDate(platformNow.from, today)}부터 ·{' '}
              {platformLine(platformNow) || '읽은 값 없음'}
              {!platformFresh &&
                platformSetting &&
                ` · ${shortDate(platformSetting.lastSeenDate, today)}까지 읽음(지금은 집행 중이 아님)`}
            </span>
          </p>
        )}

        <div className="ad-editor__grid">
          <Field
            label="전환 목표"
            custom
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
            custom
            hint={hints(
              inherit(parent?.budget && formatBudget(parent.budget)),
              platformHint(
                'budget',
                amount === null
                  ? ''
                  : formatBudget({ amount, period: form.budgetPeriod }),
              ),
            )}
          >
            <span className="ad-field__row">
              <Segmented
                options={BUDGET_PERIOD_LABEL}
                value={form.budgetPeriod}
                onChange={(v) => set('budgetPeriod', v)}
                label="예산 기준"
                role="buttons"
              />
              <NumberInput
                label="소비 설정 비용"
                unit="원"
                value={form.budgetAmount}
                onChange={(v) => set('budgetAmount', v)}
              />
            </span>
          </Field>
          <Field
            label="소재 셋"
            custom
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
          <Field label="퍼널 단계" custom>
            <Segmented
              options={FUNNEL_OPTIONS}
              value={form.funnelStage}
              onChange={(v) => set('funnelStage', v)}
              label="퍼널 단계"
              role="buttons"
            />
          </Field>
          <Field
            label="타깃 오디언스"
            wide
            hint={platformHint('audience', form.audience)}
          >
            <input
              className="ad-input"
              placeholder="관심사·연령·리타깃 등"
              value={form.audience}
              onChange={(e) => set('audience', e.target.value)}
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
            onClick={() => {
              setCreativesTouched(false)
              setForm(freshForm())
            }}
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
                      onClick={() => {
                        setCreativesTouched(true)
                        setForm({
                          ...formOf(version, version.effectiveFrom),
                          memo: version.memo,
                        })
                      }}
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
