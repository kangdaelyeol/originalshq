import { Check, ChevronRight } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import heroImage from '@/assets/xtool-tech-support-korean.jpeg'
import { SupportCenterLogo } from './xtool-logo'

// 고객용 폼(기술문의 /xtool/support · 제품 대여 /xtool/rental)이 같이 쓰는 부품 — 칸·단추 고르기·이전 단추·확인 줄·사진
// 머리. 모양은 tech-form.scss(.tech-form 아래)를 그대로 쓴다.

/** 칸 하나 — 이름(필수 표시)·설명·입력·오류(·글자 수) */
export function Field({
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

export function Required() {
  return (
    <span className="tech-form__required" aria-hidden>
      *
    </span>
  )
}

/** 단추 고르기 — 2열 큰 단추(list면 세로 한 줄씩 넓게), 고른 것은 강조색 테두리·체크 */
export function ChoiceGrid({
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
export function ChoiceList({
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

/** "이전" — "다음"과 같은 크기의 흰 단추 */
export function BackButton({
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
export function ReviewRow({
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

/** 사진 머리(시작·완료 화면) — 로고 헤더와 사진이 같은 바탕색(사진 위쪽 색)이라 한 장처럼 보인다. title은 화면 읽기용
 * 제목(보이지 않는다) */
export function PhotoHead({ title }: { title: string }) {
  return (
    <>
      <header className="tech-form__header">
        <div className="tech-form__brand">
          <SupportCenterLogo className="tech-form__support-logo" />
          <h1 className="tech-form__sr-only">{title}</h1>
        </div>
      </header>
      <div className="tech-form__hero" aria-hidden>
        <img src={heroImage} alt="" />
      </div>
    </>
  )
}
