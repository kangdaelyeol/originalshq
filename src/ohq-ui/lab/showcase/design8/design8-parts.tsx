import type { CSSProperties, ReactNode } from 'react'
import photo from '../../assets/design8/living-room.webp'
import { SidebarPreview } from './glass-sidebar'
import { SidebarBadge } from './sidebar-badge'
import { D8_ALL_ITEMS, D8_DOCK, D8_EXPAND, D8_PILL, D8_TOOLTIP } from './sidebar-data'
import { NightSwitch, SidebarProfile } from './sidebar-footer'
import { SidebarLogo } from './sidebar-logo'
import { SidebarNavItem } from './sidebar-nav-item'
import { SidebarSearch } from './sidebar-search'
import { SidebarSection } from './sidebar-section'
import { SidebarSubList } from './sidebar-sub-list'
import { TooltipBubble } from './sidebar-tooltip'

const item = (key: string) => D8_ALL_ITEMS.find((i) => i.key === key)!

/** 부품 칸 — 사진 일부(at: 장면 em 좌표) 위에 부품을 놓고 이름을 단다 */
function Part({ name, note, at, children }: { name: string; note: string; at: [number, number]; children: ReactNode }) {
  const style = {
    backgroundImage: `url(${photo})`,
    backgroundPosition: `${-at[0]}em ${-at[1]}em`,
  } as CSSProperties
  return (
    <figure className="d8-part">
      <div className="d8-part__view" style={style}>
        {children}
      </div>
      <figcaption className="d8-part__name">
        <code>{name}</code> {note}
      </figcaption>
    </figure>
  )
}

const fmtEase = (e: unknown) => (Array.isArray(e) ? `cubic-bezier(${e.join(', ')})` : String(e))

