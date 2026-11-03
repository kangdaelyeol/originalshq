import { LoaderFrame } from './loader-frame'
import type { LoaderProps } from './types'

// 아이콘 선 굵기는 영상에서 잰 값(돋보기 3.45, 봉투 2.4 …) — 모양은 .d2-icon 이 칠한다.

/** 돋보기가 똑바로 선 채 작은 원을 그리며 돈다. */
export function LoaderIconSearch(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-icon-search">
      {/* 바깥은 궤도(28.6 축)로 돌고, 안쪽은 반대로 돌아 돋보기가 기울지 않는다 */}
      <g className="d2-icon-search__orbit">
        <g className="d2-icon-search__upright">
          <circle className="d2-icon d2-icon-search__lens" cx={31} cy={20.4} r={8.7} />
          <line className="d2-icon d2-icon-search__lens" x1={37.15} y1={26.55} x2={42} y2={31.4} />
        </g>
      </g>
    </LoaderFrame>
  )
}

/** 봉투가 떠오르며 뒤로 바람 줄이 지나간다(0.9초). */
export function LoaderIconMail(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-icon-mail">
      <g className="d2-icon-mail__body">
        <rect className="d2-icon d2-icon--mail" x={23.55} y={26.25} width={27.1} height={15.9} rx={0.6} />
        <path className="d2-icon d2-icon--mail" d="M24.3 27.6 37.1 35.4l12.8-7.8" />
        {[37.8, 25.4, 31].map((y, i) => (
          <line key={y} className={`d2-icon d2-icon-mail__wind d2-icon-mail__wind--${i + 1}`} x1={16.5} y1={y} x2={19.5} y2={y} />
        ))}
      </g>
    </LoaderFrame>
  )
}

/** 겹친 사진 두 장 — 앞 장이 기우뚱 흔들리고 뒷장이 살짝 비켜난다. */
export function LoaderIconPhotos(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-icon-photos">
      <g className="d2-icon-photos__back">
        <rect className="d2-icon d2-icon--photo" x={20.15} y={18.65} width={23.7} height={23.7} transform="rotate(-12 32 30.5)" />
      </g>
      <g className="d2-icon-photos__front">
        <rect className="d2-icon-photos__card" x={15.45} y={21.75} width={23.7} height={23.7} />
        <rect className="d2-icon d2-icon--photo" x={15.45} y={21.75} width={23.7} height={23.7} />
        <rect className="d2-icon d2-icon--photo-inner" x={19.4} y={24.7} width={16.2} height={12.8} />
        <circle className="d2-icon-photos__sun" cx={23.4} cy={28.7} r={1.6} />
        <path className="d2-icon d2-icon--photo-inner" d="m20.2 36.6 5.2-5.4 3.2 3.2 3.8-4.6 3 3.8" />
      </g>
    </LoaderFrame>
  )
}

/** 굴뚝에서 연기 뭉치가 피어올라 오른쪽으로 흘러가며 잦아든다. */
export function LoaderIconHouse(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-icon-house">
      <g className="d2-icon-house__smoke">
        <circle cx={23.9} cy={22.4} r={3.4} />
        <circle cx={27.5} cy={19.2} r={3.9} />
        <circle cx={30.1} cy={22.6} r={2.8} />
      </g>
      <path className="d2-icon d2-icon--house" d="M24.2 30.2v-5h2.6v3.6M19.8 34 31.5 27l11.7 7M23.6 33.2v14.4h18v-14.4M28.6 47.6v-8.8h8v8.8M22 47.6h21" />
    </LoaderFrame>
  )
}

/** 내려받기 화살표가 바닥을 딛고 튀어 올라 한 바퀴 돌고 내려앉는다(0.9초). */
export function LoaderIconDownload(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-icon-download">
      <line className="d2-icon d2-icon--bar" x1={12.6} y1={49.1} x2={49.4} y2={49.1} />
      <g className="d2-icon-download__jump">
        <g className="d2-icon-download__squash">
          <path className="d2-icon d2-icon--arrow" d="M31 25.6v18.8M24.6 38l6.4 6.4 6.4-6.4" />
        </g>
      </g>
    </LoaderFrame>
  )
}

/** 동전이 위에서 뒤집히며 들어와 자리 잡고, 끝에 다시 뒤집혀 사라진다. */
export function LoaderIconCoin(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-icon-coin">
      <g className="d2-icon-coin__flip">
        <circle className="d2-icon d2-icon--coin" cx={31} cy={31.1} r={8.1} />
        <path
          className="d2-icon d2-icon--coin-mark"
          d="M33.2 28.4c-.5-.9-1.4-1.3-2.4-1.3-1.4 0-2.4.8-2.4 1.9 0 2.6 5 1.4 5 4.2 0 1.2-1.1 2-2.6 2-1.1 0-2.1-.5-2.6-1.4M30.8 25.6v1.5M30.8 35.3v1.4"
        />
      </g>
    </LoaderFrame>
  )
}

/** 트럭이 덜컹이며 달리고 뒤로 바람 줄이 지나간다(0.9초). */
export function LoaderIconTruck(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-icon-truck">
      <g className="d2-icon-truck__body">
        <path className="d2-icon d2-icon--truck" d="M22.5 34.5V19.4h15.4v15.1M37.9 22.9h5.6l6.9 6.9v4.7h-2.6M37.9 34.5h3.4M30 34.5h-1.6" />
        <circle className="d2-icon d2-icon--truck" cx={26.6} cy={37.6} r={2.8} />
        <circle className="d2-icon d2-icon--truck" cx={44.2} cy={37.6} r={2.8} />
      </g>
      {[34, 22, 28].map((y, i) => (
        <line key={y} className={`d2-icon d2-icon-truck__wind d2-icon-truck__wind--${i + 1}`} x1={16.5} y1={y} x2={19.5} y2={y} />
      ))}
    </LoaderFrame>
  )
}

/** 펼친 책 — 오른쪽 장이 들려 넘어가 왼쪽에 내려앉는다(0.9초). */
export function LoaderIconBook(props: LoaderProps) {
  const page = 'M30.5 19.2c3-1.4 8.2-1.6 13-1.3v28.4c-4.8-.2-10 .2-13 1.6Z'
  return (
    <LoaderFrame {...props} name="d2-icon-book">
      <path className="d2-icon d2-icon--book" d="M17.5 21.8h-4.4v28.2H48V21.8h-4.5M30.5 47.6V49" />
      <path className="d2-icon d2-icon--book" d={page} transform="matrix(-1 0 0 1 61 0)" />
      <path className="d2-icon d2-icon--book" d={page} />
      <g className="d2-icon-book__turn">
        <path className="d2-icon-book__leaf" d={page} />
        <path className="d2-icon d2-icon--book" d={page} />
      </g>
    </LoaderFrame>
  )
}
