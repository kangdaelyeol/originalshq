// D16 데이터 — sample/design16-admin.mp4의 글자·숫자 그대로. 잘렸거나 안 읽힌 칸(주문 표 아래 줄, 6M·7D 범위,
// Market stall·Wholesale 금액 등)은 같은 모양으로 채웠다.
// 차트 값은 영상 선을 열마다 읽어 거꾸로 푼 것 — 30D 합 $23,514(부제와 같다), 마지막 7일 합 $6,413(KPI와 같다),
// 그 앞 7일 합 $6,078(+5.5%가 맞는다), 12M 합 $212,216·10월 $24,677(목표 카드와 같다).

export type PageKey = 'dashboard' | 'orders'
export type OrdersTab = 'all' | 'board' | 'returns'
export type RangeKey = '12M' | '6M' | '30D' | '7D'
export type OrderStatus = 'to-pack' | 'packed' | 'shipped' | 'delivered'
export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'grey' | 'teal'
export type ItemKind = 'green' | 'herbal' | 'oolong' | 'black' | 'ware'

// ── 사이드바 ─────────────────────────────────────────────────────────────
export type NavIcon =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'analytics'
  | 'customers'
  | 'finances'
  | 'invoices'
  | 'discounts'
  | 'chats'
  | 'email'
  | 'apps'
  | 'settings'

export interface NavItemData {
  key: string
  label: string
  icon: NavIcon
  /** 오른쪽 숫자 — 'to-pack'이면 포장할 주문 수를 따라간다 */
  badge?: number | 'to-pack'
  page?: PageKey
}

export interface NavSection {
  title?: string
  items: NavItemData[]
}

export const D16_NAV: NavSection[] = [
  {
    title: 'SHOP',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', page: 'dashboard' },
      { key: 'orders', label: 'Orders', icon: 'orders', badge: 'to-pack', page: 'orders' },
      { key: 'products', label: 'Products', icon: 'products', badge: 6 },
      { key: 'analytics', label: 'Analytics', icon: 'analytics' },
      { key: 'customers', label: 'Customers', icon: 'customers' },
    ],
  },
  {
    title: 'MONEY',
    items: [
      { key: 'finances', label: 'Finances', icon: 'finances' },
      { key: 'invoices', label: 'Invoices', icon: 'invoices' },
      { key: 'discounts', label: 'Discounts', icon: 'discounts' },
    ],
  },
  {
    title: 'TALK',
    items: [
      { key: 'chats', label: 'Chats', icon: 'chats', badge: 3 },
      { key: 'email', label: 'Email', icon: 'email', badge: 2 },
      { key: 'apps', label: 'Apps', icon: 'apps' },
    ],
  },
  { items: [{ key: 'settings', label: 'Settings', icon: 'settings' }] },
]

export const D16_BRAND = { name: 'Cirrel', shop: 'Kiln & Leaf' }
export const D16_USER = { name: 'Noor Haddad', email: 'noor@kilnandleaf.co', initials: 'NH' }
export const D16_TODAY = 'Sunday, November 1'
export const D16_GREETING = 'Good morning, Noor'

// ── 대시보드 KPI ─────────────────────────────────────────────────────────
export interface KpiData {
  label: string
  value: number
  /** 'usd' = $244 · 'int' = 6 */
  format: 'usd' | 'int'
  delta: string
  note: string
  spark?: readonly number[]
  size?: 'lg' | 'md'
}

/** Orders today 꼬마 선 — F30 x 413~464를 2.55px마다 읽은 높이(0 = 아래 끝) */
export const D16_ORDERS_SPARK = [0, 0, 1, 3, 6, 5, 4, 3.5, 2, 2, 2, 5, 8, 5, 2, 2, 3, 5, 6, 2, 0] as const

export const D16_KPIS: KpiData[] = [
  { label: 'Today so far', value: 244, format: 'usd', delta: '135%', note: 'vs last Sunday' },
  { label: 'Last 7 days', value: 6413, format: 'usd', delta: '5.5%', note: 'vs the week before', size: 'md' },
  {
    label: 'Orders today',
    value: 6,
    format: 'int',
    delta: '200%',
    note: 'vs last Sunday',
    spark: D16_ORDERS_SPARK,
    size: 'md',
  },
]

// ── Sales studio 차트 ────────────────────────────────────────────────────
export interface RangeData {
  key: RangeKey
  /** 맨 위 눈금 값(아래는 0) — 눈금 다섯 줄 */
  top: number
  ticks: readonly string[]
  /** 아래 글자 — i: 몇째 점 */
  xLabels: readonly { i: number; text: string }[]
  series: readonly number[]
  compare: readonly number[]
  compareLabel: string
  total: string
  change: string
  /** 변화가 좋은 쪽이면 초록, 아니면 빨강 */
  up: boolean
}

