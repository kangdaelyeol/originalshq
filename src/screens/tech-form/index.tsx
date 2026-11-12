import {
  Check,
  ChevronRight,
  FileText,
  LoaderCircle,
  Paperclip,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { formatPhoneTyping } from '@xtool-core/tech-edit'
import heroImage from '@/assets/xtool-tech-support-korean.jpeg'
import faviconUrl from '@/screens/xtool-tech/assets/symbols/favicon-64.png'
import { useDocumentHead } from '@/screens/xtool-tech/lib/use-document-head'
import { DateSelect } from './date-select'
import { PolicyModal } from './policy-modal'
import { AsNoticeModal } from './as-notice-modal'
import { SupportCenterLogo } from './xtool-logo'
import './tech-form.scss'

// 기술문의 접수 폼(/xtool/support) — 고객이 휴대폰으로 여는 공개 페이지. 아톡 폼을 대신한다: 제출하면 우리 서버가
// 아톡문의 보드에 항목을 만들고 기술팀 웍스 채팅방에 알린다(제출 함수는 다음 단계 — 지금은 3초 기다리는 흉내).
// 모바일 전용이라 폭을 좁게 둔다.
//
// 화면 차례: 시작(사진·문의 종류 — AS 접수 / 사용 문의) → (AS 접수만) A/S 신청 확인사항 창 → (사용 문의만) 문의 종류(사용 방법·오작동·설정값) →
// 연락처(성함을 적고 "다음"을 누르면 아래에 연락처 칸이 생긴다) → 기기(시리즈 단추) → 모델(시리즈 안 기기 단추) →
// 자료·문의 내용(AS 접수는 구매경로·구매시기(·구매일자 선택)·기기 수령 주소부터, 첨부(선택)·내용, "접수하기") → 확인(지금까지 고른·적은 것, "이대로 접수하기") → 로딩 → 완료(사진).
// 단추 화면은 누르면 저절로 다음 화면으로 가서 "다음"이 없다(단추 목록 밑에 "이전"만) — 모델이 없는 기기(O1·DTF·MetalFab)는
// 모델 화면을 건너뛴다. 화면이 바뀔 때마다 살짝 올라오며 나타난다. 머리에는 xTool Support Center 로고만 보이고
// "기술문의 접수"는 화면 읽기용 제목으로만 둔다.

const NAME_MAX = 255
// 문의 내용 글자 수(Monday 긴 글 칸 한도)
const CONTENT_MAX = 2000
// 첨부 파일 수
const FILES_MAX = 10
// 단추를 누른 뒤 고른 표시를 잠깐 보여 주고 넘어간다
const ADVANCE_MS = 160
// 접수 흉내 — 제출 함수를 붙이기 전까지 로딩을 보는 시간
const FAKE_SUBMIT_MS = 3000

/** 문의 기기 — 시리즈 단추와 그 안의 기기. models가 비면 고르는 즉시 다음 화면으로 */
const DEVICES: readonly {
  key: string
  label: string
  models: readonly string[]
}[] = [
  { key: 'M', label: 'M 시리즈', models: ['M1', 'M1 Ultra', 'M2'] },
  {
    key: 'F',
    label: 'F 시리즈',
    models: ['F1', 'F2', 'F1 Ultra', 'F2 Ultra', 'F1 Ultra UV', 'F2 Ultra UV'],
  },
  { key: 'P', label: 'P 시리즈', models: ['P2', 'P2S', 'P3'] },
  { key: 'O1', label: 'O1', models: [] },
  { key: 'DTF', label: 'DTF', models: [] },
  { key: 'MetalFab', label: 'MetalFab', models: [] },
  {
    key: 'etc',
    label: '기타',
    models: ['AP2', '소형 집진기', 'D1 pro', 'S1', '기타'],
  },
]

/** 문의 종류 — 시작 화면 단추 */
const KINDS: readonly { key: string; label: string; description?: string }[] = [
  { key: 'as', label: 'AS 접수' },
  {
    key: 'other',
    label: '사용 문의',
    description: '사용 방법, 설정값, 오작동 문의 등',
  },
]

/** 사용 문의의 문의 종류 */
const INQUIRY_TYPES: readonly { value: string; label: string }[] = [
  { value: 'usage', label: '사용 방법 문의' },
  { value: 'malfunction', label: '기기 오작동 문의' },
  { value: 'settings', label: '설정값 문의' },
]

/** AS 접수 — 구매경로 */
const PURCHASE_CHANNELS: readonly { value: string; label: string }[] = [
  { value: 'online', label: '온라인' },
  { value: 'offline', label: '오프라인' },
]
/** AS 접수 — 구매시기. "정확히 기억나지 않음"이 아니면 아래에 구매일자(선택) 칸이 생긴다 */
const PURCHASE_PERIODS: readonly { value: string; label: string }[] = [
  { value: 'within1m', label: '최근 1개월 이내' },
  { value: '1to3m', label: '1~3개월 전' },
  { value: '3to6m', label: '3~6개월 전' },
  { value: '6to12m', label: '6개월~1년 전' },
  { value: 'over1y', label: '1년 이상' },
  { value: 'unknown', label: '정확히 기억나지 않음' },
]
// 구매일자 칸을 보이지 않는 구매시기
const PERIOD_UNKNOWN = 'unknown'
// 기기 수령 주소 글자 수
const ADDRESS_MAX = 300

/** 구매일자(YYYY-MM-DD) → 2026년 11월 11일 */
const dateText = (value: string) => {
  const [y, m, d] = value.split('-').map(Number)
  return y && m && d ? `${y}년 ${m}월 ${d}일` : value
}

/** 오늘(이 기기 시간대, YYYY-MM-DD) — 구매일자는 오늘까지만 */
const todayText = () => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

type DetailKey = 'purchase' | 'period' | 'date' | 'address' | 'content'

type Step =
  | 'start'
  | 'type'
  | 'contact'
  | 'series'
  | 'model'
  | 'details'
  | 'review'
  | 'done'
type FieldKey = 'name' | 'phone'

/** 첨부 파일 하나 — 미리 보기 주소(object URL)는 뺄 때·떠날 때 돌려준다 */
interface Attachment {
  id: number
  file: File
  url: string
}

/** 칸 하나 — 이름(필수 표시)·설명·입력·오류(·글자 수) */
function Field({
  id,
  label,
  required,
  hint,
  error,
  footer,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="tech-form__field">
      <label className="tech-form__label" htmlFor={id}>
        {label}
        {required && <Required />}
      </label>
      {hint && (
        <p className="tech-form__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {children}
      {(error || footer) && (
        <div className="tech-form__under">
          {error ? (
            <p className="tech-form__error" id={`${id}-error`} role="alert">
              {error}
            </p>
          ) : (
            <span />
          )}
          {footer}
        </div>
      )}
    </div>
  )
}

function Required() {
  return (
    <span className="tech-form__required" aria-hidden>
      *
    </span>
  )
}

/** 단추 고르기 — 2열 큰 단추(list면 세로 한 줄씩 넓게), 고른 것은 강조색 테두리·체크 */
function ChoiceGrid({
  label,
  hint,
  options,
  value,
  onPick,
  list = false,
  error,
}: {
  label: string
  hint: string
  options: readonly { value: string; label: string }[]
  value: string | null
  onPick: (value: string) => void
  list?: boolean
  /** 안 골랐을 때 안내(구매경로) */
  error?: string
}) {
  const id = useId()
  return (
    <fieldset
      className="tech-form__choice-set"
      aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
    >
      <legend className="tech-form__label">
        {label}
        <Required />
      </legend>
      <p className="tech-form__hint" id={`${id}-hint`}>
        {hint}
      </p>
      <div
        className={
          list
            ? 'tech-form__list tech-form__list--in-set'
            : 'tech-form__choices'
        }
      >
        {options.map((option) => {
          const on = option.value === value
          const base = list
            ? 'tech-form__choice tech-form__choice--row'
            : 'tech-form__choice'
          return (
            <button
              key={option.value}
              type="button"
              className={on ? `${base} is-on` : base}
              aria-pressed={on}
              onClick={() => onPick(option.value)}
            >
              <span>{option.label}</span>
              {on && <Check size={18} strokeWidth={2.6} aria-hidden />}
            </button>
          )
        })}
      </div>
      {error && (
        <p className="tech-form__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** 세로 큰 단추 목록(시작 화면 문의 종류) — 이름·설명, 고른 것은 강조색 테두리 */
function ChoiceList({
  options,
  value,
  onPick,
  labelledBy,
}: {
  options: readonly { key: string; label: string; description?: string }[]
  value: string | null
  onPick: (key: string) => void
  labelledBy: string
}) {
  return (
    <div className="tech-form__list" role="group" aria-labelledby={labelledBy}>
      {options.map((option) => {
        const on = option.key === value
        return (
          <button
            key={option.key}
            type="button"
            className={
              on
                ? 'tech-form__choice tech-form__choice--wide is-on'
                : 'tech-form__choice tech-form__choice--wide'
            }
            aria-pressed={on}
            onClick={() => onPick(option.key)}
          >
            <span className="tech-form__choice-text">
              <strong>{option.label}</strong>
              {option.description && <small>{option.description}</small>}
            </span>
            {on ? (
              <Check size={20} strokeWidth={2.6} aria-hidden />
            ) : (
              <ChevronRight size={20} aria-hidden />
            )}
          </button>
        )
      })}
    </div>
  )
}

/** 파일 크기 글자 */
const sizeText = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`

/** 첨부 미리 보기 — 사진은 그대로, 동영상은 첫 장면(소리 없이, 재생하지 않는다) */
function Thumb({ item, className }: { item: Attachment; className: string }) {
  return item.file.type.startsWith('video/') ? (
    <video
      className={className}
      src={`${item.url}#t=0.1`}
      muted
      playsInline
      preload="metadata"
      aria-hidden
    />
  ) : (
    <img className={className} src={item.url} alt="" />
  )
}

/** 자료 첨부(선택) — 사진·동영상을 골라 미리 보기 목록으로(빼기). 올리기는 접수할 때(제출 함수는 다음 단계) */
function AttachField({
  items,
  onAdd,
  onRemove,
}: {
  items: readonly Attachment[]
  onAdd: (files: File[]) => void
  onRemove: (id: number) => void
}) {
  const id = useId()
  const full = items.length >= FILES_MAX
  return (
    <div className="tech-form__field">
      <p className="tech-form__label" id={`${id}-label`}>
        자료 첨부(선택)
      </p>
      <p className="tech-form__hint" id={`${id}-hint`}>
        증상과 관련된 자료를 첨부해 주세요.
      </p>
      <label
        className={full ? 'tech-form__attach is-disabled' : 'tech-form__attach'}
      >
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          disabled={full}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            onAdd(Array.from(e.target.files ?? []))
            // 같은 파일을 뺐다가 다시 고를 수 있게 비운다
            e.target.value = ''
          }}
        />
        <Paperclip size={18} aria-hidden />
        {full ? `최대 ${FILES_MAX}개까지 첨부할 수 있어요` : '사진·동영상 추가'}
      </label>
      {items.length > 0 && (
        <ul className="tech-form__files">
          {items.map((item) => (
            <li key={item.id}>
              <Thumb item={item} className="tech-form__file-thumb" />
              <span className="tech-form__file-name">{item.file.name}</span>
              <span className="tech-form__file-size">
                {sizeText(item.file.size)}
              </span>
              <button
                type="button"
                className="tech-form__file-remove"
                aria-label={`${item.file.name} 빼기`}
                onClick={() => onRemove(item.id)}
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** "이전" — "다음"과 같은 크기의 흰 단추 */
function BackButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="tech-form__button tech-form__button--block tech-form__button--ghost"
      disabled={disabled}
      onClick={onClick}
    >
      이전
    </button>
  )
}

/** 확인 화면 한 줄 — 이름 · 값 */
function ReviewRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="tech-form__review-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** 사진 머리(시작·완료 화면) — 로고 헤더와 사진이 같은 바탕색(사진 위쪽 색)이라 한 장처럼 보인다 */
function PhotoHead() {
  return (
    <>
      <header className="tech-form__header">
        <div className="tech-form__brand">
          <SupportCenterLogo className="tech-form__support-logo" />
          <h1 className="tech-form__sr-only">xTool 기술문의 접수</h1>
        </div>
      </header>
      <div className="tech-form__hero" aria-hidden>
        <img src={heroImage} alt="" />
      </div>
    </>
  )
}

export default function TechFormScreen() {
  const id = useId()
  const [step, setStep] = useState<Step>('start')
  const [kind, setKind] = useState<string | null>(null)
  // 사용 문의의 문의 종류
  const [inquiryType, setInquiryType] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  // 연락처 칸 — 성함을 적고 "다음"을 누르면 아래에 생긴다(한 번에 한 칸씩)
  const [phoneShown, setPhoneShown] = useState(false)
  const phoneRef = useRef<HTMLInputElement>(null)
  const [series, setSeries] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  // 자료·문의 내용
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const nextAttachment = useRef(1)
  const [content, setContent] = useState('')
  // AS 접수만 — 구매경로·구매시기·구매일자(선택)·기기 수령 주소
  const [purchase, setPurchase] = useState<string | null>(null)
  const [purchasePeriod, setPurchasePeriod] = useState<string | null>(null)
  const [purchaseDate, setPurchaseDate] = useState('')
  const [address, setAddress] = useState('')
  const [detailErrors, setDetailErrors] = useState<
    Partial<Record<DetailKey, string>>
  >({})
  const [submitting, setSubmitting] = useState(false)
  // AS 정책 안내 창 — 닫으면 연 단추로 초점을 돌려준다
  const [policyOpen, setPolicyOpen] = useState(false)
  const policyButton = useRef<HTMLButtonElement>(null)
  const closePolicy = useCallback(() => {
    setPolicyOpen(false)
    policyButton.current?.focus()
  }, [])
  // A/S 신청 확인사항 창 — "AS 접수"를 고르면 다음 화면으로 가기 전에 띄운다
  const [asNoticeOpen, setAsNoticeOpen] = useState(false)
  const closeAsNotice = useCallback(() => setAsNoticeOpen(false), [])
  const advance = useRef<number | undefined>(undefined)
  const submitTimer = useRef<number | undefined>(undefined)
  // 떠날 때 미리 보기 주소를 돌려주려고 지금 목록을 들고 있는다
  const attachmentsRef = useRef<Attachment[]>([])

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  // 브라우저 탭 — 제목과 아이콘(xtool-tech와 같은 파비콘). 이 화면에 있는 동안만 바꾸고 나가면 되돌린다
  useDocumentHead('엑스툴 기술문의', faviconUrl)

  useEffect(() => {
    return () => {
      window.clearTimeout(advance.current)
      window.clearTimeout(submitTimer.current)
      attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url))
    }
  }, [])

  const group = DEVICES.find((d) => d.key === series) ?? null
  const kindLabel = KINDS.find((k) => k.key === kind)?.label ?? ''
  const typeLabel =
    INQUIRY_TYPES.find((t) => t.value === inquiryType)?.label ?? null
  const deviceLabel = group
    ? model && model !== group.label
      ? `${group.label} · ${model}`
      : group.label
    : ''

  const go = (next: Step) => {
    window.clearTimeout(advance.current)
    setStep(next)
    window.scrollTo({ top: 0 })
  }
  // 고른 표시를 잠깐 보이고 넘어간다
  const goSoon = (next: Step) => {
    window.clearTimeout(advance.current)
    advance.current = window.setTimeout(() => go(next), ADVANCE_MS)
  }

  // 고치면 그 칸 오류는 지운다
  const clearError = (key: FieldKey) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))

  const validateContact = () => {
    const next: Partial<Record<FieldKey, string>> = {}
    if (!name.trim()) next.name = '성함을 입력해 주세요.'
    const digits = phone.replace(/\D/g, '').length
    if (digits === 0) next.phone = '연락처를 입력해 주세요.'
    else if (digits < 9) next.phone = '연락처를 끝까지 입력해 주세요.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // 사용 문의는 문의 종류를 먼저 고른다
  const pickKind = (key: string) => {
    setKind(key)
    if (key === 'as') {
      // AS 접수 — 고른 표시를 잠깐 보인 뒤 확인사항 창을 띄우고, "확인했습니다"를 눌러야 넘어간다
      window.clearTimeout(advance.current)
      advance.current = window.setTimeout(
        () => setAsNoticeOpen(true),
        ADVANCE_MS,
      )
      return
    }
    goSoon(key === 'other' ? 'type' : 'contact')
  }

  const confirmAsNotice = () => {
    setAsNoticeOpen(false)
    go('contact')
  }

  const pickType = (value: string) => {
    setInquiryType(value)
    goSoon('contact')
  }

  const pickSeries = (key: string) => {
    const picked = DEVICES.find((d) => d.key === key)
    if (!picked) return
    // 다른 시리즈로 바꾸면 고른 모델은 비운다. 모델이 하나뿐이면 그것으로 고르고 모델 화면을 건너뛴다.
    if (key !== series)
      setModel(picked.models.length === 1 ? picked.models[0] : null)
    setSeries(key)
    goSoon(picked.models.length > 1 ? 'model' : 'details')
  }

  const pickModel = (value: string) => {
    setModel(value)
    goSoon('details')
  }

  const back = () => {
    if (step === 'type') go('start')
    else if (step === 'contact') go(kind === 'other' ? 'type' : 'start')
    else if (step === 'series') go('contact')
    else if (step === 'model') go('series')
    else if (step === 'details')
      go(group && group.models.length > 1 ? 'model' : 'series')
    else if (step === 'review') go('details')
  }

  // 연락처 화면 "다음" — 성함만 보이면 확인하고 아래에 연락처 칸을 연다(누른 그 자리에서 바로 그리고 초점을 옮긴다 —
  // 아이폰은 누르는 동작 안에서 초점을 옮겨야 키보드가 그대로 있다). 둘 다 보이면 확인하고 기기 화면으로.
  const submitContact = () => {
    if (!phoneShown) {
      if (!name.trim()) {
        setErrors({ name: '성함을 입력해 주세요.' })
        return
      }
      flushSync(() => setPhoneShown(true))
      phoneRef.current?.focus()
      return
    }
    if (validateContact()) go('series')
  }

  const addFiles = (files: File[]) => {
    const room = FILES_MAX - attachments.length
    const added = files.slice(0, Math.max(0, room)).map((file) => ({
      id: nextAttachment.current++,
      file,
      url: URL.createObjectURL(file),
    }))
    setAttachments((prev) => [...prev, ...added])
  }

  const removeFile = (attachmentId: number) => {
    const gone = attachments.find((a) => a.id === attachmentId)
    if (gone) URL.revokeObjectURL(gone.url)
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
  }

  const isAs = kind === 'as'

  // 고치면 그 칸 안내를 지운다
  const clearDetail = (key: DetailKey) =>
    setDetailErrors((prev) =>
      prev[key] ? { ...prev, [key]: undefined } : prev,
    )

  // 접수하기 — 칸을 확인하고(AS 접수는 구매 정보까지) 확인 화면으로
  const submitDetails = () => {
    const next: Partial<Record<DetailKey, string>> = {}
    if (isAs) {
      if (!purchase) next.purchase = '구매경로를 선택해 주세요.'
      if (!purchasePeriod) next.period = '구매시기를 선택해 주세요.'
      // 구매일자는 선택 — 적었을 때만 오늘까지인지 본다
      if (purchaseDate && purchaseDate > todayText())
        next.date = '오늘 이후 날짜는 선택할 수 없어요.'
      if (!address.trim()) next.address = '기기 수령 주소를 입력해 주세요.'
    }
    if (!content.trim()) next.content = '문의 내용을 입력해 주세요.'
    setDetailErrors(next)
    if (Object.keys(next).length === 0) go('review')
  }

  // 이대로 접수하기 — 지금은 3초 기다리는 흉내(제출 함수: 아톡문의 항목 만들기·파일 올리기·웍스 알림은 다음 단계)
  const confirmSubmit = () => {
    setSubmitting(true)
    submitTimer.current = window.setTimeout(() => {
      setSubmitting(false)
      go('done')
    }, FAKE_SUBMIT_MS)
  }

  const describedBy = (key: FieldKey, hint: boolean) =>
    [
      hint ? `${id}-${key}-hint` : null,
      errors[key] ? `${id}-${key}-error` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined

  const photo = step === 'start' || step === 'done'

  return (
    <div className="tech-form">
      <main className="tech-form__card">
        {photo && <PhotoHead />}
        {/* key — 화면이 바뀔 때마다 새로 그려 살짝 올라오며 나타난다 */}
        <div
          key={step}
          className={[
            'tech-form__body',
            photo ? 'tech-form__body--sheet' : '',
            step === 'done' ? 'tech-form__body--done' : 'tech-form__step',
          ].join(' ')}
        >
          {!photo && (
            <div className="tech-form__brand tech-form__brand--top">
              <SupportCenterLogo className="tech-form__support-logo" />
              <h1 className="tech-form__sr-only">xTool 기술문의 접수</h1>
            </div>
          )}

          {step === 'start' && (
            <>
              <h2 className="tech-form__question" id={`${id}-kind`}>
                문의 종류를 선택해 주세요.
              </h2>
              <ChoiceList
                options={KINDS}
                value={kind}
                onPick={pickKind}
                labelledBy={`${id}-kind`}
              />
              <button
                ref={policyButton}
                type="button"
                className="tech-form__policy-link"
                aria-haspopup="dialog"
                onClick={() => setPolicyOpen(true)}
              >
                <FileText size={17} aria-hidden />
                AS 정책 안내
                <ChevronRight size={17} aria-hidden />
              </button>
            </>
          )}

          {step === 'type' && (
            <ChoiceGrid
              label="문의 종류"
              hint="문의 종류를 선택해 주세요."
              options={INQUIRY_TYPES}
              value={inquiryType}
              onPick={pickType}
              list
            />
          )}

          {step === 'contact' && (
            <form
              className="tech-form__fields"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                submitContact()
              }}
            >
              <Field
                id={`${id}-name`}
                label="성함"
                required
                // 연락처 칸이 생기면 위 칸 안내는 숨긴다(지금 적는 칸 안내만)
                hint={phoneShown ? undefined : '성함을 입력해 주세요.'}
                error={errors.name}
                footer={
                  <span className="tech-form__count">
                    {name.length}/{NAME_MAX}
                  </span>
                }
              >
                <input
                  id={`${id}-name`}
                  className="tech-form__input"
                  value={name}
                  maxLength={NAME_MAX}
                  autoComplete="name"
                  aria-required
                  aria-invalid={!!errors.name}
                  aria-describedby={describedBy('name', !phoneShown)}
                  onChange={(e) => {
                    setName(e.target.value)
                    clearError('name')
                  }}
                />
              </Field>

              {phoneShown && (
                <div className="tech-form__reveal">
                  <Field
                    id={`${id}-phone`}
                    label="연락처"
                    required
                    hint="담당자가 연락드릴 번호를 입력해 주세요. 번호가 정확하지 않을 경우 연락드리기 어려울 수 있습니다."
                    error={errors.phone}
                  >
                    <input
                      ref={phoneRef}
                      id={`${id}-phone`}
                      className="tech-form__input"
                      value={phone}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="010-0000-0000"
                      aria-required
                      aria-invalid={!!errors.phone}
                      aria-describedby={describedBy('phone', true)}
                      onChange={(e) => {
                        setPhone(formatPhoneTyping(e.target.value))
                        clearError('phone')
                      }}
                    />
                  </Field>
                </div>
              )}
              {/* 늘 마지막 칸 바로 아래 — 엔터로도 같은 일. 그 밑에 같은 크기 "이전" */}
              <div className="tech-form__actions">
                <button
                  type="submit"
                  className="tech-form__button tech-form__button--block"
                >
                  다음
                </button>
                <BackButton onClick={back} />
              </div>
            </form>
          )}

          {step === 'series' && (
            <ChoiceGrid
              label="문의 기기"
              hint="문의하실 기기를 선택해 주세요."
              options={DEVICES.map((d) => ({ value: d.key, label: d.label }))}
              value={series}
              onPick={pickSeries}
            />
          )}

          {step === 'model' && group && (
            <ChoiceGrid
              label={`${group.label} 기기`}
              hint={`${group.label} 중 어떤 기기인지 선택해 주세요.`}
              options={group.models.map((m) => ({ value: m, label: m }))}
              value={model}
              onPick={pickModel}
            />
          )}

          {step === 'details' && (
            <form
              className="tech-form__fields"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                submitDetails()
              }}
            >
              {isAs && (
                <>
                  <ChoiceGrid
                    label="구매경로"
                    hint="제품을 구매하신 경로를 선택해 주세요."
                    options={PURCHASE_CHANNELS}
                    value={purchase}
                    onPick={(value) => {
                      setPurchase(value)
                      clearDetail('purchase')
                    }}
                    error={detailErrors.purchase}
                  />
                  <ChoiceGrid
                    label="구매시기"
                    hint="제품을 구매하신 시기를 선택해 주세요."
                    options={PURCHASE_PERIODS}
                    value={purchasePeriod}
                    list
                    onPick={(value) => {
                      setPurchasePeriod(value)
                      clearDetail('period')
                      // 기억나지 않음 — 구매일자 칸이 사라지므로 적어 둔 날짜도 비운다
                      if (value === PERIOD_UNKNOWN) {
                        setPurchaseDate('')
                        clearDetail('date')
                      }
                    }}
                    error={detailErrors.period}
                  />
                  {purchasePeriod && purchasePeriod !== PERIOD_UNKNOWN && (
                    <div className="tech-form__field tech-form__reveal">
                      <p className="tech-form__label" id={`${id}-date-label`}>
                        구매일자(선택)
                      </p>
                      <p className="tech-form__hint" id={`${id}-date-hint`}>
                        정확한 구매일을 알고 계신 경우 입력해 주세요.
                      </p>
                      <DateSelect
                        value={purchaseDate}
                        onChange={(value) => {
                          setPurchaseDate(value)
                          clearDetail('date')
                        }}
                        invalid={!!detailErrors.date}
                        labelledBy={`${id}-date-label`}
                        describedBy={[
                          `${id}-date-hint`,
                          detailErrors.date ? `${id}-date-error` : null,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      />
                      {detailErrors.date && (
                        <div className="tech-form__under">
                          <p
                            className="tech-form__error"
                            id={`${id}-date-error`}
                            role="alert"
                          >
                            {detailErrors.date}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <Field
                    id={`${id}-address`}
                    label="기기 수령 주소"
                    required
                    hint="AS가 완료된 기기를 받으실 주소를 상세 주소까지 입력해 주세요."
                    error={detailErrors.address}
                  >
                    <textarea
                      id={`${id}-address`}
                      className="tech-form__input tech-form__textarea tech-form__textarea--short"
                      value={address}
                      maxLength={ADDRESS_MAX}
                      rows={2}
                      autoComplete="street-address"
                      placeholder="예: 서울시 강남구 테헤란로 123, 4층"
                      aria-required
                      aria-invalid={!!detailErrors.address}
                      aria-describedby={[
                        `${id}-address-hint`,
                        detailErrors.address ? `${id}-address-error` : null,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onChange={(e) => {
                        setAddress(e.target.value)
                        clearDetail('address')
                      }}
                    />
                  </Field>
                </>
              )}
              <AttachField
                items={attachments}
                onAdd={addFiles}
                onRemove={removeFile}
              />
              <Field
                id={`${id}-content`}
                label="문의 내용"
                required
                hint="담당자가 신속하게 파악할 수 있도록 최대한 자세히 작성해 주세요."
                error={detailErrors.content}
                footer={
                  <span className="tech-form__count">
                    {content.length}/{CONTENT_MAX}
                  </span>
                }
              >
                <textarea
                  id={`${id}-content`}
                  className="tech-form__input tech-form__textarea"
                  value={content}
                  maxLength={CONTENT_MAX}
                  rows={7}
                  aria-required
                  aria-invalid={!!detailErrors.content}
                  aria-describedby={[
                    `${id}-content-hint`,
                    detailErrors.content ? `${id}-content-error` : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onChange={(e) => {
                    setContent(e.target.value)
                    clearDetail('content')
                  }}
                />
              </Field>
              <div className="tech-form__actions">
                <button
                  type="submit"
                  className="tech-form__button tech-form__button--block"
                >
                  접수하기
                </button>
                <BackButton onClick={back} />
              </div>
            </form>
          )}

          {step === 'review' && (
            <section
              className="tech-form__fields"
              aria-labelledby={`${id}-review`}
            >
              <div className="tech-form__field">
                <h2 className="tech-form__label" id={`${id}-review`}>
                  접수 내용 확인
                </h2>
                <p className="tech-form__hint">
                  아래 내용으로 접수할게요. 고칠 내용이 있으면 이전을 눌러
                  주세요.
                </p>
              </div>
              <dl className="tech-form__review">
                <ReviewRow label="문의 유형">
                  {typeLabel ? `${kindLabel} · ${typeLabel}` : kindLabel}
                </ReviewRow>
                <ReviewRow label="성함">{name.trim()}</ReviewRow>
                <ReviewRow label="연락처">{phone}</ReviewRow>
                <ReviewRow label="문의 기기">{deviceLabel}</ReviewRow>
                {isAs && (
                  <>
                    <ReviewRow label="구매경로">
                      {PURCHASE_CHANNELS.find((c) => c.value === purchase)
                        ?.label ?? ''}
                    </ReviewRow>
                    <ReviewRow label="구매시기">
                      {PURCHASE_PERIODS.find((p) => p.value === purchasePeriod)
                        ?.label ?? ''}
                    </ReviewRow>
                    {purchaseDate && (
                      <ReviewRow label="구매일자">
                        {dateText(purchaseDate)}
                      </ReviewRow>
                    )}
                    <ReviewRow label="수령 주소">
                      <span className="tech-form__review-text">
                        {address.trim()}
                      </span>
                    </ReviewRow>
                  </>
                )}
                <ReviewRow label="자료 첨부">
                  {attachments.length === 0 ? (
                    <span className="tech-form__review-empty">없음</span>
                  ) : (
                    <span className="tech-form__review-thumbs">
                      {attachments.map((item) => (
                        <Thumb
                          key={item.id}
                          item={item}
                          className="tech-form__review-thumb"
                        />
                      ))}
                      <span className="tech-form__review-count">
                        {attachments.length}개
                      </span>
                    </span>
                  )}
                </ReviewRow>
                <ReviewRow label="문의 내용">
                  <span className="tech-form__review-text">
                    {content.trim()}
                  </span>
                </ReviewRow>
              </dl>
              <div className="tech-form__actions">
                <button
                  type="button"
                  className="tech-form__button tech-form__button--block"
                  disabled={submitting}
                  onClick={confirmSubmit}
                >
                  이대로 접수하기
                </button>
                <BackButton onClick={back} disabled={submitting} />
              </div>
            </section>
          )}

          {step === 'done' && (
            <section className="tech-form__done" aria-labelledby={`${id}-done`}>
              <span className="tech-form__done-check" aria-hidden>
                <Check size={34} strokeWidth={3} />
              </span>
              <h2 className="tech-form__done-title" id={`${id}-done`}>
                문의가 접수되었어요
              </h2>
              <p className="tech-form__done-text">
                담당자가 확인한 뒤 남겨 주신 연락처로 연락드릴게요.
              </p>
            </section>
          )}

          {/* 단추 화면 "이전" — 단추 목록 밑에 "다음"과 같은 크기로(다른 화면은 "다음"·"접수하기" 밑에 있다) */}
          {(step === 'type' || step === 'series' || step === 'model') && (
            <div className="tech-form__actions tech-form__actions--after">
              <BackButton onClick={back} />
            </div>
          )}
        </div>

        {policyOpen && <PolicyModal onClose={closePolicy} />}
        {asNoticeOpen && (
          <AsNoticeModal onConfirm={confirmAsNotice} onClose={closeAsNotice} />
        )}

        {/* 접수하는 동안 — 화면을 덮는 로딩 */}
        {submitting && (
          <div className="tech-form__loading" role="status" aria-live="polite">
            <LoaderCircle
              className="tech-form__spinner"
              size={40}
              aria-hidden
            />
            <p>접수하고 있어요…</p>
          </div>
        )}
      </main>
    </div>
  )
}
