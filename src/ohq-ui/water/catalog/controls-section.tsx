import {
  Bell,
  Briefcase,
  CreditCard,
  Download,
  Mic,
  Plus,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  User,
} from 'lucide-react'
import { useState } from 'react'
import {
  WaterAvatar,
  WaterButton,
  WaterChips,
  WaterCheck,
  WaterDialog,
  WaterIconButton,
  WaterRadio,
  WaterRange,
  WaterSegmented,
  WaterStatusPill,
  WaterSwitch,
  WaterTextField,
  type WaterEffect,
  type WaterOption,
} from '../controls'
import { WaterSection, WaterSpec } from './spec'

// D7 펼친 메뉴의 다섯 칸(영상 라벨 그대로)
const D7_ITEMS: WaterOption<string>[] = [
  { value: 'activity', label: 'Activity', icon: TrendingUp },
  { value: 'cards', label: 'Cards', icon: CreditCard },
  { value: 'work', label: 'Work', icon: Briefcase },
  { value: 'voice', label: 'Voice', icon: Mic },
  { value: 'profile', label: 'Profile', icon: User },
]

const EFFECTS: WaterOption<Exclude<WaterEffect, 'none'>>[] = [
  { value: 'bounce', label: 'Bounce' },
  { value: 'splash', label: 'Splash' },
]

const PERIODS: WaterOption<string>[] = [
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
  { value: '1y', label: '1년' },
]

const VIEWS: WaterOption<string>[] = [
  { value: 'board', label: '보드', icon: Briefcase },
  { value: 'list', label: '목록', icon: CreditCard },
  { value: 'chart', label: '차트', icon: TrendingUp },
]

const STAGES: WaterOption<string>[] = [
  { value: 'all', label: '전체' },
  { value: 'todo', label: '할 일' },
  { value: 'doing', label: '진행 중' },
  { value: 'done', label: '끝남' },
]

// 사진 견본 — 밖에서 받지 않게 그림을 바로 넣는다
const PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23f2c6a0'/%3E%3Cstop offset='1' stop-color='%23b77b5a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='40' height='40' fill='%237d8fa6'/%3E%3Ccircle cx='20' cy='16' r='8' fill='url(%23g)'/%3E%3Cpath d='M6 40c2-9 8-13 14-13s12 4 14 13z' fill='%23384a63'/%3E%3C/svg%3E"

/** 기본 부품 — 단추·고르기·입력(D7 물 디자인) */
export function ControlsSection() {
  return (
    <>
      <SegmentedSpecs />
      <ButtonSpecs />
      <ToggleSpecs />
      <InputSpecs />
      <DisplaySpecs />
      <DialogSpecs />
    </>
  )
}