const M12 = [16885, 15346, 14559, 13910, 14970, 16542, 15243, 15756, 16611, 22867, 24850, 24677]
// 지난해 점선 — F30 점선을 읽은 높이(11월 $11.8k → 7월 $16.8k → 10월 $14k), 합 $165,794(= +28%)
const M12_PREV = [11800, 12250, 12300, 12600, 13250, 13550, 13750, 14750, 16750, 15750, 15050, 13994]
const D30 = [
  682, 679, 602, 499, 1419, 834, 426, 491, 891, 538, 650, 438, 621, 591, 636, 1026, 533, 431, 769, 1345, 1109, 1041,
  850, 691, 1544, 870, 735, 1255, 1074, 244,
]
const D30_PREV = [
  1088, 835, 989, 1058, 732, 664, 545, 818, 932, 1006, 1297, 767, 801, 887, 511, 870, 613, 1143, 562, 818, 579, 630,
  613, 750, 818, 1639, 613, 1023, 596, 818,
]
const TICKS_K = ['$40k', '$30k', '$20k', '$10k', '$0']
const TICKS_D = ['$2,000', '$1,500', '$1,000', '$500', '$0']

export const D16_RANGES: Record<RangeKey, RangeData> = {
  '12M': {
    key: '12M',
    top: 40000,
    ticks: TICKS_K,
    xLabels: [
      { i: 0, text: 'Nov' },
      { i: 2, text: 'Jan' },
      { i: 4, text: 'Mar' },
      { i: 6, text: 'May' },
      { i: 8, text: 'Jul' },
      { i: 11, text: 'Oct' },
    ],
    series: M12,
    compare: M12_PREV,
    compareLabel: 'Last year',
    total: '$212,216',
    change: '+28%',
    up: true,
  },
  '6M': {
    key: '6M',
    top: 40000,
    ticks: TICKS_K,
    xLabels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((text, i) => ({ i, text })),
    series: M12.slice(6),
    compare: M12.slice(0, 6),
    compareLabel: 'Previous',
    total: '$120,004',
    change: '+30%',
    up: true,
  },
  '30D': {
    key: '30D',
    top: 2000,
    ticks: TICKS_D,
    xLabels: [
      { i: 0, text: 'Oct 3' },
      { i: 4, text: 'Oct 7' },
      { i: 8, text: 'Oct 11' },
      { i: 12, text: 'Oct 15' },
      { i: 16, text: 'Oct 19' },
      { i: 20, text: 'Oct 23' },
      { i: 24, text: 'Oct 27' },
      { i: 29, text: 'Nov 1' },
    ],
    series: D30,
    compare: D30_PREV,
    compareLabel: 'Previous',
    total: '$23,514',
    change: '−6%',
    up: false,
  },
  '7D': {
    key: '7D',
    top: 2000,
    ticks: TICKS_D,
    xLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((text, i) => ({ i, text })),
    series: D30.slice(-7),
    compare: D30.slice(-14, -7),
    compareLabel: 'Previous',
    total: '$6,413',
    change: '+5.5%',
    up: true,
  },
}

export const D16_RANGE_KEYS: readonly RangeKey[] = ['12M', '6M', '30D', '7D']

// ── 오른쪽 카드 ──────────────────────────────────────────────────────────
export const D16_GOAL = {
  title: 'November goal',
  sub: '29 days to go',
  pct: 0.01,
  of: 'of $24k',
  rows: [
    { label: 'Booked', value: '$244' },
    { label: 'Daily pace needed', value: '$792' },
    { label: 'October finished', value: '$24,677' },
  ],
}

/** 시간대별 방문 — F30 막대 24개 높이(영상 px, 가장 높은 것 17) */
export const D16_VISITOR_BARS = [7, 4, 8, 12, 14, 16, 17, 15, 13, 10, 7, 5, 9, 13, 15, 17, 17, 15, 13, 9, 5, 6, 10, 13]

export const D16_LIVE = {
  title: 'Live store',
  sub: 'Visitors right now',
  link: 'Visitors',
  count: 38,
  countNote: 'on the site',
  rows: [
    { label: 'Carts open', value: '8' },
    { label: 'Converting, 30 days', value: '2.5%' },
    { label: 'Top page', value: 'Ceremonial Matcha' },
  ],
  status: 'Checkout healthy',
}

