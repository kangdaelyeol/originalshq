import { useRef, useState } from 'react'
import { useOutsideClick } from '@/screens/xtool-lead-manager/hooks'
import { Device } from '@/screens/xtool-lead-manager/entity'
import '@/screens/xtool-lead-manager/styles/device-filter.scss'

const ALL_DEVICES = Object.values(Device)

/** 표를 필터링할 기기 다중 선택 드롭다운 — 상담/구매 이력 중 어느 하나라도
 * 선택된 기기와 일치하면 그 고객을 보여준다. 아무 것도 선택하지 않으면
 * (기본값) 전체 기기를 보여준다. 예전엔 "상담기기 서머리" 표가 상담 이력만
 * 대상으로 같은 다중 선택 필터를 따로 갖고 있었는데, 이 필터가 상담+구매
 * 이력을 이미 같은 방식으로 걸러주므로 기능이 겹쳐 그 표는 없애고 이 필터
 * 하나로 합쳤다. */
export const DeviceFilter = ({
  selectedDevices,
  onToggleDevice,
}: {
  selectedDevices: ReadonlySet<Device>
  onToggleDevice: (device: Device) => void
}) => {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useOutsideClick(wrapRef, () => setOpen(false))

  const triggerLabel =
    selectedDevices.size === 0
      ? '전체 기기'
      : `${selectedDevices.size}개 기기`

  return (
    <div className="device_filter" ref={wrapRef}>
      <button
        type="button"
        className={[
          'device_filter_btn',
          open ? 'open' : '',
          selectedDevices.size > 0 ? 'active' : '',
        ].join(' ')}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{triggerLabel}</span>
        <div className="chevron_box">
          <svg viewBox="0 0 20 20" fill="none" className="chevron">
            <path
              d="M5 7.5 10 12.5 15 7.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {/* Device filter dropdown box */}
      {open && (
        <div className="device_filter_menu">
          {ALL_DEVICES.map((device) => (
            <label key={device} className="device_filter_item">
              <input
                type="checkbox"
                checked={selectedDevices.has(device)}
                onChange={() => onToggleDevice(device)}
              />
              <span>{device}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