function SegmentedSpecs() {
  const [d7, setD7] = useState('profile')
  const [effect, setEffect] = useState<Exclude<WaterEffect, 'none'>>('bounce')
  const [period, setPeriod] = useState('30d')
  const [sm, setSm] = useState('7d')
  const [lg, setLg] = useState('90d')
  const [view, setView] = useState('board')
  const [stage, setStage] = useState('all')
  const [quiet, setQuiet] = useState('todo')
  const label = D7_ITEMS.find((o) => o.value === d7)?.label
  return (
    <WaterSection title="고르기" note="WaterSegmented — D7 펼친 메뉴. 누르거나 ←→·Home·End로 골라 보세요">
      <WaterSpec
        name="<WaterSegmented iconOnly groove>"
        note="D7 그대로 — 위 칩으로 물방울 효과를 바꾼다"
        wide
        spec="segmented-d7"
      >
        <div className="water-demo__d7">
          <WaterChips options={EFFECTS} value={effect} onChange={setEffect} ariaLabel="물방울 효과" />
          <WaterSegmented
            options={D7_ITEMS}
            value={d7}
            onChange={setD7}
            ariaLabel="메뉴"
            size="lg"
            iconOnly
            groove
            effect={effect}
          />
          <p className="water-demo__label" aria-live="polite">
            {label}
          </p>
        </div>
      </WaterSpec>
      <WaterSpec name="<WaterSegmented>" note="기본 md · bounce" spec="segmented">
        <WaterSegmented options={PERIODS} value={period} onChange={setPeriod} ariaLabel="기간" />
      </WaterSpec>
      <WaterSpec name='size="sm" · "lg"' note="표시 알약 26 · 40px — 물방울도 같은 비로 준다" spec="segmented-sizes">
        <div className="water-demo__stack">
          <WaterSegmented options={PERIODS} value={sm} onChange={setSm} ariaLabel="기간(작게)" size="sm" />
          <WaterSegmented options={PERIODS} value={lg} onChange={setLg} ariaLabel="기간(크게)" size="lg" />
        </div>
      </WaterSpec>
      <WaterSpec name='effect="splash"' note="아이콘 + 글자" spec="segmented-splash">
        <WaterSegmented options={VIEWS} value={view} onChange={setView} ariaLabel="보기" effect="splash" />
      </WaterSpec>
      <WaterSpec name='effect="none"' note="표시 알약만 옮긴다" spec="segmented-none">
        <WaterSegmented options={STAGES} value={stage} onChange={setStage} ariaLabel="단계" effect="none" />
      </WaterSpec>
      <WaterSpec name="disabled" spec="segmented-disabled">
        <WaterSegmented options={STAGES} value={quiet} onChange={setQuiet} ariaLabel="단계(끔)" disabled />
      </WaterSpec>
      <WaterSpec
        name="<WaterChips>"
        note='D7 Bounce | Splash — 0.1s · <WaterSegmented variant="chips">도 같다'
        spec="chips"
      >
        <div className="water-demo__stack">
          <WaterChips options={STAGES} value={stage} onChange={setStage} ariaLabel="단계 칩" />
          <WaterChips options={PERIODS} value={sm} onChange={setSm} ariaLabel="기간 칩(작게)" size="sm" />
          <WaterSegmented
            variant="chips"
            options={PERIODS}
            value={lg}
            onChange={setLg}
            ariaLabel="기간 칩(크게)"
            size="lg"
          />
        </div>
      </WaterSpec>
      <WaterSpec name="<WaterChips> 상태" note="hover · 끔" spec="chips-states">
        <div className="water-demo__stack">
          <WaterChips
            options={EFFECTS}
            value="bounce"
            onChange={() => {}}
            ariaLabel="hover 견본"
            className="is-hover"
          />
          <WaterChips options={EFFECTS} value="splash" onChange={() => {}} ariaLabel="끔 견본" disabled />
        </div>
      </WaterSpec>
    </WaterSection>
  )
}

function ButtonSpecs() {
  const [busy, setBusy] = useState(false)
  const [bell, setBell] = useState(true)
  const startBusy = () => {
    setBusy(true)
    window.setTimeout(() => setBusy(false), 1800)
  }
  return (
    <WaterSection title="단추" note="누르면 출렁이며 줄고(wobble) 떼면 부풀며 돌아온다(swell)">
      <WaterSpec name="<WaterButton>" note="primary · ghost · glass · danger" spec="button">
        <div className="water-demo__row">
          <WaterButton icon={Plus}>새로 만들기</WaterButton>
          <WaterButton variant="ghost">취소</WaterButton>
          <WaterButton variant="glass" icon={Download}>
            내보내기
          </WaterButton>
          <WaterButton variant="danger" icon={Trash2}>
            지우기
          </WaterButton>
        </div>
      </WaterSpec>
      <WaterSpec name="상태" note="hover · 누름 · 끔 · 기다림" spec="button-states">
        <div className="water-demo__row">
          <WaterButton className="is-hover">hover</WaterButton>
          <WaterButton className="is-active">누름</WaterButton>
          <WaterButton disabled>끔</WaterButton>
          <WaterButton loading={busy} onClick={startBusy}>
            {busy ? '저장 중' : '저장'}
          </WaterButton>
          <WaterButton variant="ghost" className="is-hover">
            hover
          </WaterButton>
          <WaterButton variant="glass" disabled>
            끔
          </WaterButton>
        </div>
      </WaterSpec>
      <WaterSpec name='size="sm" · "md" · "lg"' spec="button-sizes">
        <div className="water-demo__row">
          <WaterButton size="sm">작게</WaterButton>
          <WaterButton size="md">보통</WaterButton>
          <WaterButton size="lg">크게</WaterButton>
          <WaterButton size="sm" variant="ghost">
            작게
          </WaterButton>
          <WaterButton size="lg" variant="glass">
            크게
          </WaterButton>
        </div>
      </WaterSpec>
      <WaterSpec name="<WaterIconButton>" note="D7 접힌 버튼을 32 · 38 · 44px로 — 누름은 5% 출렁" spec="icon-button">
        <div className="water-demo__row">
          <WaterIconButton icon={Search} label="찾기" size="sm" />
          <WaterIconButton icon={Settings} label="설정" />
          <WaterIconButton icon={Plus} label="더하기" size="lg" />
          <WaterIconButton icon={Bell} label="알림 받기" pressed={bell} onClick={() => setBell((v) => !v)} />
          <WaterIconButton icon={Trash2} label="지우기(끔)" disabled />
        </div>
      </WaterSpec>
    </WaterSection>
  )
}