// ── 아래 줄 카드 ─────────────────────────────────────────────────────────
export const D16_STOCK = [
  { name: 'Bergamot Grey', kind: 'black' as ItemKind, left: 0, reorder: 40 },
  { name: 'Milk Oolong', kind: 'oolong' as ItemKind, left: 9, reorder: 20 },
  { name: 'Jade Cloud Gyokuro', kind: 'green' as ItemKind, left: 14, reorder: 30 },
]

export interface SourceData {
  label: string
  tone: Tone
  pct: number
  value: string
}

export const D16_SOURCES: SourceData[] = [
  { label: 'Web store', tone: 'blue', pct: 64, value: '$15,007' },
  { label: 'Instagram', tone: 'amber', pct: 15, value: '$3,518' },
  { label: 'Market stall', tone: 'teal', pct: 4, value: '$919' },
  { label: 'Wholesale', tone: 'grey', pct: 17, value: '$4,071' },
]
export const D16_SOURCES_SUB = 'Last 30 days · $23,515'

// ── 주문 ─────────────────────────────────────────────────────────────────
export interface OrderItem {
  qty: number
  name: string
  kind: ItemKind
}

export interface OrderData {
  id: string
  customer: string
  initials: string
  city: string
  /** 아바타 바탕(파스텔) */
  hue: number
  items: OrderItem[]
  total: string
  channel: 'Web store' | 'Instagram' | 'Market stall' | 'Wholesale'
  placed: string
  /** 칸반 카드 오른쪽 위 */
  when: string
  status: OrderStatus | 'awaiting'
}

const it = (qty: number, name: string, kind: ItemKind): OrderItem => ({ qty, name, kind })

export const D16_ORDERS: OrderData[] = [
  {
    id: 'KL-49961',
    customer: 'Elijah Brennan',
    initials: 'EB',
    city: 'Oakland, CA',
    hue: 18,
    items: [it(1, 'Ash Glaze Kyusu', 'ware')],
    total: '$19.50',
    channel: 'Web store',
    placed: '36 min ago',
    when: '36 min ago',
    status: 'awaiting',
  },
  {
    id: 'KL-49960',
    customer: 'Ravi Iyer',
    initials: 'RI',
    city: 'Austin, TX',
    hue: 40,
    items: [it(1, 'Iron Goddess Oolong', 'oolong')],
    total: '$29.50',
    channel: 'Web store',
    placed: '42 min ago',
    when: '42 min ago',
    status: 'awaiting',
  },
  {
    id: 'KL-49959',
    customer: 'Sofia Moreno',
    initials: 'SM',
    city: 'Oakland, CA',
    hue: 42,
    items: [it(1, 'Morning Sencha', 'green'), it(1, 'Mint Garden', 'herbal')],
    total: '$37.50',
    channel: 'Web store',
    placed: '1 h ago',
    when: '1 h ago',
    status: 'to-pack',
  },
  {
    id: 'KL-49958',
    customer: 'Yara Moreno',
    initials: 'YM',
    city: 'Seattle, WA',
    hue: 350,
    items: [it(1, 'Stacking Cups, set of 4', 'ware'), it(1, 'Harbor Breakfast', 'black')],
    total: '$62.05',
    channel: 'Instagram',
    placed: '2 h ago',
    when: '2 h ago',
    status: 'to-pack',
  },
  {
    id: 'KL-49957',
    customer: 'June Hart',
    initials: 'JH',
    city: 'Tacoma, WA',
    hue: 220,
    items: [it(1, 'Toasted Genmaicha', 'green'), it(1, 'Sleepy Chamomile', 'herbal')],
    total: '$33.50',
    channel: 'Web store',
    placed: '3 h ago',
    when: '3 h ago',
    status: 'to-pack',
  },
  {
    id: 'KL-49956',
    customer: 'Theo Novak',
    initials: 'TN',
    city: 'Brooklyn, NY',
    hue: 170,
    items: [
      it(1, 'Toasted Genmaicha', 'green'),
      it(1, 'Milk Oolong', 'oolong'),
      it(1, 'Darjeeling Second Flush', 'black'),
    ],
    total: '$62.00',
    channel: 'Web store',
    placed: '3 h ago',
    when: '3 h ago',
    status: 'packed',
  },
  {
    id: 'KL-49949',
    customer: 'Amara Nguyen',
    initials: 'AN',
    city: 'Portland, OR',
    hue: 210,
    items: [it(1, 'Iron Goddess Oolong', 'oolong'), it(2, 'Jade Cloud Gyokuro', 'green')],
    total: '$92.00',
    channel: 'Web store',
    placed: 'Yesterday',
    when: 'Yesterday, 9:40 PM',
    status: 'packed',
  },
  {
    id: 'KL-49941',
    customer: 'Hana Holm',
    initials: 'HH',
    city: 'Minneapolis, MN',
    hue: 280,
    items: [it(1, 'Harbor Breakfast', 'black'), it(1, 'Mint Garden', 'herbal')],
    total: '$41.00',
    channel: 'Market stall',
    placed: 'Yesterday',
    when: 'Yesterday, 9:09 PM',
    status: 'packed',
  },
  {
    id: 'KL-49939',
    customer: 'Esme Haddad',
    initials: 'EH',
    city: 'Chicago, IL',
    hue: 30,
    items: [it(2, 'Darjeeling Second Flush', 'black'), it(2, 'Ash Glaze Kyusu', 'ware')],
    total: '$208.00',
    channel: 'Web store',
    placed: 'Yesterday',
    when: 'Yesterday, 9:51 PM',
    status: 'shipped',
  },
  {
    id: 'KL-49946',
    customer: 'Jonah Brennan',
    initials: 'JB',
    city: 'Denver, CO',
    hue: 200,
    items: [it(1, 'Harbor Breakfast', 'black')],
    total: '$22.50',
    channel: 'Web store',
    placed: 'Yesterday',
    when: 'Yesterday, 4:37 PM',
    status: 'shipped',
  },
  {
    id: 'KL-49944',
    customer: 'Sofia Moreno',
    initials: 'SM',
    city: 'Oakland, CA',
    hue: 42,
    items: [it(1, 'Milk Oolong', 'oolong')],
    total: '$24.00',
    channel: 'Web store',
    placed: 'Yesterday',
    when: 'Yesterday, 1:41 PM',
    status: 'shipped',
  },
]

