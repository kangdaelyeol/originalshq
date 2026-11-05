import '@/screens/xtool-lead-manager/styles/device-chips.scss'
import { Device } from '@/screens/xtool-lead-manager/entity'

const ALL_DEVICES = Object.values(Device)

/** 상담 기기 여러 개 고르기 — 관심 기기를 여러 개 고른 상담(기타 오프라인
 * 보드 등). 켜고 끄는 칩이고, 마지막 하나는 끄지 않는다(상담엔 기기가 적어도
 * 하나 있어야 한다). 서버가 그중 예상 금액이 가장 큰 기기를 대표로 둔다. */
export const DeviceChips = ({
  value,
  onChange,
  label = '기기',
}: {
  value: readonly Device[]
  onChange: (next: Device[]) => void
  label?: string
}) => (
  <div className="device_chips" role="group" aria-label={label}>
    {ALL_DEVICES.map((device) => {
      const on = value.includes(device)
      return (
        <button
          key={device}
          type="button"
          className={on ? 'device_chip active' : 'device_chip'}
          aria-pressed={on}
          onClick={() => {
            if (!on)
              onChange(
                ALL_DEVICES.filter((d) => d === device || value.includes(d)),
              )
            else if (value.length > 1)
              onChange(value.filter((d) => d !== device))
          }}
        >
          {device}
        </button>
      )
    })}
  </div>
)