/** Design 8 부품 진열 — 부품 하나하나와 상태, 잰 값 */
export function Design8Parts() {
  return (
    <div className="d8-parts">
      <Part name="<SidebarNavItem>" note="펼침 · 기본 / hover / 끝 표시 3가지" at={[19, 36]}>
        <SidebarPreview expanded>
          <div className="d8-list d8-list--still">
            <SidebarNavItem item={item('wallet')} />
            <SidebarNavItem item={item('activity')} forceHover />
            <SidebarNavItem item={item('messages')} />
            <SidebarNavItem item={item('schedule')} />
          </div>
        </SidebarPreview>
      </Part>

      <Part name="<SelectionPill>" note="고른 줄 뒤 유리 알약 · 접히면 원" at={[19, 22]}>
        <div className="d8-part__row">
          <SidebarPreview expanded width={22}>
            <div className="d8-list d8-list--still">
              <span className="d8-pill d8-pill--still" aria-hidden="true" />
              <SidebarNavItem item={item('dashboard')} selected />
            </div>
          </SidebarPreview>
          <SidebarPreview expanded={false}>
            <div className="d8-list d8-list--still">
              <span className="d8-pill d8-pill--still" aria-hidden="true" />
              <SidebarNavItem item={item('dashboard')} selected />
            </div>
          </SidebarPreview>
        </div>
      </Part>

      <Part name="<SidebarNavItem>" note="접힘 · 아이콘 위 빨간 점" at={[28, 30]}>
        <SidebarPreview expanded={false}>
          <div className="d8-list d8-list--still">
            <SidebarNavItem item={item('activity')} />
            <SidebarNavItem item={item('schedule')} />
            <SidebarNavItem item={item('messages')} />
          </div>
        </SidebarPreview>
      </Part>

      <Part name="<SidebarSearch>" note="펼침 칸 / 접힘 돋보기" at={[19, 8]}>
        <div className="d8-part__row">
          <SidebarPreview expanded width={26}>
            <SidebarSearch />
          </SidebarPreview>
          <SidebarPreview expanded={false}>
            <SidebarSearch />
          </SidebarPreview>
        </div>
      </Part>

      <Part name="<SidebarSection>" note="섹션 이름 / 접힘 구분선" at={[19, 40]}>
        <div className="d8-part__row">
          <SidebarPreview expanded width={20}>
            <SidebarSection label="Workspace" />
          </SidebarPreview>
          <SidebarPreview expanded={false}>
            <SidebarSection label="Workspace" />
          </SidebarPreview>
        </div>
      </Part>

      <Part name="<SidebarSubList>" note="줄기·가지·색 점" at={[19, 55]}>
        <SidebarPreview expanded width={24}>
          <SidebarSubList items={item('projects').children!} open />
        </SidebarPreview>
      </Part>

      <Part name="<SidebarTooltip>" note="말풍선 · 칩 있음/없음" at={[36, 30]}>
        <div className="d8-part__tips">
          <TooltipBubble label="Dashboard" />
          <TooltipBubble label="Search" chip="⌘K" />
          <TooltipBubble label="Activity" chip="12" />
          <TooltipBubble label="Expand" chip="[" />
        </div>
      </Part>

      <Part name="<NightSwitch> · <SidebarBadge>" note="꺼짐 / 켜짐 · 12 / 3 / 점" at={[40, 76]}>
        <div className="d8-part__row d8-part__row--center">
          <NightSwitch on={false} />
          <NightSwitch on />
          <span className="d8-part__badges">
            <SidebarBadge badge={{ kind: 'count', value: '12' }} />
            <SidebarBadge badge={{ kind: 'alert', value: '3' }} />
            <SidebarBadge badge={{ kind: 'dot' }} />
          </span>
        </div>
      </Part>

      <Part name="<SidebarProfile> · <SidebarLogo>" note="펼침 / 접힘" at={[19, 80]}>
        <div className="d8-part__row">
          <SidebarPreview expanded width={26}>
            <SidebarProfile />
          </SidebarPreview>
          <SidebarPreview expanded={false}>
            <div className="d8-part__logo">
              <SidebarLogo />
            </div>
          </SidebarPreview>
        </div>
      </Part>

      <dl className="d8-measured">
        <div>
          <dt>펼침·접힘</dt>
          <dd>
            폭 7.8→32.6em {fmtEase(D8_EXPAND.width.ease)} {D8_EXPAND.width.duration}s · 높이(하위 메뉴){' '}
            {fmtEase(D8_EXPAND.height.ease)} {D8_EXPAND.height.duration}s · 글자 {D8_EXPAND.labelsIn.delay}s 뒤{' '}
            {D8_EXPAND.labelsIn.duration}s
          </dd>
        </div>
        <div>
          <dt>독 확대</dt>
          <dd>
            거리 {D8_DOCK.range}em 삼각형 · 높이 +{D8_DOCK.grow.item}em(검색 +{D8_DOCK.grow.search}em) · 아이콘 ×
            {1 + D8_DOCK.iconScale} · 스프링 {D8_DOCK.spring.stiffness}/{D8_DOCK.spring.damping}
          </dd>
        </div>
        <div>
          <dt>선택 알약</dt>
          <dd>
            앞 {D8_PILL.lead.stiffness}/{D8_PILL.lead.damping} · 뒤 {D8_PILL.trail.stiffness}/{D8_PILL.trail.damping}{' '}
            {D8_PILL.trail.delay}s 늦게
          </dd>
        </div>
        <div>
          <dt>툴팁</dt>
          <dd>
            세로 스프링 {D8_TOOLTIP.ySpring.stiffness}/{D8_TOOLTIP.ySpring.damping} · 나타남 {D8_TOOLTIP.enter.duration}s ·
            사라짐 {D8_TOOLTIP.exit.duration}s
          </dd>
        </div>
        <div>
          <dt>유리</dt>
          <dd>backdrop blur 18px · saturate 1.6 · 위 흰빛 8.5%→0 · 그림자 0 50px 70px −36px 50%</dd>
        </div>
      </dl>
    </div>
  )
}