export const D16_ORDER_BY_ID: Record<string, OrderData> = Object.fromEntries(D16_ORDERS.map((o) => [o.id, o]))

export interface LaneData {
  key: OrderStatus
  title: string
  sub: string
  tone: Tone
  /** 카드에 보이지 않는 주문까지 센 수(영상 Packed 11·Shipped 31) — 옮기면 카드 수만큼 더하고 뺀다 */
  hidden: number
}

export const D16_LANES: LaneData[] = [
  { key: 'to-pack', title: 'To pack', sub: 'Paid, waiting for hands', tone: 'blue', hidden: 0 },
  { key: 'packed', title: 'Packed', sub: 'Boxed, label printed', tone: 'blue', hidden: 8 },
  { key: 'shipped', title: 'Shipped', sub: 'With the carrier', tone: 'blue', hidden: 28 },
  { key: 'delivered', title: 'Delivered', sub: 'Since yesterday', tone: 'green', hidden: 0 },
]

export const D16_LANE_TITLE: Record<OrderStatus, string> = {
  'to-pack': 'To pack',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
}

/** 칸반 처음 모습(레인마다 주문 id) */
export const D16_BOARD_START: Record<OrderStatus, string[]> = {
  'to-pack': ['KL-49959', 'KL-49958', 'KL-49957'],
  packed: ['KL-49956', 'KL-49949', 'KL-49941'],
  shipped: ['KL-49939', 'KL-49946', 'KL-49944'],
  delivered: [],
}

export const D16_ORDER_FILTERS = [
  { key: 'all', label: 'All', count: 437 },
  { key: 'open', label: 'Open', count: 16 },
  { key: 'awaiting', label: 'Awaiting payment', count: 2 },
  { key: 'to-pack', label: 'To pack', count: 3 },
  { key: 'shipped', label: 'Shipped', count: 53 },
  { key: 'delivered', label: 'Delivered', count: 354 },
  { key: 'returned', label: 'Returned', count: 6 },
]

export const D16_ORDERS_TITLE = 'Orders'
export const D16_ORDERS_SUB = 'Every sale from the web store, Instagram, the market stall and wholesale.'
export const D16_TABLE_SUM = '437 orders · $23,514 kept'
export const D16_RETURNS = 6

export const D16_STATUS_LABEL: Record<OrderData['status'], { text: string; tone: Tone }> = {
  awaiting: { text: 'Awaiting payment', tone: 'amber' },
  'to-pack': { text: 'To pack', tone: 'blue' },
  packed: { text: 'Packed', tone: 'teal' },
  shipped: { text: 'Shipped', tone: 'grey' },
  delivered: { text: 'Delivered', tone: 'green' },
}

// ── 공(배경) ──────────────────────────────────────────────────────────────
export type OrbTone = 'orange' | 'blue' | 'green' | 'silver' | 'cyan'

export interface OrbData {
  /** 가운데(영상 px, 창 왼쪽 위 기준) */
  x: number
  y: number
  /** 반지름(영상 px) */
  r: number
  tone: OrbTone
}

