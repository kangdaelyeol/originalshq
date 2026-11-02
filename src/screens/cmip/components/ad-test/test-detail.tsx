import { useState, type CSSProperties, type ReactNode } from 'react'
import { LoadingPanel, Select } from '@/components/glass'
import {
  TEST_KPIS,
  settingAt,
  type AdSettingFields,
  type ConversionGoal,
  type CreativeSet,
  type DataEvent,
  type GoalKpi,
} from '../../client'
import { addDays, formatMD } from '../../utils'
import type { useAdTestViewModel } from '../../view-model/use-ad-test-view-model'
import { ChannelTile } from '../channel-insight/channel-label'
import {
  FUNNEL_LABEL,
  KPI_LABEL,
  formatBudget,
  goalOptionLabel,
  shortDate,
  won,
} from '../ad-settings/labels'
import { BASELINE_DAYS, type SettingSegment } from './changes'
import { segmentColor } from './palette'
import { SegmentKpis } from './segment-kpis'
import { TestTimeline } from './test-timeline'

type Vm = ReturnType<typeof useAdTestViewModel>

const STATUS_LABEL: Record<SettingSegment['status'], string> = {
  baseline: '기준',
  past: '지난 설정',
  current: '적용 중',
}

const Section = ({
  title,
  hint,
  aside,
  children,
}: {
  title: string
  hint?: string
  aside?: ReactNode
  children: ReactNode
}) => (
  <section className="ad-test-section">
    <div className="ad-test-section__head">
      <h4>{title}</h4>
      {hint && <span>{hint}</span>}
      {aside && <div className="ad-test-section__aside">{aside}</div>}
    </div>
    {children}
  </section>
)

/** 설정 한 장의 칸들을 배지로 — 정한 칸만. */
const settingChips = (
  fields: AdSettingFields,
  goals: readonly ConversionGoal[],
  sets: readonly CreativeSet[],
): string[] => {
  const goal = goals.find((g) => g.key === fields.conversionGoal)
  return [
    fields.conversionGoal &&
      `목표 ${goal ? goalOptionLabel(goal) : fields.conversionGoal}`,
    fields.budget && formatBudget(fields.budget),
    fields.creativeSetId &&
      `소재 ${sets.find((s) => s.id === fields.creativeSetId)?.name ?? '(지운 셋)'}`,
    fields.targetCpa !== null && `목표 단가 ${won(fields.targetCpa)}`,
    fields.targetRoas !== null &&
      `목표 ROAS ${fields.targetRoas.toLocaleString('ko-KR')}%`,
    fields.funnelStage && `퍼널 ${FUNNEL_LABEL[fields.funnelStage]}`,
    fields.audience && `오디언스 ${fields.audience}`,
  ].filter(Boolean) as string[]
}

const DATA_EVENT_LABEL: Record<DataEvent['kind'], string> = {
  spendUp: '광고비 수준 상승',
  spendDown: '광고비 수준 하락',
  paused: '집행 멈춤',
  resumed: '집행 다시 시작',
}

/** 성과에서 찾은 변화 한 줄 — 앞뒤 7일 일평균 광고비. */
const dataEventText = (e: DataEvent) =>
  e.kind === 'paused'
    ? `${e.pausedDays}일 동안 광고비 0 (멈추기 전 일평균 ${won(e.before)})`
    : e.kind === 'resumed'
      ? `다시 쓰기 시작 — 뒤 7일 일평균 ${won(e.after)}`
      : `앞 7일 일평균 ${won(e.before)} → 뒤 7일 ${won(e.after)}`

/**
 * 고른 캠페인·광고셋의 테스트 — 광고 설정의 장이 곧 구간이다. 위에서부터 지금
 * 설정·판단 지표, 구간(장)마다 기간·바뀐 칸·바꾼 이유·그 동안의 설정, 흐름
 * 그래프, 구간별 지표, 설정에 적지 않았는데 성과에서 찾은 변화.
 */
