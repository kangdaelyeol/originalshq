import { useLayoutEffect, useRef } from 'react'

/** 쉼표 없는 글자 → 화면에 보일 글자(천 단위 쉼표, 소수는 그대로). */
const withCommas = (raw: string) => {
  if (!raw) return ''
  const [int, decimals] = raw.split('.')
  const grouped = Number(int || '0').toLocaleString('ko-KR')
  return decimals === undefined ? grouped : `${grouped}.${decimals}`
}

/**
 * 숫자 칸 — 쓰는 대로 천 단위 쉼표를 넣고(1,234,567), 단위(원·%)는 칸 안
 * 오른쪽에 붙인다. 값은 쉼표 없는 글자로 주고받는다(저장할 때 숫자로 바꾼다).
 * 쉼표가 생기고 빠져도 커서가 쓰던 자리에 남도록, 커서 앞 숫자 개수를 기억해
 * 다시 놓는다. decimal이면 소수점 하나와 소수 둘째 자리까지.
 */
export function NumberInput({
  value,
  onChange,
  unit,
  label,
  decimal = false,
  placeholder = '0',
}: {
  value: string
  onChange: (raw: string) => void
  unit: string
  /** 읽어 주는 이름 — 칸 위 글자와 같게. */
  label: string
  decimal?: boolean
  placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  // 바꾼 뒤 커서를 놓을 자리 — 커서 앞에 있던 숫자(와 소수점) 개수.
  const caret = useRef<number | null>(null)
  const keep = decimal ? /[^\d.]/g : /\D/g

  useLayoutEffect(() => {
    const input = ref.current
    if (caret.current === null || !input) return
    let left = caret.current
    let at = 0
    while (at < input.value.length && left > 0) {
      if (/[\d.]/.test(input.value[at])) left -= 1
      at += 1
    }
    input.setSelectionRange(at, at)
    caret.current = null
  })

  return (
    <span className="ad-number">
      <input
        ref={ref}
        className="ad-input is-number"
        inputMode={decimal ? 'decimal' : 'numeric'}
        aria-label={label}
        placeholder={placeholder}
        value={withCommas(value)}
        onChange={(event) => {
          const text = event.target.value
          const at = event.target.selectionStart ?? text.length
          let raw = text.replace(keep, '')
          if (decimal) {
            const [int, ...rest] = raw.split('.')
            raw = rest.length ? `${int}.${rest.join('').slice(0, 2)}` : int
          }
          // 앞자리 0은 지운다(0.5는 둔다).
          raw = raw.replace(/^0+(?=\d)/, '')
          caret.current = Math.min(
            text.slice(0, at).replace(keep, '').length,
            raw.length,
          )
          onChange(raw)
        }}
      />
      <span className="ad-number__unit" aria-hidden="true">
        {unit}
      </span>
    </span>
  )
}