/**
 * 창 기준 공 다섯 개 — F110(앞 판이 모두 빠진 프레임)에서 테를 원으로 맞춘 값(평균 오차 0.2~0.7px).
 * 영상 6.3초 동안 한 화소도 움직이지 않는다(커서·페이지가 바뀌어도 그대로) — 그래서 떠다니기·시차 없이 둔다.
 */
export const D16_ORBS: OrbData[] = [
  { x: 535.3, y: 36.2, r: 67.7, tone: 'orange' },
  { x: 54.7, y: 251.8, r: 120.2, tone: 'blue' },
  { x: 343.7, y: 294.3, r: 44.5, tone: 'green' },
  { x: 423, y: 230.8, r: 34.2, tone: 'silver' },
  { x: 598.8, y: 324.2, r: 104.1, tone: 'cyan' },
]

// ── 부품 견본용 다른 값 ──────────────────────────────────────────────────
export const D16_PART_ORBS: OrbData[] = [
  { x: 40, y: 30, r: 34, tone: 'orange' },
  { x: 150, y: 80, r: 44, tone: 'cyan' },
  { x: 92, y: 96, r: 20, tone: 'green' },
]

// ── 둘러보기(영상 순서 그대로) ───────────────────────────────────────────
/**
 * 커서 끝 자리 [프레임, x, y](창 기준 영상 px) — 화살표 모양 틀을 프레임마다 맞춰 찾은 값(F0~F185).
 * 사이는 곧게 잇는다(프레임 간격이 이미 영상의 빠르기를 담고 있다).
 */
// prettier-ignore
export const D16_TOUR_PATH: readonly (readonly [number, number, number])[] = [
  [0, 388, 25], [20, 388, 25], [21, 390, 29], [22, 393, 37], [23, 397, 48], [24, 403, 61], [25, 413, 81],
  [26, 420, 93], [27, 425, 101], [28, 428, 107], [29, 431, 111], [32, 431, 111], [33, 430, 110], [35, 427, 110],
  [36, 406, 109], [37, 385, 106], [38, 362, 101], [39, 341, 94], [40, 320, 85], [41, 314, 82], [42, 312, 81],
  [59, 312, 81], [60, 310, 81], [61, 292, 85], [62, 228, 93], [63, 174, 97], [64, 124, 99], [65, 87, 99],
  [66, 60, 98], [67, 57, 98], [69, 55, 98], [70, 53, 99], [75, 53, 98], [76, 56, 99], [77, 77, 108],
  [78, 99, 116], [79, 124, 122], [80, 148, 126], [81, 175, 129], [82, 185, 129], [83, 189, 129], [96, 189, 128],
  [97, 192, 124], [98, 196, 115], [99, 199, 105], [100, 201, 95], [101, 201, 93], [129, 201, 93], [130, 201, 97],
  [131, 202, 113], [132, 201, 134], [133, 198, 160], [134, 196, 168], [135, 196, 170], [139, 196, 169],
  [140, 197, 169], [141, 201, 170], [142, 206, 171], [143, 213, 172], [144, 220, 172], [145, 234, 173],
  [146, 243, 173], [147, 254, 174], [148, 269, 175], [149, 278, 175], [150, 288, 176], [151, 296, 176],
  [152, 307, 176], [153, 312, 176], [154, 317, 176], [155, 320, 176], [156, 323, 176], [157, 324, 176],
  [158, 325, 177], [166, 325, 176], [171, 326, 175], [172, 332, 173], [173, 345, 168], [174, 360, 161],
  [175, 380, 148], [176, 389, 142], [177, 393, 139], [178, 394, 139], [185, 394, 139],
]

export type TourEventType = 'click' | 'down' | 'up'

/**
 * 누르기 — 30D(F31.2, 기간 알약이 F31.2에 움직이기 시작) · 사이드바 Orders(F73.3, 표시 앞 모서리 F72.8~) ·
 * Packing board 탭(F105.4, 내용이 F106.5부터 빠진다) · KL-49959 누름(F136.5, 고리 F137) · 놓음(F160.5, 숫자가 F161에 바뀐다).
 */
export const D16_TOUR_EVENTS: readonly { f: number; type: TourEventType }[] = [
  { f: 31.2, type: 'click' },
  { f: 73.3, type: 'click' },
  { f: 105.4, type: 'click' },
  { f: 136.5, type: 'down' },
  { f: 160.5, type: 'up' },
]

/** 영상이 끝나는 프레임 — 그 뒤 잠깐 두었다가 처음부터 */
export const D16_TOUR_END = 185
export const D16_TOUR_HOLD = 2.6
