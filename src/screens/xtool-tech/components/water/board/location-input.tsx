import { AlertCircle, MapPin, Search } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { AddressResult } from '../../../data/tech-boards'
import type { LocationState } from '../../../data/tech-edit'
import { useAddressSearch, type AddressPointer } from '../../board/use-address-search'
import { cx } from '@/ohq-ui/lib/cx'
import { WaterButton, WaterTextField } from '@/ohq-ui/water/controls'
import { useReducedMotion, useWaterIndicator } from '@/ohq-ui/water/hooks'
import { waterClock } from '@/ohq-ui/water/motion'
import { WaterTextLink } from './links'

interface WaterLocationInputProps {
  id: string
  value: LocationState
  onChange: (value: LocationState) => void
  /** 주소 검색 — 기본은 카카오(searchAddress). 카탈로그 견본처럼 가짜로 바꿔 끼울 때만 준다 */
  search?: (query: string) => Promise<AddressResult[]>
}

/**
 * 주소 칸(물) — 카카오 주소 검색(searchAddress)으로 고르면 좌표까지 들어간다(Monday 주소 칸은 좌표가 있어야
 * 써진다). 상세 주소는 고른 주소 뒤에 붙어 "{주소}, {상세주소}"로 저장된다 — 기존 LocationInput과 같은 동작.
 * 입력·단추는 기본 부품(WaterTextField · WaterButton glass) — 이름은 편집 칸이 바깥에 달아 칸 이름은 읽기용만
 * 둔다. 결과는 유리 목록이 살짝 내려앉으며 나타나고(표시 알약 스프링) 줄은 D7 차례(21ms 간격 55ms)로 진해진다.
 * ↑↓로 고르고 엔터로 넣는다(입력 칸에서 — combobox), Esc는 목록만 걷는다(서랍은 그대로). 검색·고르기는
 * 대시보드 주소 칸과 같이 쓴다(useAddressSearch) — 물은 걷히는 움직임(fade)과 짚은 시각(waterClock)만 더한다.
 */
export function WaterLocationInput({ id, value, onChange, search }: WaterLocationInputProps) {
  const reduced = useReducedMotion()
  // 동작 줄이기면 바로 내린다(사라지는 움직임이 없다). 걷히는 움직임은 15ms 뒤 30ms
  const address = useAddressSearch({ id, value, onChange, search, fade: !reduced, clock: waterClock })
  const { query, results, searched, searching, error, pointer, active, options, closing, listId, hasCoords } = address

  return (
    <div className="water-address" {...address.fieldProps}>
      {value.address ? (
        <p className="water-address__current">
          <MapPin size={14} aria-hidden />
          <span>{value.address}</span>
          {!hasCoords && <small>(좌표 없음 — 다시 검색해 고르면 저장할 수 있어요)</small>}
          <WaterTextLink onClick={address.clear}>지우기</WaterTextLink>
        </p>
      ) : (
        <p className="water-address__current water-address__current--empty">주소 없음 — 아래에서 검색해 골라 주세요</p>
      )}
      {value.address && (
        <WaterTextField
          className="water-board-quiet-label"
          label="상세 주소"
          placeholder="상세 주소(동·호수, 층 등)"
          value={value.detail}
          disabled={!hasCoords}
          onChange={(e) => address.setDetail(e.target.value)}
        />
      )}
      <div className="water-address__search">
        <WaterTextField
          id={id}
          className="water-board-quiet-label water-address__query"
          label="주소 검색"
          placeholder={value.address ? '다른 주소로 바꾸기 — 도로명·지번이나 장소 이름' : '도로명·지번 주소나 장소 이름'}
          value={query}
          role="combobox"
          aria-autocomplete="none"
          aria-expanded={Boolean(options)}
          aria-controls={options ? listId : undefined}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => address.setQuery(e.target.value)}
          onKeyDown={address.onInputKeyDown}
        />
        <WaterButton variant="glass" icon={Search} onClick={() => void address.run()} loading={searching}>
          {searching ? '찾는 중…' : '검색'}
        </WaterButton>
      </div>
      {error && (
        <p className="water-address__error" role="alert">
          <AlertCircle size={14} aria-hidden />
          <span>{error}</span>
          {address.canRetry && <WaterTextLink onClick={() => void address.run()}>다시 찾기</WaterTextLink>}
        </p>
      )}
      {results && (
        <AddressResults
          listId={listId}
          results={results}
          searched={searched}
          pointer={pointer}
          closing={closing}
          holdsEscape={address.holdsEscape}
          onPick={address.pick}
          onPoint={(i) => address.point(i)}
          onClosed={address.closed}
        />
      )}
    </div>
  )
}

