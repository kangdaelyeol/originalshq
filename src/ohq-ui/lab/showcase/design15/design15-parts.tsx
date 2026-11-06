import { useState } from 'react'
import { AccentPicker } from './accent-picker'
import { Avatar } from './avatar'
import { CalendarMonth } from './calendar-month'
import { cssVars } from './d15-format'
import {
  accentByKey,
  D15_ACCENTS,
  D15_MEMBERS,
  D15_RANGE_DATA,
  D15_SPARKS,
  D15_TASKS,
  D15_THROUGHPUT,
  D15_TIME_PROJECTS,
  type D15AccentKey,
  type D15Task,
} from './design15-data'
import { KpiTile } from './kpi-tile'
import { MemberCard } from './member-card'
import { PillTabs } from './pill-tabs'
import { ProgressGauge } from './progress-gauge'
import { StatCard } from './stat-card'
import { TaskCard } from './task-card'
import { ThroughputChart } from './throughput-chart'
import { TimeDonut } from './time-donut'
import { TimeTracker } from './time-tracker'
import { TrackerClock } from './tracker-clock'
import { WeekBars } from './week-bars'

const accentVars = (key: D15AccentKey) => {
  const a = accentByKey(key)
  return cssVars({
    '--d15-accent': a.accent,
    '--d15-accent-soft': a.soft,
    '--d15-accent-deep': a.deep,
    '--d15-accent-ink': a.ink,
    '--d15-accent-tint': a.tint,
  })
}

const task = (id: string, patch: Partial<D15Task> = {}) => ({
  ...(D15_TASKS.find((t) => t.id === id) ?? D15_TASKS[0]),
  ...patch,
})

