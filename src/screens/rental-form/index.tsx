import { Check, ChevronRight, FileText, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { formatPhoneTyping } from '@xtool-core/tech-edit'
import faviconUrl from '@/screens/xtool-tech/assets/symbols/favicon-64.png'
import { useDocumentHead } from '@/screens/xtool-tech/lib/use-document-head'
import { BackButton, ChoiceList, Field, PhotoHead, Required, ReviewRow } from '@/screens/tech-form/parts'
import { SupportCenterLogo } from '@/screens/tech-form/xtool-logo'
import { DateSelect } from '@/screens/tech-form/date-select'
import { businessDaysBetween, dateText, daysBetween, localDate } from '@/screens/tech-form/dates'
import { RentalNoticeModal } from './rental-notice-modal'
import { RentalContractModal } from './rental-contract-modal'
import '@/screens/tech-form/tech-form.scss'
import './rental-form.scss'

// 제품 대여 신청 폼(/xtool/rental) — 고객이 휴대폰으로 여는 공개 페이지. 예전 구글 폼 "제품 대여 동의서"를 대신한다.
// 기술문의 폼(/xtool/support)과 같은 모양·부품(tech-form/parts.tsx, tech-form.scss)을 쓴다. 제출은 아직 흉내(3초
// 로딩) — 어디에 쌓을지(Monday 보드 등)는 다음 단계.
//
// 화면 차례: 시작(사진·"대여 신청하기") → 제품 대여 안내 창(구성품 포함, "확인했습니다") → 신청자 정보(성함 → 연락처 →
// 배송받으실 주소, "다음"을 누를 때마다 아래에 한 칸씩) → 대여 희망 제품(여러 개 고르기, "기타"면 제품명 칸) → 사용
// 목적·대여 희망 기간(시작일자·종료일자, 둘 다 고르면 "N일간")·물품 대여 계약 동의(계약서 창 — 끝까지 내려야 체크) → 확인("이대로 신청하기") → 로딩 → 완료(사진).

const NAME_MAX = 255
// 기타 제품명 글자 수
const OTHER_MAX = 100
// 배송받으실 주소 글자 수(기술문의 폼의 기기 수령 주소와 같게)
const ADDRESS_MAX = 300
// 대여료 — 기기마다 하루 같은 값(원)
const RENTAL_FEE_PER_DAY = 10_000
// 보증금 — 대여 기간이 이 영업일 수 이상이면 기기마다 붙는다(그보다 짧으면 없음). 제품 수거·상태 확인 뒤 돌려준다
const RENTAL_DEPOSIT = 200_000
const DEPOSIT_FROM_BUSINESS_DAYS = 10
// 대여 기간은 오늘부터 이만큼 뒤(일)까지 고를 수 있다
const RENTAL_DAYS_AHEAD = 365
// 사용 목적 글자 수(Monday 긴 글 칸 한도)
const TEXT_MAX = 2000
// 단추를 누른 뒤 고른 표시를 잠깐 보여 주고 넘어간다(기술문의 폼과 같게)
const ADVANCE_MS = 160
// 신청 흉내 — 제출 함수를 붙이기 전까지 로딩을 보는 시간
const FAKE_SUBMIT_MS = 3000

/** 시작 화면 단추 — 하나뿐이지만 기술문의 폼의 문의 종류 단추와 같은 모양으로 */
const START: readonly { key: string; label: string; description?: string }[] = [
  { key: 'rental', label: '대여 신청하기', description: '대여 안내를 확인한 뒤 신청해요' },
]

/** 대여 희망 제품 — 여러 개 고를 수 있다. 기타면 아래에 제품명 칸이 생긴다 */
const PRODUCTS: readonly string[] = [
  'F1',
  'F1 Ultra',
  'F2',
  'F2 Ultra',
  'F2 Ultra UV',
  'P2S',
  'P3',
  'DTF',
  'MetalFab',
  'O1',
  'M1',
  'M1 Ultra',
  'M2',
  'S1',
  '기타',
]
const PRODUCT_OTHER = '기타'

type Step = 'start' | 'contact' | 'products' | 'details' | 'review' | 'done'
type FieldKey = 'name' | 'phone' | 'address'
type ProductKey = 'products' | 'other'
type DetailKey = 'purpose' | 'period' | 'agree'

/** 여러 개 고르기 — 2열 큰 단추, 고른 것은 강조색 테두리·체크(기술문의 폼의 단추 고르기와 같은 모양) */
function MultiChoiceGrid({
  label,
  hint,
  options,
  values,
  onToggle,
  error,
}: {
  label: string
  hint: string
  options: readonly string[]
  values: readonly string[]
  onToggle: (value: string) => void
  error?: string
}) {
  const id = useId()
  return (
    <fieldset className="tech-form__choice-set" aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}>
      <legend className="tech-form__label">
        {label}
        <Required />
      </legend>
      <p className="tech-form__hint" id={`${id}-hint`}>
        {hint}
      </p>
      <div className="tech-form__choices">
        {options.map((option) => {
          const on = values.includes(option)
          return (
            <button
              key={option}
              type="button"
              className={on ? 'tech-form__choice is-on' : 'tech-form__choice'}
              aria-pressed={on}
              onClick={() => onToggle(option)}
            >
              <span>{option}</span>
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

export default function RentalFormScreen() {
  const id = useId()
  const [step, setStep] = useState<Step>('start')
  const [started, setStarted] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  // 연락처 칸 — 성함을 적고 "다음"을 누르면 아래에 생긴다(한 번에 한 칸씩)
  const [phoneShown, setPhoneShown] = useState(false)
  const phoneRef = useRef<HTMLInputElement>(null)
  // 배송받으실 주소 — 연락처까지 적고 "다음"을 누르면 아래에 생긴다
  const [address, setAddress] = useState('')
  const [addressShown, setAddressShown] = useState(false)
  const addressRef = useRef<HTMLTextAreaElement>(null)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  // 대여 희망 제품
  const [products, setProducts] = useState<string[]>([])
  const [otherProduct, setOtherProduct] = useState('')
  const [productErrors, setProductErrors] = useState<Partial<Record<ProductKey, string>>>({})
  // 사용 목적·대여 희망 기간·계약 동의
  const [purpose, setPurpose] = useState('')
  // 대여 희망 기간 — 시작일자는 오늘로 채워 둔다. 종료일자 칸은 시작일자를 그 뒤로 옮겨 비울 때 새로 그린다(endKey)
  const [startDate, setStartDate] = useState(() => localDate())
  const [endDate, setEndDate] = useState('')
  const [endKey, setEndKey] = useState(0)
  // 계약서를 끝까지 읽었는지 — 끝까지 내려야 계약서 창의 동의란을 체크할 수 있다(한 번 읽으면 다시 열어도 그대로)
  const [contractRead, setContractRead] = useState(false)
  const markContractRead = useCallback(() => setContractRead(true), [])
  const [agreed, setAgreed] = useState(false)
  // 물품 대여 계약서 창
  const [contractOpen, setContractOpen] = useState(false)
  const closeContract = useCallback(() => setContractOpen(false), [])
  const [detailErrors, setDetailErrors] = useState<Partial<Record<DetailKey, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const advance = useRef<number | undefined>(undefined)
  const submitTimer = useRef<number | undefined>(undefined)

  // 브라우저 탭 — 제목과 아이콘(기술문의 폼과 같은 파비콘). 이 화면에 있는 동안만 바꾸고 나가면 되돌린다
  useDocumentHead('엑스툴 제품 대여 신청', faviconUrl)

  useEffect(() => {
    return () => {
      window.clearTimeout(advance.current)
      window.clearTimeout(submitTimer.current)
    }
  }, [])

  const go = (next: Step) => {
    window.clearTimeout(advance.current)
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  // 시작 — 고른 표시를 잠깐 보인 뒤 대여 안내 창을 띄우고, "확인했습니다"를 눌러야 넘어간다
  const pickStart = () => {
    setStarted(true)
    window.clearTimeout(advance.current)
    advance.current = window.setTimeout(() => setNoticeOpen(true), ADVANCE_MS)
  }
  const closeNotice = useCallback(() => setNoticeOpen(false), [])
  const confirmNotice = () => {
    setNoticeOpen(false)
    go('contact')
  }

  const back = () => {
    if (step === 'contact') go('start')
    else if (step === 'products') go('contact')
    else if (step === 'details') go('products')
    else if (step === 'review') go('details')
  }

  // 고치면 그 칸 오류는 지운다
  const clearError = (key: FieldKey) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  const clearProduct = (key: ProductKey) =>
    setProductErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  const clearDetail = (key: DetailKey) => setDetailErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))

  const validateContact = () => {
    const next: Partial<Record<FieldKey, string>> = {}
    if (!name.trim()) next.name = '성함을 입력해 주세요.'
    const digits = phone.replace(/\D/g, '').length
    if (digits === 0) next.phone = '연락처를 입력해 주세요.'
    else if (digits < 9) next.phone = '연락처를 끝까지 입력해 주세요.'
    if (addressShown && !address.trim()) next.address = '배송받으실 주소를 입력해 주세요.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // 신청자 정보 화면 "다음" — 보이는 칸까지 확인하고 아래에 다음 칸(연락처 → 배송받으실 주소)을 연다(누른 그 자리에서
  // 바로 그리고 초점을 옮긴다 — 아이폰은 누르는 동작 안에서 초점을 옮겨야 키보드가 그대로 있다). 셋 다 보이면 확인하고
  // 제품 화면으로.
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
    if (!addressShown) {
      if (!validateContact()) return
      flushSync(() => setAddressShown(true))
      addressRef.current?.focus()
      return
    }
    if (validateContact()) go('products')
  }

  const otherPicked = products.includes(PRODUCT_OTHER)

  const toggleProduct = (value: string) => {
    setProducts((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]))
    clearProduct('products')
    // 기타를 빼면 제품명 칸이 사라지므로 적어 둔 것도 비운다
    if (value === PRODUCT_OTHER && otherPicked) {
      setOtherProduct('')
      clearProduct('other')
    }
  }

  const submitProducts = () => {
    const next: Partial<Record<ProductKey, string>> = {}
    if (products.length === 0) next.products = '대여를 원하시는 제품을 선택해 주세요.'
    if (otherPicked && !otherProduct.trim()) next.other = '원하시는 제품명을 입력해 주세요.'
    setProductErrors(next)
    if (Object.keys(next).length === 0) go('details')
  }

  const submitDetails = () => {
    const next: Partial<Record<DetailKey, string>> = {}
    if (!purpose.trim()) next.purpose = '사용 목적과 작업 내용을 입력해 주세요.'
    if (!startDate) next.period = '대여 시작일자를 선택해 주세요.'
    else if (startDate < localDate()) next.period = '대여 시작일자는 오늘 이후로 선택해 주세요.'
    else if (!endDate) next.period = '대여 종료일자를 선택해 주세요.'
    else if (endDate < startDate) next.period = '대여 종료일자는 시작일자 이후로 선택해 주세요.'
    if (!agreed) next.agree = '계약서를 열어 아래 동의란에 체크해 주세요.'
    setDetailErrors(next)
    if (Object.keys(next).length === 0) go('review')
  }

  // 이대로 신청하기 — 지금은 3초 기다리는 흉내(제출 함수는 다음 단계)
  const confirmSubmit = () => {
    setSubmitting(true)
    submitTimer.current = window.setTimeout(() => {
      setSubmitting(false)
      go('done')
    }, FAKE_SUBMIT_MS)
  }

  const describedBy = (...ids: (string | null | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined

  // 시작일자를 종료일자 뒤로 옮기면 종료일자를 비운다(종료일자는 시작일자부터 고른다)
  const changeStart = (value: string) => {
    setStartDate(value)
    clearDetail('period')
    if (value && endDate && endDate < value) {
      setEndDate('')
      setEndKey((key) => key + 1)
    }
  }

  // 대여 일수(첫날·마지막 날 포함)와 대여료 — 기기 수 × 일수 × 하루 대여료
  const days = startDate && endDate && endDate >= startDate ? daysBetween(startDate, endDate) : 0
  const fee = days * products.length * RENTAL_FEE_PER_DAY
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
  const periodText = days ? `${dateText(startDate)} ~ ${dateText(endDate)} (${days}일간)` : ''
  const perDevice = products.length > 1 ? ` × ${products.length}대` : ''
  // 계산식 — "1일 10,000원 × 3일(× 2대)"
  const feeFormula = days ? `1일 ${won(RENTAL_FEE_PER_DAY)} × ${days}일${perDevice}` : ''
  // 보증금 — 대여 기간의 영업일(토·일 뺀 날)이 10일 이상이면 기기마다 200,000원
  const businessDays = days ? businessDaysBetween(startDate, endDate) : 0
  const needsDeposit = businessDays >= DEPOSIT_FROM_BUSINESS_DAYS
  const deposit = needsDeposit ? RENTAL_DEPOSIT * products.length : 0
  const depositText = !days
    ? ''
    : needsDeposit
      ? `${won(RENTAL_DEPOSIT)}${perDevice ? `${perDevice} = ${won(deposit)}` : ''} (영업일 ${businessDays}일 · ${DEPOSIT_FROM_BUSINESS_DAYS}영업일 이상)`
      : `없음 (영업일 ${businessDays}일 · ${DEPOSIT_FROM_BUSINESS_DAYS}영업일 미만)`
  const total = fee + deposit
  const totalText = days ? `${won(total)} (대여료 ${won(fee)}${deposit ? ` + 보증금 ${won(deposit)}` : ''})` : ''

  // 계약 동의 — 계약서 창 아래 동의란에서만 바꾼다
  const changeAgreed = (value: boolean) => {
    setAgreed(value)
    if (value) clearDetail('agree')
  }

  // 고른 순서가 아니라 목록 순서로 — 기타는 적은 제품명으로
  const productText = PRODUCTS.filter((p) => products.includes(p))
    .map((p) => (p === PRODUCT_OTHER ? `기타(${otherProduct.trim()})` : p))
    .join(', ')

  const photo = step === 'start' || step === 'done'

  return (
    <div className="tech-form">
      <main className="tech-form__card">
        {photo && <PhotoHead title="xTool 제품 대여 신청" />}
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
              <h1 className="tech-form__sr-only">xTool 제품 대여 신청</h1>
            </div>
          )}

          {step === 'start' && (
            <>
              <h2 className="tech-form__question" id={`${id}-start`}>
                제품 대여를 신청해 주세요.
              </h2>
              <ChoiceList
                options={START}
                value={started ? 'rental' : null}
                onPick={pickStart}
                labelledBy={`${id}-start`}
              />
            </>
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
                  aria-describedby={describedBy(!phoneShown && `${id}-name-hint`, errors.name && `${id}-name-error`)}
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
                    // 주소 칸이 생기면 위 칸 안내는 숨긴다(지금 적는 칸 안내만)
                    hint={
                      addressShown
                        ? undefined
                        : '담당자가 연락드릴 번호를 입력해 주세요. 번호가 정확하지 않을 경우 연락드리기 어려울 수 있습니다.'
                    }
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
                      aria-describedby={describedBy(
                        !addressShown && `${id}-phone-hint`,
                        errors.phone && `${id}-phone-error`,
                      )}
                      onChange={(e) => {
                        setPhone(formatPhoneTyping(e.target.value))
                        clearError('phone')
                      }}
                    />
                  </Field>
                </div>
              )}
              {addressShown && (
                <div className="tech-form__reveal">
                  <Field
                    id={`${id}-address`}
                    label="배송받으실 주소"
                    required
                    hint="대여 제품을 받으실 주소를 상세 주소까지 입력해 주세요."
                    error={errors.address}
                  >
                    <textarea
                      ref={addressRef}
                      id={`${id}-address`}
                      className="tech-form__input tech-form__textarea tech-form__textarea--short"
                      value={address}
                      maxLength={ADDRESS_MAX}
                      rows={2}
                      autoComplete="street-address"
                      placeholder="예: 서울시 강남구 테헤란로 123, 4층"
                      aria-required
                      aria-invalid={!!errors.address}
                      aria-describedby={describedBy(`${id}-address-hint`, errors.address && `${id}-address-error`)}
                      onChange={(e) => {
                        setAddress(e.target.value)
                        clearError('address')
                      }}
                    />
                  </Field>
                </div>
              )}
              <div className="tech-form__actions">
                <button type="submit" className="tech-form__button tech-form__button--block">
                  다음
                </button>
                <BackButton onClick={back} />
              </div>
            </form>
          )}

          {step === 'products' && (
            <form
              className="tech-form__fields"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                submitProducts()
              }}
            >
              <MultiChoiceGrid
                label="대여 희망 제품"
                hint="대여를 원하시는 제품을 모두 선택해 주세요."
                options={PRODUCTS}
                values={products}
                onToggle={toggleProduct}
                error={productErrors.products}
              />
              {otherPicked && (
                <div className="tech-form__reveal">
                  <Field
                    id={`${id}-other`}
                    label="기타 제품"
                    required
                    hint="목록에 없는 제품명을 입력해 주세요."
                    error={productErrors.other}
                  >
                    <input
                      id={`${id}-other`}
                      className="tech-form__input"
                      value={otherProduct}
                      maxLength={OTHER_MAX}
                      aria-required
                      aria-invalid={!!productErrors.other}
                      aria-describedby={describedBy(`${id}-other-hint`, productErrors.other && `${id}-other-error`)}
                      onChange={(e) => {
                        setOtherProduct(e.target.value)
                        clearProduct('other')
                      }}
                    />
                  </Field>
                </div>
              )}
              <div className="tech-form__actions">
                <button type="submit" className="tech-form__button tech-form__button--block">
                  다음
                </button>
                <BackButton onClick={back} />
              </div>
            </form>
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
              <Field
                id={`${id}-purpose`}
                label="사용 목적 및 작업 내용"
                required
                hint="대여 장비로 하실 작업을 적어 주세요. 작업에 필요한 부속품을 넣어드립니다."
                error={detailErrors.purpose}
                footer={
                  <span className="tech-form__count">
                    {purpose.length}/{TEXT_MAX}
                  </span>
                }
              >
                <textarea
                  id={`${id}-purpose`}
                  className="tech-form__input tech-form__textarea"
                  value={purpose}
                  maxLength={TEXT_MAX}
                  rows={5}
                  aria-required
                  aria-invalid={!!detailErrors.purpose}
                  aria-describedby={describedBy(`${id}-purpose-hint`, detailErrors.purpose && `${id}-purpose-error`)}
                  onChange={(e) => {
                    setPurpose(e.target.value)
                    clearDetail('purpose')
                  }}
                />
              </Field>
              <div className="tech-form__field">
                <p className="tech-form__label" id={`${id}-period-label`}>
                  대여 희망 기간
                  <Required />
                </p>
                <p className="tech-form__hint" id={`${id}-period-hint`}>
                  대여 시작일자와 종료일자를 선택해 주세요.
                </p>
                <div className="rental-form__date">
                  <p className="rental-form__date-label" id={`${id}-start-label`}>
                    대여 시작일자
                  </p>
                  <DateSelect
                    value={startDate}
                    onChange={changeStart}
                    min={localDate()}
                    max={localDate(RENTAL_DAYS_AHEAD)}
                    name="대여 시작"
                    invalid={!!detailErrors.period && !startDate}
                    labelledBy={`${id}-period-label ${id}-start-label`}
                    describedBy={describedBy(`${id}-period-hint`, detailErrors.period && `${id}-period-error`)}
                  />
                </div>
                <div className="rental-form__date">
                  <p className="rental-form__date-label" id={`${id}-end-label`}>
                    대여 종료일자
                  </p>
                  <DateSelect
                    key={endKey}
                    value={endDate}
                    onChange={(value) => {
                      setEndDate(value)
                      clearDetail('period')
                    }}
                    min={startDate || localDate()}
                    max={localDate(RENTAL_DAYS_AHEAD)}
                    name="대여 종료"
                    invalid={!!detailErrors.period && !!startDate && !endDate}
                    labelledBy={`${id}-period-label ${id}-end-label`}
                    describedBy={describedBy(`${id}-period-hint`, detailErrors.period && `${id}-period-error`)}
                  />
                </div>
                {days > 0 && (
                  <div aria-live="polite">
                    <p className="rental-form__days">
                      {days}일간
                      <span className="rental-form__days-sub">영업일 {businessDays}일</span>
                    </p>
                    {needsDeposit && (
                      <p className="rental-form__deposit-note">
                        {DEPOSIT_FROM_BUSINESS_DAYS}영업일 이상 대여는 보증금 {won(RENTAL_DEPOSIT)}이 별도로
                        있어요(기기마다). 보증금은 제품 수거 및 상태 확인 후 돌려드려요.
                      </p>
                    )}
                  </div>
                )}
                {detailErrors.period && (
                  <div className="tech-form__under">
                    <p className="tech-form__error" id={`${id}-period-error`} role="alert">
                      {detailErrors.period}
                    </p>
                  </div>
                )}
              </div>
              <div className="tech-form__field">
                <p className="tech-form__label" id={`${id}-agree-label`}>
                  물품 대여 계약
                  <Required />
                </p>
                <p className="tech-form__hint" id={`${id}-agree-hint`}>
                  ㈜시안인터내셔널과 맺는 물품 대여 계약입니다. 계약서를 확인한 뒤 계약서 아래 동의란에 체크해 주세요.
                </p>
                <button
                  type="button"
                  className="tech-form__policy-link rental-form__contract-link"
                  aria-haspopup="dialog"
                  onClick={() => setContractOpen(true)}
                >
                  <FileText size={17} aria-hidden />
                  물품 대여 계약서 보기
                  <ChevronRight size={17} aria-hidden />
                </button>
                {/* 동의 상태 — 여기서는 체크하지 않고, 누르면 계약서 창을 연다(체크는 계약서 창 아래에서만) */}
                <button
                  type="button"
                  className={agreed ? 'rental-form__agree is-on' : 'rental-form__agree'}
                  aria-haspopup="dialog"
                  aria-invalid={!!detailErrors.agree}
                  aria-describedby={describedBy(`${id}-agree-hint`, detailErrors.agree && `${id}-agree-error`)}
                  onClick={() => setContractOpen(true)}
                >
                  <span className="rental-form__agree-box" aria-hidden>
                    {agreed && <Check size={16} strokeWidth={3} />}
                  </span>
                  위 계약 내용을 모두 확인하였으며, 이에 동의합니다.
                </button>
                {detailErrors.agree && (
                  <div className="tech-form__under">
                    <p className="tech-form__error" id={`${id}-agree-error`} role="alert">
                      {detailErrors.agree}
                    </p>
                  </div>
                )}
              </div>
              <div className="tech-form__actions">
                <button type="submit" className="tech-form__button tech-form__button--block">
                  신청하기
                </button>
                <BackButton onClick={back} />
              </div>
            </form>
          )}

          {step === 'review' && (
            <section className="tech-form__fields" aria-labelledby={`${id}-review`}>
              <div className="tech-form__field">
                <h2 className="tech-form__label" id={`${id}-review`}>
                  신청 내용 확인
                </h2>
                <p className="tech-form__hint">아래 내용으로 신청할게요. 고칠 내용이 있으면 이전을 눌러 주세요.</p>
              </div>
              <dl className="tech-form__review">
                <ReviewRow label="성함">{name.trim()}</ReviewRow>
                <ReviewRow label="연락처">{phone}</ReviewRow>
                <ReviewRow label="배송 주소">
                  <span className="tech-form__review-text">{address.trim()}</span>
                </ReviewRow>
                <ReviewRow label="대여 제품">{productText}</ReviewRow>
                <ReviewRow label="사용 목적">
                  <span className="tech-form__review-text">{purpose.trim()}</span>
                </ReviewRow>
                <ReviewRow label="대여 기간">{periodText}</ReviewRow>
                <ReviewRow label="예상 대여료">
                  {won(fee)}
                  <span className="rental-form__review-sub">{feeFormula}</span>
                </ReviewRow>
                <ReviewRow label="보증금">
                  {deposit ? won(deposit) : '없음'}
                  <span className="rental-form__review-sub">
                    영업일 {businessDays}일 · {DEPOSIT_FROM_BUSINESS_DAYS}영업일 {needsDeposit ? '이상' : '미만'}
                  </span>
                </ReviewRow>
                <ReviewRow label="결제 예정">{won(total)}</ReviewRow>
                <ReviewRow label="계약 동의">동의함</ReviewRow>
              </dl>
              <div className="tech-form__actions">
                <button
                  type="button"
                  className="tech-form__button tech-form__button--block"
                  disabled={submitting}
                  onClick={confirmSubmit}
                >
                  이대로 신청하기
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
                대여 신청이 접수되었어요
              </h2>
              <p className="tech-form__done-text">담당자가 확인한 뒤 남겨 주신 연락처로 연락드릴게요.</p>
            </section>
          )}
        </div>

        {noticeOpen && <RentalNoticeModal onConfirm={confirmNotice} onClose={closeNotice} />}
        {contractOpen && (
          <RentalContractModal
            applicant={{
              name: name.trim(),
              phone,
              address: address.trim(),
              products: productText,
              period: periodText,
              fee: days ? `${feeFormula} = ${won(fee)}` : '',
              deposit: depositText,
              total: totalText,
            }}
            agreed={agreed}
            onAgreeChange={changeAgreed}
            read={contractRead}
            onRead={markContractRead}
            onClose={closeContract}
          />
        )}

        {/* 신청하는 동안 — 화면을 덮는 로딩 */}
        {submitting && (
          <div className="tech-form__loading" role="status" aria-live="polite">
            <LoaderCircle className="tech-form__spinner" size={40} aria-hidden />
            <p>신청하고 있어요…</p>
          </div>
        )}
      </main>
    </div>
  )
}
