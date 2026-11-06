import { Bell, ChevronDown, LayoutGrid, Users } from 'lucide-react'
import { useState } from 'react'
import { cx } from '../../../lib/cx'
import { AccentPicker } from './accent-picker'
import { Avatar } from './avatar'
import { cssVars } from './d15-format'
import { D15_ACCENTS, D15_PAGE_HEAD, D15_USER, type D15AccentKey } from './design15-data'
import { PageHead } from './page-head'

type Tab = 'profile' | 'notifications' | 'appearance'

const TABS: readonly { id: Tab; label: string; Icon: typeof Users }[] = [
  { id: 'profile', label: 'Profile', Icon: Users },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
  { id: 'appearance', label: 'Appearance', Icon: LayoutGrid },
]

interface SettingsPageProps {
  accent: D15AccentKey
  onAccent: (key: D15AccentKey) => void
  weekStart: 0 | 1
  onWeekStart: (start: 0 | 1) => void
}

/** 두 칸 고르기(F790 "WEEK STARTS ON": 고른 칸은 강조색 알약, 다른 칸은 옅은 회색) */
function ChoicePills<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="d15-choices" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={cx('d15-choice', o.value === value && 'is-active')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 켜고 끄기(알림 칸 — 영상에 안 보여 같은 결로 채움) */
function Toggle({ label, sub, defaultOn }: { label: string; sub: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn)
  return (
    <label className="d15-toggle">
      <span>
        <b>{label}</b>
        <small>{sub}</small>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={cx('d15-toggle__sw', on && 'is-on')}
        onClick={() => setOn(!on)}
      >
        <i />
      </button>
    </label>
  )
}

/**
 * Settings(F820) — 왼쪽 갈래(Profile·Notifications·Appearance), 오른쪽 판. Appearance의 강조색이
 * 앱 전체(사이드바 표시·막대·반원·단추·꼬리표·시간 기록 카드)를 다시 칠한다(F776 Plum).
 */
export function SettingsPage({ accent, onAccent, weekStart, onWeekStart }: SettingsPageProps) {
  // 처음은 Profile(F738) — 영상은 Appearance를 눌러 옮겨 간다(F740.5)
  const [tab, setTab] = useState<Tab>('profile')
  const head = D15_PAGE_HEAD.settings
  return (
    <div className="d15-settings">
      <PageHead title={head.title} sub={head.sub} />
      <div className="d15-settings__grid">
        <nav className="d15-card d15-settings__nav d15-rise" style={cssVars({ '--i': 0 })} aria-label="Settings">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={cx('d15-settings__tab', tab === id && 'is-active')}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
              data-tour={`settings-${id}`}
            >
              <Icon aria-hidden strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </nav>
        <section
          key={tab}
          className="d15-card d15-settings__panel d15-rise"
          style={cssVars({ '--i': 1 })}
          data-tour="appearance"
        >
          {tab === 'appearance' && (
            <>
              <h3 className="d15-settings__title">Appearance</h3>
              <p className="d15-settings__sub">
                The accent re-tints the whole workspace, and is remembered on this device.
              </p>
              <h4 className="d15-settings__label">Accent</h4>
              <AccentPicker accents={D15_ACCENTS} value={accent} onChange={onAccent} />
              <h4 className="d15-settings__label">Week starts on</h4>
              <ChoicePills
                options={[
                  { value: 0 as const, label: 'Sunday' },
                  { value: 1 as const, label: 'Monday' },
                ]}
                value={weekStart}
                onChange={onWeekStart}
              />
            </>
          )}
          {tab === 'profile' && (
            <>
              <header className="d15-settings__who">
                <Avatar initials={D15_USER.initials} size="xl" />
                <span>
                  <h3 className="d15-settings__title">Profile</h3>
                  <p className="d15-settings__sub">This is how teammates see you across the workspace.</p>
                </span>
              </header>
              <div className="d15-settings__fields">
                <label className="d15-field">
                  <span className="d15-field__label">Full name</span>
                  <input className="d15-field__input" defaultValue={D15_USER.name} />
                </label>
                <label className="d15-field">
                  <span className="d15-field__label">Email</span>
                  <input className="d15-field__input" defaultValue={D15_USER.email} />
                </label>
                <label className="d15-field">
                  <span className="d15-field__label">Role</span>
                  <input className="d15-field__input" defaultValue="Project Lead" />
                </label>
                <label className="d15-field">
                  <span className="d15-field__label">Time zone</span>
                  <span className="d15-field__wrap">
                    <select className="d15-field__input" defaultValue="jakarta">
                      <option value="jakarta">GMT+7 · Jakarta</option>
                      <option value="lisbon">GMT+1 · Lisbon</option>
                      <option value="toronto">GMT-4 · Toronto</option>
                    </select>
                    <ChevronDown className="d15-field__icon" aria-hidden strokeWidth={2} />
                  </span>
                </label>
                <label className="d15-field is-wide">
                  <span className="d15-field__label">Bio</span>
                  <textarea
                    className="d15-field__input is-area"
                    defaultValue="Shipping calm software with a kind team."
                  />
                </label>
              </div>
              <div className="d15-settings__actions">
                <button type="button" className="d15-btn d15-btn--ghost">
                  Discard
                </button>
                <button type="button" className="d15-btn d15-btn--solid">
                  Save changes
                </button>
              </div>
            </>
          )}
          {tab === 'notifications' && (
            <>
              <h3 className="d15-settings__title">Notifications</h3>
              <p className="d15-settings__sub">Choose what pings you, and what waits for the daily digest.</p>
              <Toggle label="Mentions" sub="When someone @mentions you in a task" defaultOn />
              <Toggle label="Due soon" sub="A day before a task you own is due" defaultOn />
              <Toggle label="Daily digest" sub="One summary at 9:00 am" />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
