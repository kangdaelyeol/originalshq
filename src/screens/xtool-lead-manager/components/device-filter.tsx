import { useRef, useState } from 'react'
import { useOutsideClick } from '@/screens/xtool-lead-manager/hooks'
import { DeviceFilterLabel } from '@/screens/xtool-lead-manager/types'
import '@/screens/xtool-lead-manager/styles/device-filter.scss'

export const DeviceFilter = ({
  value,
  onChange,
}: {
  value: DeviceFilterLabel
  onChange: (device: DeviceFilterLabel) => void
}) => {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useOutsideClick(wrapRef, () => setOpen(false))

  const handleSelect = (device: DeviceFilterLabel) => {
    onChange(device)
    setOpen(false)
  }

  return (
    <div className="device_filter" ref={wrapRef}>
      <button
        type="button"
        className={[
          'device_filter_btn',
          open ? 'open' : '',
          value !== DeviceFilterLabel.ALL ? 'active' : '',
        ].join(' ')}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{value}</span>
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
          <button
            type="button"
            className={[
              'device_filter_item',
              value === DeviceFilterLabel.ALL ? 'selected' : '',
            ].join(' ')}
            onClick={() => handleSelect(DeviceFilterLabel.ALL)}
          >
            전체 기기
          </button>
          <div className="menu_divider" />
          {Object.values(DeviceFilterLabel)
            .filter((v) => v !== DeviceFilterLabel.ALL)
            .map((device) => (
              <button
                type="button"
                key={device}
                className={[
                  'device_filter_item',
                  value === device ? 'selected' : '',
                ].join(' ')}
                onClick={() => handleSelect(device)}
              >
                {device}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
