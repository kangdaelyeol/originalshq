import { useState } from 'react'
import { LoadingPanel, Segmented, Select } from '@/components/glass'
import {
  TEST_KPIS,
  settingAt,
  type AdTestStatus,
  type GoalKpi,
} from '../../client'
import { addDays } from '../../utils'
import type { useAdTestViewModel } from '../../view-model/use-ad-test-view-model'
import { ChannelTile } from '../channel-insight/channel-label'
import { KPI_LABEL, formatBudget, shortDate } from '../ad-settings/labels'
import { ChangeAlerts } from './change-alerts'
import { SegmentEditor } from './segment-editor'
import { SegmentKpis } from './segment-kpis'
import { TestTimeline } from './test-timeline'

type Vm = ReturnType<typeof useAdTestViewModel>

const STATUS_LABEL: Record<AdTestStatus, string> = {
  running: '진행 중',
  done: '완료',
}

/** 그래프·알림 범위 — 구간 전체에 앞 7일을 더해(바뀌기 전 흐름도 보이게)
 * 데이터가 있는 날 안으로. 구간이 없으면 마지막 4주. */
const viewRange = (vm: Vm): { from: string; to: string } => {
  const first = vm.days[0]?.date ?? vm.today
  const last = vm.days[vm.days.length - 1]?.date ?? vm.today
  const segments = vm.draft?.segments ?? []
  if (segments.length === 0) {
    const from = addDays(last, -27)
    return { from: from > first ? from : first, to: last }
  }
  const start = addDays(segments[0].start, -7)
  const end = segments.reduce(
    (m, s) => (s.end > m ? s.end : m),
    segments[0].end,
  )
  return {
    from: start > first ? start : first,
    to: end < last ? end : last,
  }
}

