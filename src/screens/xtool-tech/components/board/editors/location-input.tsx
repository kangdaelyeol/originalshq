import { MapPin, Search } from 'lucide-react'
import { useEffect } from 'react'
import type { LocationState } from '@xtool-core/tech-edit'
import { Button } from '../../layout-parts'
import { AddressMap } from '../address-map'
import { useAddressSearch } from '../use-address-search'

// 편집 판·Monday 표 팝오버의 주소 칸 — 물 레이아웃은 같은 props의 WaterLocationInput
// (components/water/board/location-input.tsx)으로 바꿔 끼운다.

/** 주소 칸 — 검색해서 고르면 좌표까지 들어간다(Monday 주소 칸은 좌표가 있어야 써진다).
 * 상세 주소(동·호수 등)는 고른 주소 뒤에 붙어 "{주소}, {상세주소}"로 저장된다.
 * 결과는 입력 칸에서 ↑↓(끝에서 돈다)로 짚고 엔터로 넣는다(combobox) — Esc는 목록만 닫는다(편집 판·Monday
 * 팝오버는 그대로). 늦게 온 옛 검색은 버리고, 함수가 보낸 오류 문구는 그대로 보인다. 검색·고르기는 물 주소
 * 칸과 같이 쓴다(useAddressSearch). */
export function LocationInput({ id, value, onChange }: { id: string; value: LocationState; onChange: (value: LocationState) => void }) {
  const address = useAddressSearch({ id, value, onChange })
  const { query, results, searched, searching, error, pointer, active, options, listId, hasCoords } = address

  // 키보드로 옮긴 줄이 목록 밖이면 보이게 굴린다
  useEffect(() => {
    if (pointer.keyboard && pointer.index >= 0) {
      document.getElementById(`${listId}-${pointer.index}`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [pointer, listId])

  return (
    <div className="address-input" {...address.fieldProps}>
      {value.address ? (
        <p className="address-input__current">
          <MapPin size={14} aria-hidden />
          <span>{value.address}</span>
          {!hasCoords && <small>(좌표 없음 — 다시 검색해 고르면 저장할 수 있어요)</small>}
          <button type="button" className="text-link" onClick={address.clear}>
            지우기
          </button>
        </p>
      ) : (
        <p className="address-input__current address-input__current--empty">주소 없음 — 아래에서 검색해 골라 주세요</p>
      )}
      {value.address && (
        <input
          className="field__input"
          placeholder="상세 주소(동·호수, 층 등)"
          aria-label="상세 주소"
          value={value.detail}
          disabled={!hasCoords}
          onChange={(e) => address.setDetail(e.target.value)}
        />
      )}
      {value.address && <AddressMap address={value.address} lat={value.lat} lng={value.lng} />}
      <div className="address-input__search">
        <input
          id={id}
          className="field__input"
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
        <Button variant="ghost" icon={Search} onClick={() => void address.run()} disabled={searching}>
          {searching ? '찾는 중…' : '검색'}
        </Button>
      </div>
      {error && (
        <p className="editor__error" role="alert">
          {error}
          {address.canRetry && (
            <button type="button" className="text-link address-input__retry" onClick={() => void address.run()}>
              다시 찾기
            </button>
          )}
        </p>
      )}
      {/* 펼쳐 있고 초점이 칸 안이면 data-popover-open — 편집 판·Monday 팝오버가 Esc를 이 목록에 양보한다 */}
      {results && !options && (
        <div className="address-input__results" role="status" data-popover-open={address.holdsEscape ? '' : undefined}>
          <p className="address-input__none">
            <strong>‘{searched}’에 맞는 주소가 없어요</strong>
            <span>도로명·지번 주소나 건물 이름으로 다시 찾아 보세요.</span>
          </p>
        </div>
      )}
      {options && (
        <ul
          id={listId}
          className="address-input__results"
          role="listbox"
          aria-label={`검색 결과 ${options.length}개`}
          data-popover-open={address.holdsEscape ? '' : undefined}
          onMouseLeave={() => address.point(-1)}
        >
          {options.map((r, i) => (
            <li key={`${r.lat},${r.lng},${r.label}`} role="presentation">
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                className={i === active ? 'is-active' : undefined}
                // 입력 칸 초점을 그대로 둔다(↑↓·엔터를 계속 받게)
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => {
                  if (i !== active) address.point(i)
                }}
                onClick={() => address.pick(r)}
              >
                <strong>{r.label}</strong>
                {r.label !== r.address && <span>{r.address}</span>}
                {r.jibun && <small>지번 {r.jibun}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
