// xTool Support Center 로고 — xTool 로고(원본 SVG: 글자 TOOL은 글자색, X는 초록) 밑에 초록 "Support Center".

// 브랜드 초록(Support Center 이미지에서 뽑은 색) — 화면이 --tf-logo-green으로 바꿀 수 있다
const GREEN = 'var(--tf-logo-green, #28be44)'
// 로고 조각이 차지하는 가로(왼쪽 끝 X ~ 오른쪽 끝 L) — "Support Center"를 이 폭에 맞춘다
const LOGO_LEFT = 2.55
const LOGO_WIDTH = 94.53

const TEXT_PATHS = [
  // L
  'M94.0736 10.7195H91.0645H88.0553H85.0462V7.99962V5.27953V2.55966H82.0369V5.27953V7.99962V10.7195V13.4394H85.0462H88.0553H91.0645H94.0736H97.0826V10.7195H94.0736Z',
  // T
  'M30.8839 2.55975H27.8749H24.8656H21.8565V5.27983H24.8656H27.8749V7.9997V10.7196V13.4397H30.8839V10.7196V7.9997V5.27983H33.893H36.9022V2.55975H33.893H30.8839Z',
  // O
  'M54.9529 7.9997C54.9529 9.50184 53.6056 10.7196 51.9438 10.7196H45.9255C44.2634 10.7196 42.9162 9.50184 42.9162 7.9997C42.9162 6.49756 44.2634 5.27983 45.9255 5.27983H51.9438C53.6056 5.27983 54.9529 6.49756 54.9529 7.9997ZM51.9443 2.55975H45.926C42.6021 2.55975 39.9077 4.99521 39.9077 7.9997C39.9077 11.0042 42.6021 13.4397 45.926 13.4397H51.9443C55.268 13.4397 57.9624 11.0042 57.9624 7.9997C57.9624 4.99521 55.268 2.55975 51.9443 2.55975Z',
  // O
  'M76.0182 7.9997C76.0182 9.50184 74.671 10.7196 73.0091 10.7196H66.9908C65.3287 10.7196 63.9815 9.50184 63.9815 7.9997C63.9815 6.49756 65.3287 5.27983 66.9908 5.27983H73.0091C74.671 5.27983 76.0182 6.49756 76.0182 7.9997ZM73.0097 2.55975H66.9913C63.6674 2.55975 60.973 4.99521 60.973 7.9997C60.973 11.0042 63.6674 13.4397 66.9913 13.4397H73.0097C76.3334 13.4397 79.0278 11.0042 79.0278 7.9997C79.0278 4.99521 76.3334 2.55975 73.0097 2.55975Z',
]

const X_PATHS = [
  'M9.6376 5.11474L6.81089 2.55966H2.5554L7.50985 7.03814L9.6376 5.11474Z',
  'M18.1488 3.19134L18.8475 2.55966H14.5921L2.5554 13.4396H6.81089L10.7015 9.9228L14.5921 13.4396H18.8475L12.8292 7.99962L18.1488 3.19134Z',
]

/** 로고 조각(가로 100 · 세로 16 안) — TOOL은 글자색, X는 초록 */
function LogoPaths() {
  return (
    <>
      {TEXT_PATHS.map((d) => (
        <path key={d} fillRule="evenodd" clipRule="evenodd" d={d} fill="currentColor" />
      ))}
      {X_PATHS.map((d) => (
        <path key={d} fillRule="evenodd" clipRule="evenodd" d={d} fill={GREEN} />
      ))}
    </>
  )
}

/**
 * xTool Support Center 묶음 로고(assets/xtool-support-center.png 모양) — 로고 밑에 초록 "Support Center"를 로고 폭에
 * 맞춰 늘인다(textLength). PNG는 흰 TOOL(어두운 바탕용)·200×68px이라 밝은 헤더에서 안 보이고 휴대폰에서 흐려서
 * SVG로 다시 그렸다. 크기는 놓는 곳의 CSS가 정한다(비율 100:36).
 */
export function SupportCenterLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 36" fill="none" role="img" aria-label="xTool Support Center">
      <LogoPaths />
      <text
        x={LOGO_LEFT}
        y={32}
        textLength={LOGO_WIDTH}
        lengthAdjust="spacingAndGlyphs"
        fill={GREEN}
        fontSize={11.5}
        fontWeight={600}
        fontFamily="'Pretendard Variable', Pretendard, sans-serif"
      >
        Support Center
      </text>
    </svg>
  )
}
