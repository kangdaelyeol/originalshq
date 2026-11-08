// 보드 숫자 카드 — 세는 법은 웹과 앱이 같이 쓰고, 아이콘은 이름만 둔다(웹은 lucide-react, 앱은 lucide-react-native의
// 같은 이름 아이콘으로 그린다).

/** 숫자 카드 아이콘 이름 */
export type KpiIcon =
  | 'Barcode'
  | 'Boxes'
  | 'CalendarClock'
  | 'CircleAlert'
  | 'CircleCheck'
  | 'CircleDashed'
  | 'ClipboardPen'
  | 'Hourglass'
  | 'Inbox'
  | 'Link2'
  | 'ListTodo'
  | 'MessageCircle'
  | 'MessagesSquare'
  | 'OctagonAlert'
  | 'Package'
  | 'PackageOpen'
  | 'PackagePlus'
  | 'PackageX'
  | 'Paperclip'
  | 'Receipt'
  | 'Send'
  | 'SquareCheck'
  | 'Truck'
  | 'Wrench'

/** 아이콘 칸의 색조 — 장식용(웹 IconTint와 같다) */
export type KpiTint = 'blue' | 'violet' | 'green' | 'amber'

/** 상태 색 — 의미가 있을 때만(웹 Tone과 같다) */
export type KpiTone = 'good' | 'warn' | 'crit' | 'info' | 'neutral'

export interface KpiCard {
  key: string
  title: string
  value: string
  icon: KpiIcon
  tint: KpiTint
  /** 값 아래 한 줄(직전 기간 수·기준 설명) */
  caption?: string
}
