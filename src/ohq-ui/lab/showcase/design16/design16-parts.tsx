import { Bell, Download, Package, Plus, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import { Avatar } from './avatar'
import { BoardLane } from './board-lane'
import { BrandBadge } from './brand-badge'
import { CompareToggle } from './compare-toggle'
import { D16_ITEM_ICONS, D16_NAV_ICONS } from './d16-icons'
import {
  D16_BRAND,
  D16_GOAL,
  D16_KPIS,
  D16_LANES,
  D16_LIVE,
  D16_NAV,
  D16_ORDER_BY_ID,
  D16_ORDER_FILTERS,
  D16_PART_ORBS,
  D16_RANGE_KEYS,
  D16_RANGES,
  D16_SOURCES,
  D16_SOURCES_SUB,
  D16_STOCK,
  D16_USER,
  D16_VISITOR_BARS,
  type ItemKind,
  type OrderStatus,
  type RangeKey,
  type Tone,
} from './design16-data'
import { DeltaChip } from './delta-chip'
import { FilterChips } from './filter-chips'
import { GlassPanel } from './glass-panel'
import { GoalCard } from './goal-card'
import { GoalRing } from './goal-ring'
import { IconButton } from './icon-button'
import { ItemThumb } from './item-thumb'
import { KpiStat } from './kpi-stat'
import { LiveDot } from './live-dot'
import { LiveStoreCard } from './live-store-card'
import { MiniBars } from './mini-bars'
import { NavItem } from './nav-item'
import { OrbBackdrop } from './orb-backdrop'
import { OrderCard } from './order-card'
import { PackingBoard } from './packing-board'
import { PillButton } from './pill-button'
import { RangeControl } from './range-control'
import { RunningLowCard } from './running-low-card'
import { SalesChart } from './sales-chart'
import { SalesSourcesCard } from './sales-sources-card'
import { SearchField } from './search-field'
import { SelectPill } from './select-pill'
import { ShareBar } from './share-bar'
import { SideNav } from './side-nav'
import { Sparkline } from './sparkline'
import { StatusPill } from './status-pill'
import { StockBar } from './stock-bar'
import { TabBar } from './tab-bar'
import { Toast } from './toast'
import { ToggleSwitch } from './toggle-switch'
import { TourCursor } from './tour-cursor'
import { UserChip } from './user-chip'

const TONES: Tone[] = ['blue', 'teal', 'green', 'amber', 'red', 'grey']
const KINDS = Object.keys(D16_ITEM_ICONS) as ItemKind[]

/** 기간 고르기 + 비교 단추 + 차트(눌러 보기) */
function RangeDemo() {
  const [range, setRange] = useState<RangeKey>('30D')
  const [compare, setCompare] = useState(true)
  return (
    <div className="d16-part__stack">
      <div className="d16-part__inline">
        <CompareToggle label={D16_RANGES[range].compareLabel} on={compare} onToggle={() => setCompare((c) => !c)} />
        <RangeControl options={D16_RANGE_KEYS} value={range} onChange={setRange} />
      </div>
      <GlassPanel className="d16-part__chart">
        <SalesChart range={D16_RANGES[range]} compare={compare} />
      </GlassPanel>
    </div>
  )
}

/** 사이드바 혼자 — 줄을 누르면 표시가 늘어나며 옮겨 간다 */
function SideNavDemo() {
  const [active, setActive] = useState('orders')
  const [dark, setDark] = useState(true)
  return (
    <SideNav
      brand={D16_BRAND}
      user={D16_USER}
      sections={D16_NAV}
      active={active}
      onNavigate={setActive}
      toPack={2}
      dark={dark}
      onDarkChange={setDark}
    />
  )
}

/** 탭·걸러보기(눌러 보기) */
function NavDemo() {
  const [tab, setTab] = useState<'all' | 'board'>('board')
  const [chip, setChip] = useState('to-pack')
  return (
    <div className="d16-part__stack">
      <TabBar
        tabs={[
          { key: 'all', label: 'All orders' },
          { key: 'board', label: 'Packing board', count: 3 },
        ]}
        value={tab}
        onChange={setTab}
        underlineDelay={null}
      />
      <FilterChips chips={D16_ORDER_FILTERS.slice(0, 4)} value={chip} onChange={setChip} />
    </div>
  )
}

/** 레인 둘짜리 칸반 — 혼자서도 끌어 놓기가 된다 */
function MiniBoard() {
  const floatRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState<Record<OrderStatus, string[]>>({
    'to-pack': ['KL-49958', 'KL-49957'],
    packed: ['KL-49949'],
    shipped: [],
    delivered: [],
  })
  return (
    <div className="d16-part__board">
      <PackingBoard
        lanes={[D16_LANES[0], { ...D16_LANES[3], hidden: 0 }]}
        columns={cols}
        intro={false}
        floatLayer={floatRef}
        onMove={(id, from, to) =>
          setCols((c) => ({ ...c, [from]: c[from].filter((x) => x !== id), [to]: [id, ...c[to]] }))
        }
      />
      <div className="d16-float" ref={floatRef} />
    </div>
  )
}

/** 부품 견본 — 장면 아래에 부품마다 따로(1em 대신 --d16-px = 1.3~1.6px) */
export function Design16Parts() {
  const card = D16_ORDER_BY_ID['KL-49959']
  return (
    <div className="d16-parts">
      <section className="d16-part">
        <p className="d16-part__name">
          <code>{'<OrbBackdrop orbs>'}</code> · <code>{'<GlassPanel tone hot>'}</code> 공 위의 유리 — panel · float ·
          hot
        </p>
        <div className="d16-part__row">
          <figure>
            <div className="d16-part__well d16-part__well--glass">
              <OrbBackdrop orbs={D16_PART_ORBS} />
              <GlassPanel className="d16-part__glass">panel</GlassPanel>
              <GlassPanel tone="float" className="d16-part__glass">
                float
              </GlassPanel>
              <GlassPanel hot className="d16-part__glass">
                hot
              </GlassPanel>
            </div>
            <figcaption>orbs 3 · 흐림 --d16-blur</figcaption>
          </figure>
        </div>
      </section>

      <section className="d16-part">
        <p className="d16-part__name">
          <code>{'<SideNav active intro>'}</code> · <code>{'<NavItem>'}</code> · <code>{'<ToggleSwitch>'}</code> ·{' '}
          <code>{'<UserChip>'}</code> · <code>{'<BrandBadge>'}</code>
        </p>
        <div className="d16-part__row">
          <figure>
            <div className="d16-part__well d16-part__well--side">
              <OrbBackdrop orbs={[{ x: 30, y: 250, r: 90, tone: 'blue' }]} />
              <SideNavDemo />
            </div>
            <figcaption>active=&quot;orders&quot; · 줄을 눌러 보세요(표시가 늘어나며 옮겨요)</figcaption>
          </figure>
          <figure>
            <div className="d16-part__well d16-part__well--bits">
              <BrandBadge name={D16_BRAND.name} shop={D16_BRAND.shop} />
              <NavItem icon={D16_NAV_ICONS.analytics} label="Analytics" />
              <NavItem icon={D16_NAV_ICONS.chats} label="Chats" badge={3} filled active />
              <div className="d16-part__inline">
                <ToggleSwitch checked label="on" bare />
                <ToggleSwitch checked={false} label="off" bare />
              </div>
              <UserChip {...D16_USER} />
            </div>
            <figcaption>filled · badge · on/off</figcaption>
          </figure>
        </div>
      </section>

      <section className="d16-part">
        <p className="d16-part__name">
          <code>{'<RangeControl>'}</code> · <code>{'<CompareToggle>'}</code> ·{' '}
          <code>{'<SalesChart range compare>'}</code> 눌러서 기간을 바꾸면 선이 다시 그려져요
        </p>
        <div className="d16-part__row">
          <figure>
            <div className="d16-part__well d16-part__well--chart">
              <RangeDemo />
            </div>
            <figcaption>30D에서 시작 · 비교 끄기</figcaption>
          </figure>
        </div>
      </section>

      <section className="d16-part">
        <p className="d16-part__name">
          <code>{'<KpiStat>'}</code> · <code>{'<DeltaChip down>'}</code> · <code>{'<Sparkline>'}</code> ·{' '}
          <code>{'<GoalRing value>'}</code> · <code>{'<MiniBars>'}</code> · <code>{'<ShareBar>'}</code> ·{' '}
          <code>{'<StockBar>'}</code>
        </p>
        <div className="d16-part__row">
          <figure>
            <div className="d16-part__well d16-part__well--kpi">
              <KpiStat {...D16_KPIS[2]} />
              <KpiStat label="Refunds" value={182} format="usd" delta="12%" note="vs last week" down />
            </div>
            <figcaption>spark · down</figcaption>
          </figure>
          <figure>
            <div className="d16-part__well d16-part__well--rings">
              <GoalRing value={0.01} label="1%" sub="of $24k" />
              <GoalRing value={0.42} label="42%" sub="of $24k" />
              <GoalRing value={1} label="100%" sub="done" />
            </div>
            <figcaption>value 0.01 · 0.42 · 1</figcaption>
          </figure>
          <figure>
            <div className="d16-part__well d16-part__well--mini">
              <MiniBars values={D16_VISITOR_BARS} />
              <Sparkline values={[2, 5, 3, 8, 6, 9, 4, 7]} width={60} height={14} />
              <ShareBar parts={D16_SOURCES} />
              <div className="d16-part__inline">
                <StockBar left={0} reorder={40} />
                <StockBar left={9} reorder={20} />
                <StockBar left={17} reorder={20} />
                <DeltaChip value="6%" down />
              </div>
            </div>
            <figcaption>bars 24 · 몫 4 · 재고 0 / 45 / 85%</figcaption>
          </figure>
        </div>
      </section>

      <section className="d16-part">
        <p className="d16-part__name">
          <code>{'<PillButton variant>'}</code> · <code>{'<IconButton badge>'}</code> · <code>{'<SearchField>'}</code> ·{' '}
          <code>{'<SelectPill>'}</code> · <code>{'<TabBar>'}</code> · <code>{'<FilterChips>'}</code> ·{' '}
          <code>{'<StatusPill tone>'}</code> · <code>{'<Avatar>'}</code> · <code>{'<ItemThumb kind>'}</code> ·{' '}
          <code>{'<LiveDot>'}</code>
        </p>
        <div className="d16-part__row">
          <figure>
            <div className="d16-part__well d16-part__well--controls">
              <div className="d16-part__inline">
                <PillButton icon={Plus}>Create</PillButton>
                <PillButton variant="glass" icon={Download}>
                  Export
                </PillButton>
                <PillButton variant="quiet" size="sm" icon={Package}>
                  Packed
                </PillButton>
                <IconButton icon={Search} label="Search" />
                <IconButton icon={Bell} label="Notifications" badge={3} />
              </div>
              <div className="d16-part__inline">
                <SearchField placeholder="Search..." kbd="⌘K" />
                <SelectPill label="All channels" />
              </div>
              <NavDemo />
            </div>
            <figcaption>accent · glass · quiet</figcaption>
          </figure>
          <figure>
            <div className="d16-part__well d16-part__well--tags">
              <div className="d16-part__inline">
                {TONES.map((tone) => (
                  <StatusPill key={tone} tone={tone}>
                    {tone}
                  </StatusPill>
                ))}
              </div>
              <div className="d16-part__inline">
                {['SM', 'YM', 'TN', 'AN', 'EH'].map((ini, i) => (
                  <Avatar key={ini} initials={ini} hue={[42, 350, 170, 210, 30][i]} size={12} />
                ))}
                <Avatar initials="NH" size={12} />
              </div>
              <div className="d16-part__inline">
                {KINDS.map((kind) => (
                  <ItemThumb key={kind} kind={kind} size={11} />
                ))}
                <LiveDot />
                <LiveDot tone="amber" />
                <LiveDot tone="blue" pulse={false} />
              </div>
            </div>
            <figcaption>tone 6 · kind 5</figcaption>
          </figure>
        </div>
      </section>

      <section className="d16-part">
        <p className="d16-part__name">
          <code>{'<GoalCard>'}</code> · <code>{'<LiveStoreCard>'}</code> · <code>{'<RunningLowCard>'}</code> ·{' '}
          <code>{'<SalesSourcesCard>'}</code>
        </p>
        <div className="d16-part__row">
          <figure>
            <div className="d16-part__well d16-part__well--cards">
              <OrbBackdrop
                orbs={[
                  { x: 150, y: 20, r: 60, tone: 'orange' },
                  { x: 300, y: 230, r: 70, tone: 'cyan' },
                  { x: 40, y: 220, r: 40, tone: 'green' },
                ]}
              />
              <GoalCard {...D16_GOAL} pct={0.42} sub="12 days to go" />
              <LiveStoreCard {...D16_LIVE} bars={D16_VISITOR_BARS.slice().reverse()} count={51} />
              <RunningLowCard items={D16_STOCK} />
              <SalesSourcesCard sub={D16_SOURCES_SUB} sources={D16_SOURCES} />
            </div>
            <figcaption>pct 0.42 · count 51 · 재고 셋</figcaption>
          </figure>
        </div>
      </section>

      <section className="d16-part">
        <p className="d16-part__name">
          <code>{'<OrderCard state>'}</code> · <code>{'<BoardLane hot>'}</code> · <code>{'<PackingBoard>'}</code> ·{' '}
          <code>{'<Toast>'}</code> · <code>{'<TourCursor>'}</code> — 오른쪽 칸반은 카드를 끌어 놓을 수 있어요
        </p>
        <div className="d16-part__row">
          <figure>
            <div className="d16-part__well d16-part__well--cards2">
              <OrderCard order={card} />
              <OrderCard order={card} state="lifted" />
              <OrderCard order={card} state="ghost" />
            </div>
            <figcaption>rest · lifted · ghost(−2° · 1.04배)</figcaption>
          </figure>
          <figure>
            <div className="d16-part__well d16-part__well--lanes">
              <BoardLane col="packed" title="Packed" sub="Boxed, label printed" count={12} tone="blue" hot>
                <OrderCard order={D16_ORDER_BY_ID['KL-49956']} />
              </BoardLane>
              <BoardLane col="delivered" title="Delivered" sub="Since yesterday" count={0} tone="green" />
            </div>
            <figcaption>hot · 빈 레인</figcaption>
          </figure>
          <figure>
            <div className="d16-part__well d16-part__well--board">
              <MiniBoard />
            </div>
            <figcaption>끌어 놓기(영상 코드 그대로)</figcaption>
          </figure>
          <figure>
            <div className="d16-part__well d16-part__well--toast">
              <Toast message="KL-49959 · Packed" action="Undo" delay={null} />
              <Toast message="KL-49944 · Delivered" delay={null} />
              <TourCursor at={[150, 70]} ring />
            </div>
            <figcaption>action · 커서 누름 고리</figcaption>
          </figure>
        </div>
      </section>
    </div>
  )
}