export function TestDetail({ vm }: { vm: Vm }) {
  // 판단 지표 — 전환 목표를 따르되 이 화면에서만 바꿔 볼 수 있다(저장 안 함).
  const [kpiOverride, setKpiOverride] = useState<GoalKpi | ''>('')
  const { entity, snapshot } = vm
  if (!entity || !snapshot) {
    return (
      <p className="ad-test__placeholder">
        왼쪽에서 캠페인이나 광고셋을 고르세요.
        <br />
        광고 설정의 장(변경 이력)이 그대로 구간이 됩니다.
      </p>
    )
  }
  if (vm.dailyState?.status === 'error') {
    return (
      <p className="ad-test__placeholder">
        일별 성과를 불러오지 못했습니다 — {vm.dailyState.error}
      </p>
    )
  }
  if (vm.dailyState?.status !== 'ready') {
    return <LoadingPanel label="일별 성과를 불러오는 중" minHeight={420} />
  }

  const { segments, metrics, scheduled } = vm
  const setting = settingAt(entity, vm.byEntity, vm.today)
  const primaryKpi: GoalKpi = kpiOverride || vm.goalKpi || 'cpa'
  const primary =
    TEST_KPIS.find((k) => k.goalKpi === primaryKpi) ?? TEST_KPIS[2]
  const kpiOptions = [
    {
      value: '' as const,
      label: `전환 목표 따름 (${vm.goalKpi ? KPI_LABEL[vm.goalKpi] : '목표 없음 → 전환 단가'})`,
    },
    ...(Object.keys(KPI_LABEL) as GoalKpi[]).map((k) => ({
      value: k,
      label: KPI_LABEL[k],
    })),
  ]
  // 그래프 범위 — 첫 구간 7일 전부터 데이터 마지막 날까지.
  const firstDay = vm.days[0]?.date ?? vm.today
  const lastDay = vm.days[vm.days.length - 1]?.date ?? vm.today
  const start = segments[0] ? addDays(segments[0].start, -7) : firstDay
  const from = start > firstDay ? start : firstDay
  const to = lastDay
  const inRange = (date: string) => date >= from && date <= to
  const chips = settingChips(setting, snapshot.goals, snapshot.creativeSets)
  const hasBaselineData =
    !!vm.events[0]?.first && vm.days.some((d) => d.date < vm.events[0].date)

  return (
    <div className="ad-test-detail">
      <header className="ad-test-detail__head">
        <ChannelTile channelKey={entity.channel} />
        <div className="ad-test-detail__titles">
          <span className="ad-test-detail__level">
            {entity.level === 'adset'
              ? `광고셋 · ${vm.campaign?.name ?? entity.campaignName}`
              : '캠페인'}
          </span>
          <h3 className="ad-test-detail__name">{entity.name}</h3>
          <span className="ad-test-detail__current">
            지금 설정:
            {chips.length ? (
              chips.map((chip) => (
                <span key={chip} className="ad-badge">
                  {chip}
                </span>
              ))
            ) : (
              <span className="ad-badge is-missing">정한 값 없음</span>
            )}
          </span>
        </div>
      </header>

      <div className="ad-test-detail__controls">
        <div className="ad-field" role="group" aria-label="판단 지표">
          <span className="ad-field__label">판단 지표</span>
          <Select
            value={kpiOverride}
            options={kpiOptions}
            onChange={setKpiOverride}
            label="판단 지표"
          />
        </div>
        {hasBaselineData && (
          <button
            type="button"
            className={`ad-button is-small is-toggle${vm.withBaseline ? ' is-on' : ''}`}
            aria-pressed={vm.withBaseline}
            onClick={() => vm.setWithBaseline(!vm.withBaseline)}
          >
            첫 설정 전 {BASELINE_DAYS}일 같이 보기
          </button>
        )}
        <span className="ad-test-detail__hint">
          구간은 광고 설정 탭의 변경 이력에서 옵니다 — 설정을 고치면 구간도
          바뀝니다
        </span>
      </div>

      {segments.length === 0 ? (
        <p className="ad-test__placeholder">
          아직 적용된 설정이 없습니다
          {scheduled.length > 0 &&
            ` — ${shortDate(scheduled[0].date, vm.today)}부터 적용될 예약이 있습니다`}
          .
        </p>
      ) : (
        <>
          <Section
            title="구간"
            hint="광고 설정의 장 하나가 구간 하나 — 설정이 바뀐 날마다 새 구간"
          >
            <ol className="ad-test-periods">
              {segments.map((segment, i) => {
                const m = metrics[i]
                const segmentChips = segment.setting
                  ? settingChips(
                      segment.setting,
                      snapshot.goals,
                      snapshot.creativeSets,
                    )
                  : []
                return (
                  <li
                    key={segment.id}
                    className={`ad-test-period is-${segment.status}`}
                    style={
                      {
                        '--seg-color': segmentColor(i),
                        '--glass-i': Math.min(i, 8),
                      } as CSSProperties
                    }
                  >
                    <div className="ad-test-period__head">
                      <i className="ad-test-period__dot" />
                      <b>{segment.label}</b>
                      <span className="ad-test-period__range">
                        {formatMD(segment.start)} ~{' '}
                        {segment.status === 'current'
                          ? `${formatMD(segment.end)}(진행 중)`
                          : formatMD(segment.end)}{' '}
                        · {m?.days ?? 0}일
                      </span>
                      <span
                        className={`ad-badge${
                          segment.status === 'current' ? ' is-current' : ''
                        }`}
                      >
                        {STATUS_LABEL[segment.status]}
                      </span>
                      {segment.event?.sources.includes('campaign') &&
                        entity.level === 'adset' && (
                          <span className="ad-badge is-inherited">
                            캠페인 설정 변경
                          </span>
                        )}
                    </div>
                    {segment.event ? (
                      segment.event.first ? (
                        <p className="ad-test-period__first">처음 넣은 설정</p>
                      ) : (
                        <ul className="ad-test-period__changes">
                          {segment.event.changes.map((change) => (
                            <li key={change.label}>
                              <span>{change.label}</span>
                              <em>{change.before}</em> → <b>{change.after}</b>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : (
                      <p className="ad-test-period__first">
                        설정을 넣기 전 {m?.days ?? 0}일 — 첫 설정과 견줄 기준
                      </p>
                    )}
                    {segment.event?.memo && (
                      <p className="ad-test-period__memo">
                        바꾼 이유 · {segment.event.memo}
                      </p>
                    )}
                    {segmentChips.length > 0 && (
                      <span className="ad-test-period__chips">
                        {segmentChips.map((chip) => (
                          <span key={chip} className="ad-badge">
                            {chip}
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
            {scheduled.length > 0 && (
              <ul className="ad-test-periods__scheduled">
                {scheduled.map((event) => (
                  <li key={event.date}>
                    <span className="ad-badge is-scheduled">예약</span>
                    {shortDate(event.date, vm.today)}부터 —{' '}
                    {event.changes
                      .map((c) => `${c.label} ${c.before} → ${c.after}`)
                      .join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="흐름" hint="구간 띠 위의 굵은 금이 그 구간의 값">
            <TestTimeline
              days={vm.days}
              from={from}
              to={to}
              segments={segments}
              metrics={metrics}
              settingEvents={vm.events.filter((e) => inRange(e.date))}
              dataEvents={vm.changes.filter((e) => inRange(e.date))}
              primary={primary}
            />
          </Section>

          <Section title="구간별 지표" hint="▲▼는 바로 앞 구간 대비">
            <SegmentKpis
              segments={segments}
              metrics={metrics}
              primaryKpi={primaryKpi}
            />
          </Section>

          {vm.changes.some((e) => inRange(e.date)) && (
            <Section
              title="성과에서 찾은 변화"
              hint="설정에 적지 않은 변화 — 플랫폼에서 예산·입찰을 직접 바꿨다면 광고 설정에도 남겨 주세요"
            >
              <ul className="ad-test-data-events">
                {vm.changes
                  .filter((e) => inRange(e.date))
                  .map((e) => (
                    <li key={`${e.kind}:${e.date}`}>
                      <b>{formatMD(e.date)}</b>
                      <span className={`ad-badge is-data-${e.kind}`}>
                        {DATA_EVENT_LABEL[e.kind]}
                      </span>
                      <span>{dataEventText(e)}</span>
                    </li>
                  ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