/** 부품 견본 — 장면 아래에 부품마다 따로(1em = 영상 13px, 1.3배). 토큰은 같은 뿌리 변수를 읽는다. */
export function Design15Parts() {
  const [accent, setAccent] = useState<D15AccentKey>('plum')
  const [tab, setTab] = useState<'7D' | '30D' | '90D'>('30D')
  const [running] = useState(() => {
    const c = new TrackerClock(12 * 60 + 30)
    c.play()
    return c
  })
  const [paused] = useState(() => new TrackerClock(1 * 3600 + 24 * 60 + 8))
  const range = D15_RANGE_DATA[tab]

  return (
    <div className="d15-parts d15-app is-parts" lang="en" style={accentVars('ocean')}>
      <section className="d15-part">
        <p className="d15-part__name">
          <code>{'<StatCard highlight noteTone>'}</code> · <code>{'<WeekBars bars focus>'}</code> ·{' '}
          <code>{'<ProgressGauge completed inProgress>'}</code>
        </p>
        <div className="d15-part__row">
          <figure>
            <div className="d15-part__well is-stats">
              <StatCard highlight title="Total Projects" value={24} note="Increased from last month" />
              <StatCard title="Ended Projects" value={10} note="Increased from last month" index={1} />
              <StatCard title="Pending Projects" value={2} note="Awaiting review" noteTone="review" index={2} />
            </div>
            <figcaption>highlight · plain · noteTone=&quot;review&quot;</figcaption>
          </figure>
          <figure>
            <div className="d15-part__well is-bars">
              <WeekBars
                index={0}
                focus={4}
                title="Focus hours"
                bars={[
                  { day: 'M', value: 40, tone: 'hatch' },
                  { day: 'T', value: 72, tone: 'accent' },
                  { day: 'W', value: 58, tone: 'soft' },
                  { day: 'T', value: 96, tone: 'deep' },
                  { day: 'F', value: 81, tone: 'accent' },
                ]}
              />
            </div>
            <figcaption>bars 5 · focus 4</figcaption>
          </figure>
          <figure>
            <div className="d15-part__well is-gauges">
              <ProgressGauge completed={10 / 24} inProgress={12 / 24} index={0} />
              <ProgressGauge completed={0.75} inProgress={0.15} label="Shipped" title="Q4 roadmap" index={1} />
            </div>
            <figcaption>42% · 50% / 75% · 15%</figcaption>
          </figure>
        </div>
      </section>

      <section className="d15-part">
        <p className="d15-part__name">
          <code>{'<TimeTracker clock>'}</code> · <code>{'<TaskCard ghost lifted>'}</code> ·{' '}
          <code>{'<Avatar presence>'}</code>
        </p>
        <div className="d15-part__row">
          <figure>
            <div className="d15-part__well is-trackers">
              <TimeTracker clock={running} index={0} />
              <TimeTracker clock={paused} title="Paused" index={1} />
            </div>
            <figcaption>재생 중(초마다 굴림) · 멈춤</figcaption>
          </figure>
          <figure>
            <div className="d15-part__well is-tasks">
              <TaskCard task={task('t-lcp')} />
              <TaskCard task={task('t-saved', { stage: 'done' })} />
              <TaskCard task={task('t-login')} lifted />
              <TaskCard task={task('t-brand')} ghost />
            </div>
            <figcaption>High · 끝남(날짜·가득 찬 막대) · lifted · ghost</figcaption>
          </figure>
          <figure>
            <div className="d15-part__well is-avatars">
              <Avatar initials="PR" size="xl" presence="online" />
              <Avatar initials="HK" size="lg" presence="away" />
              <Avatar initials="SS" size="md" presence="offline" />
              <Avatar initials="NB" />
            </div>
            <figcaption>xl · lg · md · sm</figcaption>
          </figure>
        </div>
      </section>

      <section className="d15-part">
        <p className="d15-part__name">
          <code>{'<MemberCard member>'}</code> · <code>{'<PillTabs options value>'}</code>
        </p>
        <div className="d15-part__row">
          <figure>
            <div className="d15-part__well is-members">
              {[D15_MEMBERS[1], D15_MEMBERS[2], D15_MEMBERS[5]].map((m) => (
                <MemberCard key={m.id} member={m} />
              ))}
            </div>
            <figcaption>online · 일 부담 88%(호박색) · offline</figcaption>
          </figure>
          <figure>
            <div className="d15-part__well is-tabs">
              <PillTabs options={['7D', '30D', '90D'] as const} value={tab} onChange={setTab} label="Range" />
            </div>
            <figcaption>누르면 알약이 늘어나며 옮겨 가요</figcaption>
          </figure>
        </div>
      </section>

      <section className="d15-part">
        <p className="d15-part__name">
          <code>{'<KpiTile kpi range spark>'}</code> · <code>{'<TimeDonut items caption>'}</code> ·{' '}
          <code>{'<ThroughputChart days>'}</code> — 위 알약({tab})을 따라 바뀌어요
        </p>
        <div className="d15-part__row">
          <figure>
            <div className="d15-part__well is-kpis">
              {range.kpis.slice(0, 2).map((kpi, k) => (
                <KpiTile key={kpi.label} kpi={kpi} range={tab} spark={D15_SPARKS[k]} index={k} />
              ))}
            </div>
            <figcaption>숫자는 보이던 값에서 새 값으로</figcaption>
          </figure>
          <figure>
            <div className="d15-part__well is-donut">
              <TimeDonut
                items={D15_TIME_PROJECTS.map((p, k) => ({ ...p, hours: range.hours[k] }))}
                caption={`tracked · ${tab.toLowerCase()}`}
                index={0}
              />
            </div>
            <figcaption>{tab}</figcaption>
          </figure>
          <figure>
            <div className="d15-part__well is-chart">
              <ThroughputChart days={D15_THROUGHPUT.slice(-range.days)} index={0} />
            </div>
            <figcaption>올려 보세요(말풍선)</figcaption>
          </figure>
        </div>
      </section>

      <section className="d15-part">
        <p className="d15-part__name">
          <code>{'<AccentPicker accents value>'}</code> — 이 칸의 강조색만 바꿔요 ·{' '}
          <code>{'<CalendarMonth weekStart>'}</code>
        </p>
        <div className="d15-part__row">
          <figure>
            <div className="d15-part__well is-accent" style={accentVars(accent)}>
              <AccentPicker accents={D15_ACCENTS} value={accent} onChange={setAccent} />
              <div className="d15-part__mini">
                <StatCard highlight title="Total Projects" value={25} note="Increased from last month" index={0} />
                <ProgressGauge completed={0.4} inProgress={0.48} index={1} />
              </div>
              <div className="d15-toast is-static">Accent set to {accentByKey(accent).name}</div>
            </div>
            <figcaption>accent=&quot;{accent}&quot; · 알림 알약</figcaption>
          </figure>
          <figure>
            <div className="d15-part__well is-month">
              <CalendarMonth year={2026} month={9} weekStart={1} index={0} />
            </div>
            <figcaption>weekStart=1(월요일부터)</figcaption>
          </figure>
        </div>
      </section>

      <section className="d15-part">
        <p className="d15-part__name">
          <code>{'<TourCaption>'}</code> 영상 편집자의 설명 알약 — 둘러보기가 글을 넣는다
        </p>
        <div className="d15-part__row">
          <figure>
            <div className="d15-part__well is-caption">
              <div className="d15-caption is-static">
                <i className="d15-caption__dot" />
                <span className="d15-caption__text">Drag work across the board</span>
              </div>
            </div>
            <figcaption>F259~F307</figcaption>
          </figure>
        </div>
      </section>
    </div>
  )
}