function ToggleSpecs() {
  const [on, setOn] = useState(true)
  const [off, setOff] = useState(false)
  const [small, setSmall] = useState(true)
  const [checks, setChecks] = useState({ a: true, b: false })
  const [radio, setRadio] = useState('week')
  const all = checks.a && checks.b
  const some = checks.a !== checks.b
  return (
    <WaterSection title="켜기 · 고르기" note="스위치 손잡이는 표시 알약처럼 스프링·늘어남으로 오간다">
      <WaterSpec name="<WaterSwitch>" note="켬 · 끔 · 작게 · 끔(못 바꿈)" spec="switch">
        <div className="water-demo__stack">
          <WaterSwitch checked={on} onChange={setOn} label="알림 받기" />
          <WaterSwitch checked={off} onChange={setOff} label="주말에도 받기" />
          <WaterSwitch checked={small} onChange={setSmall} label="작게" size="sm" />
          <WaterSwitch checked onChange={() => {}} label="관리자만 바꿀 수 있어요" disabled />
        </div>
      </WaterSpec>
      <WaterSpec name="<WaterCheck>" note="고르면 어두운 알약이 차오르고 흰 체크가 나타난다" spec="check">
        <div className="water-demo__stack">
          <WaterCheck
            label="모두"
            checked={all}
            indeterminate={some}
            onChange={() => setChecks(all ? { a: false, b: false } : { a: true, b: true })}
          />
          <WaterCheck
            label="기술팀"
            checked={checks.a}
            onChange={(e) => setChecks((c) => ({ ...c, a: e.target.checked }))}
          />
          <WaterCheck
            label="영업팀"
            checked={checks.b}
            onChange={(e) => setChecks((c) => ({ ...c, b: e.target.checked }))}
          />
          <WaterCheck label="못 바꿈" checked disabled readOnly />
          <WaterCheck label="작게" size="sm" defaultChecked />
        </div>
      </WaterSpec>
      <WaterSpec name="<WaterRadio>" note="같은 name이면 화살표로 옮겨 고른다" spec="radio">
        <div className="water-demo__stack" role="radiogroup" aria-label="보고 주기">
          {[
            { value: 'day', label: '매일' },
            { value: 'week', label: '매주' },
            { value: 'month', label: '매달' },
          ].map((o) => (
            <WaterRadio
              key={o.value}
              name="water-demo-period"
              value={o.value}
              label={o.label}
              checked={radio === o.value}
              onChange={() => setRadio(o.value)}
            />
          ))}
          <WaterRadio name="water-demo-off" label="못 고름" disabled />
        </div>
      </WaterSpec>
    </WaterSection>
  )
}

