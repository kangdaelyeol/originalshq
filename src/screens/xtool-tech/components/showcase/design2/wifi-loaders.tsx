import { cx } from '../../../lib/cx'
import { LoaderFrame } from './loader-frame'
import type { LoaderProps } from './types'

// 와이파이: 점 (31, 43.75) 을 중심으로 반지름 8.65·16.75·24.85 의 호(좌우 50도씩)
const WIFI_ARCS = [
  'M24.37 38.19A8.65 8.65 0 0 1 37.63 38.19',
  'M18.17 32.98A16.75 16.75 0 0 1 43.83 32.98',
  'M11.96 27.78A24.85 24.85 0 0 1 50.04 27.78',
]

function WifiDot({ className }: { className?: string }) {
  return <circle className={className} cx={31} cy={43.75} r={2.45} />
}

function WifiArcs({ name }: { name: string }) {
  return (
    <>
      {WIFI_ARCS.map((d, i) => (
        <path key={d} className={`d2-wifi__arc ${name}__arc ${name}__arc--${i + 1}`} d={d} />
      ))}
    </>
  )
}

/** 호가 점에서 하나씩 바깥으로 밀려 나와 자리 잡고, 안쪽부터 차례로 사라진다. */
export function LoaderWifiEmerge(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-wifi-emerge">
      <WifiDot />
      <WifiArcs name="d2-wifi-emerge" />
    </LoaderFrame>
  )
}

/** 호가 안쪽부터 커지며 차례로 켜지고, 다 켜지면 함께 천천히 꺼진다. */
export function LoaderWifiCascade(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-wifi-cascade">
      <WifiDot />
      <WifiArcs name="d2-wifi-cascade" />
    </LoaderFrame>
  )
}

/** 호가 빠르게 차례로 켜졌다가 한꺼번에 꺼진다(0.9초). */
export function LoaderWifiBlink(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-wifi-blink">
      <WifiDot />
      <WifiArcs name="d2-wifi-blink" />
    </LoaderFrame>
  )
}

// 점 모양일 때(--d2-t = --d2-h = 0)와 호 모양을 오가야 해서 원 둘레의 대시로 그린다
const MORPH_RADII = [8.65, 16.75, 24.85]

/** 점 하나가 튀어나와 위로 점 세 개를 쌓고, 점이 옆으로 늘어 호가 됐다가 거꾸로 되돌아간다. */
export function LoaderWifiMorph(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-wifi-morph">
      <WifiDot className="d2-wifi-morph__dot" />
      {MORPH_RADII.map((r, i) => (
        <g key={r} className={`d2-wifi-morph__lift d2-wifi-morph__lift--${i + 1}`}>
          <circle
            className={cx('d2-arc d2-wifi-morph__arc', `d2-wifi-morph__arc--${i + 1}`)}
            cx={31}
            cy={43.75}
            r={r}
            pathLength={360}
          />
        </g>
      ))}
    </LoaderFrame>
  )
}

/** 호가 통통 튀며 하나씩 튀어나오고, 바깥 것부터 한 번 부풀었다 들어간다. */
export function LoaderWifiPop(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-wifi-pop">
      <WifiDot />
      <WifiArcs name="d2-wifi-pop" />
    </LoaderFrame>
  )
}

// 안테나: 공 (31, 21.6), 안쪽·바깥 전파 한 쌍씩
const WAVES = {
  inner: ['M39.72 17.35A9.7 9.7 0 0 1 39.72 25.85', 'M22.28 25.85A9.7 9.7 0 0 1 22.28 17.35'],
  outer: ['M45.29 12.67A16.85 16.85 0 0 1 45.29 30.53', 'M16.71 30.53A16.85 16.85 0 0 1 16.71 12.67'],
}

function Antenna({ name }: { name: string }) {
  return (
    <>
      <line className="d2-antenna__mast" x1={31} y1={21.6} x2={31} y2={49.75} />
      <circle className={`${name}__ball`} cx={31} cy={21.6} r={3.85} />
      {(['inner', 'outer'] as const).map((k) => (
        <g key={k} className={`d2-antenna__waves ${name}__waves ${name}__waves--${k}`}>
          {WAVES[k].map((d) => (
            <path key={d} className="d2-antenna__wave" d={d} />
          ))}
        </g>
      ))}
    </>
  )
}

/** 안테나 양옆으로 전파 두 겹이 퍼져 나왔다가 안쪽부터 흐려진다. */
export function LoaderAntennaWaves(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-antenna-waves">
      <Antenna name="d2-antenna-waves" />
    </LoaderFrame>
  )
}

/** 안테나 끝 공이 콩닥일 때마다 전파가 하나씩 나오고, 안쪽부터 사라진다. */
export function LoaderAntennaPulse(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-antenna-pulse">
      <Antenna name="d2-antenna-pulse" />
    </LoaderFrame>
  )
}

/** 전파가 통통 튀며 튀어나오고, 바깥 것부터 한 번 부풀었다 들어간다. */
export function LoaderAntennaPop(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-antenna-pop">
      <Antenna name="d2-antenna-pop" />
    </LoaderFrame>
  )
}
