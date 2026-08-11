import { useRef, useState } from 'react'
import '@/screens/xtool-lead-manager/styles/device-filter.scss'
import { useOutsideClick } from '../hooks/use-outside-click'
import type { DeviceFilter as DeviceFilterType } from '../types'
import { DEVICE_OPTIONS } from '../types'

const DEVICE_LABEL: Record<DeviceFilterType, string> = {
  all: '전체 기기',
  F2Ultra: 'F2Ultra',
  F2UltraUV: 'F2UltraUV',
  P3: 'P3',
  DTF: 'DTF',
  Metalfab: 'Metalfab',
}

export const DeviceFilter = ({
  value,
  onChange,
}: {
  value: DeviceFilterType
  onChange: (device: DeviceFilterType) => void
}) => {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useOutsideClick(wrapRef, () => setOpen(false))

  const handleSelect = (device: DeviceFilterType) => {
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
          value !== 'all' ? 'active' : '',
        ].join(' ')}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{DEVICE_LABEL[value]}</span>
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

      {open && (
        <div className="device_filter_menu">
          <button
            type="button"
            className={[
              'device_filter_item',
              value === 'all' ? 'selected' : '',
            ].join(' ')}
            onClick={() => handleSelect('all')}
          >
            전체 기기
          </button>
          <div className="menu_divider" />
          {DEVICE_OPTIONS.map((device) => (
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