function InputSpecs() {
  const [name, setName] = useState('')
  const [mail, setMail] = useState('team@')
  const [blur, setBlur] = useState(22)
  const [tint, setTint] = useState(46)
  const mailError =
    mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) ? '메일 주소 꼴이 아니에요(예: team@xtool.com)' : null
  return (
    <WaterSection title="입력" note="얕은 유리 — 초점이 오면 흰 고리">
      <WaterSpec name="<WaterTextField>" note="기본 · 아이콘 · 도움말" spec="text-field">
        <div className="water-demo__stack water-demo__wide">
          <WaterTextField label="이름" placeholder="홍길동" value={name} onChange={(e) => setName(e.target.value)} />
          <WaterTextField label="찾기" placeholder="보드·사람·파일" icon={Search} hint="두 글자부터 찾아요" />
        </div>
      </WaterSpec>
      <WaterSpec name="오류 · 끔" spec="text-field-states">
        <div className="water-demo__stack water-demo__wide">
          <WaterTextField
            label="메일"
            type="email"
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            error={mailError}
            hint="회사 메일로 적어 주세요"
          />
          <WaterTextField label="팀" value="기술팀" disabled readOnly />
        </div>
      </WaterSpec>
      <WaterSpec name="<WaterRange>" note="끌기 · ←→ · PageUp/Down · Home/End" spec="range">
        <div className="water-demo__stack water-demo__wide">
          <WaterRange
            label="흐림"
            value={blur}
            min={0}
            max={40}
            format={(v) => `${v}px`}
            onChange={setBlur}
            hint="유리 뒤 배경을 흐리게"
          />
          <WaterRange label="농도" value={tint} min={0} max={100} step={2} format={(v) => `${v}%`} onChange={setTint} />
          <WaterRange
            label="못 바꿈"
            value={60}
            min={0}
            max={100}
            format={(v) => `${v}%`}
            onChange={() => {}}
            disabled
          />
        </div>
      </WaterSpec>
    </WaterSection>
  )
}

function DisplaySpecs() {
  return (
    <WaterSection title="표시" note="색은 점·구슬에만 — 글자는 잉크색">
      <WaterSpec name="<WaterStatusPill>" note="good · warn · crit · info · neutral · pulse" spec="status-pill">
        <div className="water-demo__row">
          <WaterStatusPill tone="good" dot>
            정상
          </WaterStatusPill>
          <WaterStatusPill tone="warn" dot>
            주의
          </WaterStatusPill>
          <WaterStatusPill tone="crit" dot>
            위험
          </WaterStatusPill>
          <WaterStatusPill tone="info" dot>
            안내
          </WaterStatusPill>
          <WaterStatusPill tone="neutral">보관</WaterStatusPill>
          <WaterStatusPill tone="good" dot="pulse">
            Live
          </WaterStatusPill>
        </div>
      </WaterSpec>
      <WaterSpec name="<WaterAvatar>" note="xs · sm · md · 사진" spec="avatar">
        <div className="water-demo__row">
          <WaterAvatar initials="강" color="#5b7fb8" size="xs" />
          <WaterAvatar initials="DL" color="#5b7fb8" />
          <WaterAvatar initials="MJ" color="#3c8a63" size="md" />
          <WaterAvatar initials="SK" color="#c08a2e" size="md" />
          <WaterAvatar initials="HY" color="#e3c86d" ink="#3f3e43" size="md" />
          <WaterAvatar initials="P" color="#7d8fa6" size="md" photo={PHOTO} />
        </div>
      </WaterSpec>
    </WaterSection>
  )
}

function DialogSpecs() {
  const [open, setOpen] = useState<'danger' | 'primary' | null>(null)
  const [done, setDone] = useState('')
  return (
    <WaterSection title="대화상자" note="D7 펼침처럼 열리고 접힘처럼 닫힌다 — Esc·바깥 누르기·Tab 가두기">
      <WaterSpec name="<WaterDialog>" note='tone="danger" · "primary"' spec="dialog">
        <div className="water-demo__row">
          <WaterButton variant="danger" icon={Trash2} onClick={() => setOpen('danger')}>
            보드 지우기
          </WaterButton>
          <WaterButton variant="glass" onClick={() => setOpen('primary')}>
            보내기 확인
          </WaterButton>
          {done && <span className="water-demo__caption">{done}</span>}
        </div>
        <WaterDialog
          open={open === 'danger'}
          title="이 보드를 지울까요?"
          message="보드와 안의 카드 128장이 모두 지워져요. 되돌릴 수 없어요."
          confirmLabel="지우기"
          onConfirm={() => {
            setOpen(null)
            setDone('지웠어요(견본)')
          }}
          onCancel={() => setOpen(null)}
        />
        <WaterDialog
          open={open === 'primary'}
          tone="primary"
          title="보고서를 보낼까요?"
          message="기술팀 12명에게 이번 주 보고서를 메일로 보내요."
          confirmLabel="보내기"
          cancelLabel="나중에"
          onConfirm={() => {
            setOpen(null)
            setDone('보냈어요(견본)')
          }}
          onCancel={() => setOpen(null)}
        />
      </WaterSpec>
    </WaterSection>
  )
}