const Section = ({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) => (
  <section className="ad-test-section">
    <div className="ad-test-section__head">
      <h4>{title}</h4>
      {hint && <span>{hint}</span>}
    </div>
    {children}
  </section>
)

/** 고른 대상의 테스트 — 머리(이름·상태·판단 지표·가설·저장), 흐름 그래프,
 * 알림, 구간 편집, 구간별 지표. */
export function TestDetail({ vm }: { vm: Vm }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { entity, draft, snapshot } = vm
  if (!entity || !snapshot) {
    return (
      <p className="ad-test__placeholder">
        왼쪽에서 테스트를 열거나, "새 테스트"에서 캠페인·광고셋을 고르세요.
        <br />
        대상마다 테스트가 하나이고, 저장하면 모두가 같이 봅니다.
      </p>
    )
  }
  if (vm.dailyState?.status === 'error') {
    return (
      <p className="ad-test__placeholder">
        일별 성과를 불러오지 못했습니다 — {vm.dailyState.error}
        <br />
        (functions-cmip의 getAdEntityDaily가 배포되어 있어야 합니다)
      </p>
    )
  }
  if (!draft || vm.dailyState?.status !== 'ready') {
    return <LoadingPanel label="일별 성과를 불러오는 중" minHeight={420} />
  }

  const { from, to } = viewRange(vm)
  const setting = settingAt(entity, vm.byEntity, vm.today)
  const goal = snapshot.goals.find((g) => g.key === setting.conversionGoal)
  const primary =
    TEST_KPIS.find((k) => k.goalKpi === vm.primaryKpi) ?? TEST_KPIS[2]
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

  return (
    <div className="ad-test-detail">
      <header className="ad-test-detail__head">
        <ChannelTile channelKey={entity.channel} />
        <div className="ad-test-detail__titles">
          <span className="ad-test-detail__level">
            {entity.level === 'adset' ? '광고셋' : '캠페인'} · {entity.name}
            {vm.campaign && ` · ${vm.campaign.name}`}
          </span>
          <input
            className="ad-test-detail__title"
            value={draft.title}
            maxLength={60}
            aria-label="테스트 이름"
            onChange={(e) => vm.edit((d) => ({ ...d, title: e.target.value }))}
          />
          <span className="ad-test-detail__current">
            지금 설정:
            <span className={`ad-badge${goal ? '' : ' is-missing'}`}>
              {goal ? `목표 ${goal.label}` : '전환 목표 없음'}
            </span>
            {setting.budget && (
              <span className="ad-badge">{formatBudget(setting.budget)}</span>
            )}
            {setting.creativeSetId && (
              <span className="ad-badge">
                소재{' '}
                {snapshot.creativeSets.find(
                  (s) => s.id === setting.creativeSetId,
                )?.name ?? '-'}
              </span>
            )}
          </span>
        </div>
        <div className="ad-test-detail__actions">
          <Segmented
            options={STATUS_LABEL}
            value={draft.status}
            onChange={(status) => vm.edit((d) => ({ ...d, status }))}
            label="상태"
            role="buttons"
          />
          {vm.dirty && vm.saved && (
            <button
              type="button"
              className="ad-button"
              onClick={vm.discardDraft}
              disabled={vm.saving}
            >
              되돌리기
            </button>
          )}
          <button
            type="button"
            className="ad-button is-primary"
            onClick={vm.save}
            disabled={vm.saving || !vm.dirty || !draft.title.trim()}
          >
            {vm.saving ? '저장 중…' : vm.saved ? '저장' : '테스트 만들기'}
          </button>
        </div>
      </header>

      <div className="ad-test-detail__meta">
        <label className="ad-field">
          <span className="ad-field__label">판단 지표</span>
          <Select
            value={draft.primaryKpi ?? ''}
            options={kpiOptions}
            onChange={(v) =>
              vm.edit((d) => ({ ...d, primaryKpi: v === '' ? null : v }))
            }
            label="판단 지표"
          />
        </label>
        <label className="ad-field is-wide">
          <span className="ad-field__label">가설·메모</span>
          <textarea
            className="ad-input"
            rows={2}
            maxLength={1000}
            placeholder="예: 소재를 영상(B)으로 바꾸면 문의 단가가 20% 낮아진다"
            value={draft.hypothesis}
            onChange={(e) =>
              vm.edit((d) => ({ ...d, hypothesis: e.target.value }))
            }
          />
        </label>
        <span className="ad-test-detail__saved">
          {vm.saved
            ? `${shortDate(new Date(vm.saved.updatedAt).toISOString().slice(0, 10), vm.today)} 저장됨`
            : '아직 저장 안 됨'}
          {vm.dirty && vm.saved && ' · 저장 안 한 변경 있음'}
        </span>
      </div>

      <Section title="흐름" hint="구간 띠 위의 굵은 금이 그 구간의 값">
        <TestTimeline
          days={vm.days}
          from={from}
          to={to}
          segments={draft.segments}
          metrics={vm.metrics}
          settingEvents={vm.events}
          dataEvents={vm.changes}
          primary={primary}
        />
      </Section>

      <Section
        title="알림"
        hint="설정이 바뀐 날·성과가 크게 바뀐 날 — 구간을 그 날로 나눌 수 있습니다"
      >
        <ChangeAlerts
          settingEvents={vm.events}
          dataEvents={vm.changes}
          segments={draft.segments}
          from={from}
          to={to}
          onSplit={vm.segmentActions.splitAt}
          onAddBefore={vm.segmentActions.addBefore}
        />
      </Section>

      <Section
        title="구간"
        hint="성과를 나눠 볼 기간 — 날짜는 데이터 범위 밖으로도 정할 수 있습니다"
      >
        <SegmentEditor
          segments={draft.segments}
          canSplitBySettings={vm.events.some(
            (e) => e.date >= from && e.date <= to,
          )}
          onUpdate={vm.segmentActions.update}
          onRemove={vm.segmentActions.remove}
          onAdd={vm.segmentActions.add}
          onBySettings={vm.segmentActions.bySettings}
          onEven={vm.segmentActions.even}
        />
      </Section>

      <Section title="구간별 지표" hint="▲▼는 바로 앞 구간 대비">
        <SegmentKpis
          segments={draft.segments}
          metrics={vm.metrics}
          primaryKpi={vm.primaryKpi}
        />
      </Section>

      {vm.saved && (
        <div className="ad-test-detail__danger">
          {confirmDelete ? (
            <>
              <span>모두가 보는 테스트가 지워집니다.</span>
              <button
                type="button"
                className="ad-button is-small"
                onClick={() => setConfirmDelete(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="ad-button is-small is-danger"
                disabled={vm.saving}
                onClick={async () => {
                  setConfirmDelete(false)
                  await vm.remove()
                }}
              >
                정말 지우기
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ad-button is-small"
              onClick={() => setConfirmDelete(true)}
            >
              테스트 지우기
            </button>
          )}
        </div>
      )}
    </div>
  )
}
