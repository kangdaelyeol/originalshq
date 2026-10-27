// 상담 신청 브라우저 정보(user_agent)로 접속 기기를 가른다 — 접수 로그
// 화면의 "접속" 칸.

export type AccessDevice = 'mobile' | 'tablet' | 'pc' | 'unknown'

export const ACCESS_DEVICE_LABEL: Record<AccessDevice, string> = {
  mobile: '모바일',
  tablet: '태블릿',
  pc: 'PC',
  unknown: '-',
}

/**
 * 접속 기기. 태블릿을 먼저 본다 — 안드로이드 태블릿은 "Mobile" 없이
 * "Android"만 들어 있다. iPadOS 13 이후 Safari는 맥과 같은 문자열을 보내서
 * PC로 잡힌다(브라우저 정보만으로는 구분할 수 없다).
 */
export const accessDevice = (userAgent: string): AccessDevice => {
  if (!userAgent) return 'unknown'
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(userAgent)) {
    return 'tablet'
  }
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini/i.test(userAgent)) {
    return 'mobile'
  }
  return 'pc'
}

// 앱 안 브라우저 — 광고 유입이 어느 앱에서 왔는지 보는 데 쓴다.
const IN_APP: [RegExp, string][] = [
  [/KAKAOTALK/i, '카카오톡'],
  [/Instagram/i, '인스타그램'],
  [/FBAN|FBAV|FB_IAB/i, '페이스북'],
  [/NAVER\(inapp/, '네이버'],
  [/DaumApps/i, '다음'],
  [/Line\//, '라인'],
  [/Threads/i, '스레드'],
]

const OS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

const BROWSER: [RegExp, string][] = [
  [/SamsungBrowser/, '삼성 인터넷'],
  [/Whale/, '웨일'],
  [/Edg\//, 'Edge'],
  [/CriOS|Chrome\//, 'Chrome'],
  [/FxiOS|Firefox\//, 'Firefox'],
  [/Safari\//, 'Safari'],
]

const pick = (userAgent: string, table: [RegExp, string][]) =>
  table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null

/** 상세에 쓰는 한 줄 — 예: "모바일 · iOS · 카카오톡 앱". */
export const describeUserAgent = (userAgent: string): string => {
  const device = accessDevice(userAgent)
  if (device === 'unknown') return ''
  const app = pick(userAgent, IN_APP)
  return [
    ACCESS_DEVICE_LABEL[device],
    pick(userAgent, OS),
    app ? `${app} 앱` : pick(userAgent, BROWSER),
  ]
    .filter(Boolean)
    .join(' · ')
}