interface AddressResultsProps {
  listId: string
  results: AddressResult[]
  searched: string
  /** 짚은 줄 — 걷히는 중에도 그대로 둔다(사라지는 동안 강조가 남게). at부터 강조 알약이 스프링으로 간다 */
  pointer: AddressPointer
  closing: boolean
  /** 초점이 주소 칸 안 — 이때만 data-popover-open을 달아 서랍이 Esc를 양보한다 */
  holdsEscape: boolean
  onPick: (r: AddressResult) => void
  onPoint: (i: number) => void
  onClosed: () => void
}

/**
 * 결과 유리 목록 — 나타날 때 6px 위에서 표시 알약 스프링(ζ0.65·ω30.5)으로 내려앉으며 0.1초 동안 진해지고, 줄은
 * 12ms 뒤부터 21ms 간격으로 55ms 동안(D7 WATER_REVEAL). 걷힐 때는 15ms 뒤 30ms 동안 흐려진다(D7 접힘 F23).
 * 짚은 줄 뒤에는 반투명 흰 알약이 스프링으로 따라간다(넓은 줄이라 옆 찌그러짐은 squash 0.06).
 */
function AddressResults({
  listId,
  results,
  searched,
  pointer,
  closing,
  holdsEscape,
  onPick,
  onPoint,
  onClosed,
}: AddressResultsProps) {
  const active = pointer.index
  const reduced = useReducedMotion()
  const listRef = useRef<HTMLUListElement>(null)
  const { ref: hiliteRef, engine: hiliteEngine } = useWaterIndicator<HTMLLIElement>({ axis: 'y', squash: 0.06 })
  const shown = useRef(false)

  // 짚은 줄로 — 처음은 바로 놓고, 그다음부터 스프링으로 따라간다. 키보드면 그 줄이 보이게 굴린다
  useLayoutEffect(() => {
    const list = listRef.current
    const hilite = hiliteRef.current
    const engine = hiliteEngine.current
    if (!list || !hilite || !engine) return
    const row = active >= 0 ? document.getElementById(`${listId}-${active}`) : null
    if (!row) {
      hilite.classList.remove('is-shown')
      shown.current = false
      return
    }
    engine.set(
      { pos: row.offsetTop + row.offsetHeight / 2, size: row.offsetHeight },
      { instant: !shown.current || reduced, at: pointer.at, step: row.offsetHeight },
    )
    hilite.classList.add('is-shown')
    shown.current = true
    if (pointer.keyboard) row.scrollIntoView({ block: 'nearest' })
  }, [active, listId, pointer, reduced, hiliteRef, hiliteEngine])

  // 걷힐 때 — 사라지는 움직임이 끝나면(animationend) 내린다. 움직임이 안 돌아도 0.15초 뒤에는 내린다
  useEffect(() => {
    if (!closing) return
    const t = window.setTimeout(onClosed, 150)
    return () => window.clearTimeout(t)
  }, [closing, onClosed])

  const empty = results.length === 0
  return (
    <div
      className={cx('water-address__results', closing && 'is-closing', empty && 'water-address__results--empty')}
      data-popover-open={closing || !holdsEscape ? undefined : ''}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onClosed()
      }}
    >
      {empty ? (
        <p className="water-address__none" role="status">
          <strong>‘{searched}’에 맞는 주소가 없어요</strong>
          <span>도로명·지번 주소나 건물 이름으로 다시 찾아 보세요.</span>
        </p>
      ) : (
        <ul
          ref={listRef}
          id={listId}
          className="water-address__list"
          role="listbox"
          aria-label={`검색 결과 ${results.length}개`}
          onMouseLeave={() => onPoint(-1)}
        >
          <li ref={hiliteRef} className="water-address__hilite" role="presentation" aria-hidden />
          {results.map((r, i) => (
            <li
              key={`${r.lat},${r.lng},${r.label}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cx('water-address__option', i === active && 'is-active')}
              style={{ '--i': Math.min(i, 8) } as CSSProperties}
              // 입력 칸 초점을 그대로 둔다(↑↓·엔터를 계속 받게)
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => {
                if (i !== active) onPoint(i)
              }}
              onClick={() => onPick(r)}
            >
              <strong title={r.label}>{r.label}</strong>
              {r.label !== r.address && <span title={r.address}>{r.address}</span>}
              {r.jibun && <small title={`지번 ${r.jibun}`}>지번 {r.jibun}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
