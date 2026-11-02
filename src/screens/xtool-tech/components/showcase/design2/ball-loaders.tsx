import { LoaderFrame } from './loader-frame'
import type { LoaderProps } from './types'

// 공 위에 그리는 검은 선(반사광 자리)은 칸 바탕색 --d2-bg 로 칠한다 — 바탕이 바뀌면 같이 바꾸면 된다.

/** 바닥이 거울인 공 튀기기 — 바닥 가까이 오면 아래에 흐린 반사가 비친다(0.9초). */
export function LoaderBallMirror(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ball-mirror">
      {/* y = 41.55 를 축으로 뒤집은 같은 공 */}
      <g transform="matrix(1 0 0 -1 0 83.1)">
        <g className="d2-ball-mirror__reflect">
          <circle className="d2-ball-mirror__ball" cx={30.9} cy={14.87} r={4.03} />
        </g>
      </g>
      <circle className="d2-ball-mirror__ball" cx={30.9} cy={14.87} r={4.03} />
    </LoaderFrame>
  )
}

/** 작게·중간·크게 세 번 튀어 오르고, 디딜 때마다 바닥 그림자가 퍼져 사라진다. */
export function LoaderBallSteps(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ball-steps">
      <ellipse className="d2-ball-steps__shadow" cx={30.85} cy={48.75} rx={13.4} ry={2} />
      <circle className="d2-ball-steps__ball" cx={30.86} cy={14.85} r={4.03} />
    </LoaderFrame>
  )
}

/** 왼쪽·오른쪽을 번갈아 포물선으로 뛰고, 나는 쪽으로 기울어 늘어난다. */
export function LoaderBallHop(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ball-hop">
      <ellipse className="d2-ball-hop__shadow" cx={30.85} cy={48.6} rx={8.2} ry={1.5} />
      <circle className="d2-ball-hop__ball" cx={30.78} cy={14.93} r={4.05} />
    </LoaderFrame>
  )
}

/** 제자리에서 튀는 공 — 튀어 오를 때 바닥에 먼지 같은 그림자가 번진다(0.9초). */
export function LoaderBallDust(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ball-dust">
      <ellipse className="d2-ball-dust__shadow" cx={30.85} cy={48.7} rx={12} ry={2} />
      <circle className="d2-ball-dust__ball" cx={30.78} cy={22.51} r={4.03} />
    </LoaderFrame>
  )
}

/** 공이 튀어 오르며 돌아 네모가 되고, 다음 번엔 네모가 다시 공으로 돌아온다. */
export function LoaderBallMorph(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ball-morph">
      <ellipse className="d2-ball-morph__shadow" cx={30.85} cy={48.6} rx={11} ry={2} />
      <g className="d2-ball-morph__body">
        <rect className="d2-ball-morph__shape" x={25.95} y={17.1} width={9.8} height={9.8} rx={4.9} />
      </g>
    </LoaderFrame>
  )
}

/** 큰 구슬 속 반사광 선이 한쪽으로 두 바퀴 돌았다가 되감긴다. */
export function LoaderBallSphere(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ball-sphere">
      <circle cx={30.9} cy={31} r={12.3} />
      <path className="d2-ball-sphere__glint" d="M35.58 38.21A8.6 8.6 0 0 1 26.22 38.21" />
    </LoaderFrame>
  )
}

/** 공이 왼쪽 끝에서 오른쪽 끝까지 구르고(반사광이 세 바퀴) 되돌아온다. */
export function LoaderBallRoll(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ball-roll">
      <g className="d2-ball-roll__body">
        <circle cx={16.5} cy={31.1} r={6.05} />
        <path className="d2-ball-roll__glint" d="M12.44 28.94A4.6 4.6 0 0 1 16.34 26.5" />
      </g>
    </LoaderFrame>
  )
}

/** 두 공이 가운데로 굴러와 하나로 겹쳤다가 양쪽으로 되돌아간다(0.9초). */
export function LoaderBallEyes(props: LoaderProps) {
  // 반사광 선은 12시를 가운데로 그려 두고, 각도는 키프레임이 통째로 준다.
  return (
    <LoaderFrame {...props} name="d2-ball-eyes">
      <g className="d2-ball-eyes__ball d2-ball-eyes__ball--l">
        <circle cx={16.5} cy={31.1} r={6.05} />
        <path className="d2-ball-eyes__glint" d="M14.2 27.12A4.6 4.6 0 0 1 18.8 27.12" />
      </g>
      <g className="d2-ball-eyes__ball d2-ball-eyes__ball--r">
        <circle cx={44.9} cy={31.1} r={6.05} />
        <path className="d2-ball-eyes__glint" d="M42.6 27.12A4.6 4.6 0 0 1 47.2 27.12" />
      </g>
    </LoaderFrame>
  )
}
