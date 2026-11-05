import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { searchAddress, type AddressResult } from '@xtool-core/tech-boards'
import type { LocationState } from '@xtool-core/tech-edit'
import { addressErrorText } from '@xtool-core/error-text'
import { isComposing } from '../../lib/ime'

// 주소 칸 하나의 검색·고르기 — 대시보드 편집 판·Monday 표 팝오버의 주소 칸(LocationInput)과 물 주소 칸
// (WaterLocationInput)이 같이 쓴다. 모양은 저마다 그리고, 검색(늦게 온 옛 응답은 버린다)·오류와 빈 결과·다시
// 찾기·결과 짚기(↑↓는 끝에서 돈다, 엔터로 넣기, 한글 조합 중 엔터는 건너뛴다)·Esc(초점이 칸 안이면 목록만
// 닫는다)의 규칙은 여기 하나다(파일 칸의 use-file-column.ts와 같은 방법).

/** 결과 목록에서 짚은 줄 — 없으면 -1. keyboard면 그 줄이 보이게 굴린다. at은 짚은 시각(물 강조 알약이 그때부터 간다) */
export interface AddressPointer {
  index: number
  keyboard: boolean
  at: number
}

const NO_POINTER: AddressPointer = { index: -1, keyboard: false, at: 0 }

interface AddressSearchOptions {
  /** 입력 칸 id — 결과 목록은 `${id}-results`, 줄은 `${id}-results-${i}` */
  id: string
  value: LocationState
  onChange: (value: LocationState) => void
  /** 주소 검색 — 기본은 카카오(searchAddress). 카탈로그 견본처럼 가짜로 바꿔 끼울 때만 준다 */
  search?: (query: string) => Promise<AddressResult[]>
  /** 목록이 사라지는 움직임이 있는지(물) — 있으면 닫을 때 closing으로 두고, 움직임이 끝나면 closed()로 내린다 */
  fade?: boolean
  /** 짚은 시각을 재는 시계(물은 waterClock) — 없으면 0 */
  clock?: () => number
}

export function useAddressSearch({ id, value, onChange, search = searchAddress, fade = false, clock }: AddressSearchOptions) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AddressResult[] | null>(null)
  /** 결과를 찾은 말 — 빈 결과 안내에 쓴다 */
  const [searched, setSearched] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pointer, setPointer] = useState(NO_POINTER)
  /** 걷히는 중(물) — 사라지는 움직임이 끝나면 목록을 내린다 */
  const [closing, setClosing] = useState(false)
  /** 초점이 주소 칸 안에 있는지 — 있을 때만 Esc를 목록이 가져간다(밖에 있으면 편집 판·서랍·팝오버가 닫힌다) */
  const [focusIn, setFocusIn] = useState(false)
  /** 나중에 보낸 검색만 받는다(앞의 것이 늦게 와도 덮지 않게) */
  const request = useRef(0)
  const listId = `${id}-results`
  const hasCoords = Boolean(value.lat && value.lng)
  const open = results !== null && !closing
  /** 고를 수 있는 결과 — 펼쳐 있고 하나라도 있을 때만 */
  const options = open && results.length > 0 ? results : null
  const active = options ? pointer.index : -1

  // 바로 내린다
  const closed = () => {
    setResults(null)
    setClosing(false)
    setPointer(NO_POINTER)
  }
  // 닫기 — 사라지는 움직임이 있으면 걷히는 중으로 둔다
  const close = () => {
    if (results === null) return
    if (fade) setClosing(true)
    else closed()
  }

  const run = async () => {
    const q = query.trim()
    if (q.length < 2) {
      setError('두 글자 이상 적어 주세요.')
      return
    }
    const n = ++request.current
    setSearching(true)
    setError(null)
    try {
      const list = await search(q)
      if (n !== request.current) return
      setResults(list)
      setSearched(q)
      setPointer(NO_POINTER)
      setClosing(false)
    } catch (e) {
      if (n !== request.current) return
      closed()
      setError(addressErrorText(e))
    } finally {
      if (n === request.current) setSearching(false)
    }
  }

  const pick = (r: AddressResult) => {
    // 주소를 바꿔도 적어 둔 상세 주소는 남긴다.
    onChange({ address: r.address, detail: value.detail, lat: r.lat, lng: r.lng })
    setQuery('')
    close()
  }

  const point = (index: number, keyboard = false) => setPointer({ index, keyboard, at: clock ? clock() : 0 })

  // 입력 칸 — 편집 폼 전체가 저장되지 않게 엔터는 짚은 주소 넣기(짚은 줄이 없으면 주소 검색), ↑↓는 결과 사이를
  // 끝에서 돌며 짚는다(combobox)
  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // 한글 조합 중 엔터는 확정된 뒤 한 번 더 오니 그때 한다.
      if (isComposing(e)) return
      const r = options && active >= 0 ? options[active] : undefined
      if (r) pick(r)
      else void run()
      return
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && options) {
      e.preventDefault()
      const n = options.length
      point(e.key === 'ArrowDown' ? (active + 1) % n : active <= 0 ? n - 1 : active - 1, true)
    }
  }

  // 칸 전체 — 초점이 안에 있는지 기억하고, Esc는 목록만 닫는다. 잡기 단계로 듣는 위 판(편집 판·위 서랍·Monday
  // 팝오버)은 [data-popover-open]을 보고 양보하고, 거품 단계로 듣는 아래 판(편집 판 밑의 상세 판 — 이 목록이 자기
  // 안에 없어 양보하지 않는다)까지 가서 같이 닫히지 않게 여기서 막는다.
  const fieldProps = {
    onFocus: () => setFocusIn(true),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusIn(false)
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    },
  }

  return {
    query,
    setQuery,
    results,
    searched,
    searching,
    error,
    pointer,
    /** 짚은 줄(고를 결과가 없으면 -1) */
    active,
    options,
    closing,
    /** 이때만 목록에 data-popover-open을 단다 — 위 판이 Esc를 목록에 양보한다(걷히는 중에는 달지 않는다) */
    holdsEscape: focusIn && !closing,
    listId,
    hasCoords,
    /** "다시 찾기"를 보일지 — 두 글자 이상 적었을 때 */
    canRetry: query.trim().length >= 2,
    run,
    pick,
    point,
    closed,
    onInputKeyDown,
    fieldProps,
    /** 주소 지우기 */
    clear: () => onChange({ address: '', detail: '', lat: '', lng: '' }),
    /** 상세 주소 고치기 */
    setDetail: (detail: string) => onChange({ ...value, detail }),
  }
}
