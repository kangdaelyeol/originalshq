// xTool의 X 꼭짓점 — 앱 아이콘(assets/symbols/xtool-start-icon.png, 824px)에서 X가 차지하는 상자
// (142,210)–(680,610)을 0 기준으로 옮겨 땄다. 왼쪽 위 짧은 조각 + 긴 대각선과 오른쪽 아래 다리.
// 로고(XMark)와 로그인 입자 인트로가 같은 값을 쓴다.

export const X_BOX = { width: 538, height: 400 } as const

export const X_POLYGONS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 0],
    [140, 0],
    [233, 92],
    [162, 163],
  ],
  [
    [0, 400],
    [399, 0],
    [538, 0],
    [342, 200],
    [538, 400],
    [399, 400],
    [270, 273],
    [140, 400],
  ],
]
