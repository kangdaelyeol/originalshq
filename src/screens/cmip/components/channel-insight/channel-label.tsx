import type { ReactElement } from 'react'
import metaIconPng from '../../assets/meta_icon.png'
import naverLogoPng from '../../assets/naver_logo.png'
import type { ChannelKey } from '../channels'

// "Meta" 옆 텍스트 색 — 실제 브랜드 워드마크는 검정 글자지만, 이 표는 배경이
// 어두워서 검정 그대로 쓰면 글자가 배경에 묻혀 안 보인다. 그래서 하양으로
// 바꾼다(로고 아이콘 자체는 브랜드 블루를 그대로 유지). Google/Naver는 로고가
// 이미 워드마크(전체 글자 이미지)라 텍스트를 따로 안 그리므로 이 값이 쓰이지
// 않는다.
const CHANNEL_TEXT_COLOR: Record<ChannelKey, string> = {
  meta: '#ffffff',
  google: '#4285f4',
  naver: '#03c75a',
}

function MetaLogo() {
  return (
    <img className="channel-insight__channel-logo" src={metaIconPng} alt="" />
  )
}

// 작은 "G" 아이콘 대신 실제 구글 워드마크(전체 로고) 전체를 쓴다 — 그 자체로
// "Google"이라고 읽혀서 옆에 별도 텍스트를 안 붙여도 된다.
function GoogleLogo() {
  return (
    <svg
      className="channel-insight__channel-logo channel-insight__channel-logo--google"
      viewBox="0 0 272 92"
      aria-hidden
    >
      <path
        fill="#EA4335"
        d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
      />
      <path
        fill="#FBBC05"
        d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C119.25 34.32 129.24 25 141.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
      />
      <path
        fill="#4285F4"
        d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z"
      />
      <path fill="#34A853" d="M225 3v65h-9.5V3h9.5z" />
      <path
        fill="#EA4335"
        d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"
      />
      <path
        fill="#4285F4"
        d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.01z"
      />
    </svg>
  )
}

// Google과 같은 이유로(로고 자체가 "NAVER" 워드마크) 옆에 텍스트를 따로 안 붙인다.
function NaverLogo() {
  return (
    <img
      className="channel-insight__channel-logo channel-insight__channel-logo--naver"
      src={naverLogoPng}
      alt=""
    />
  )
}

const CHANNEL_LOGO: Record<ChannelKey, () => ReactElement> = {
  meta: MetaLogo,
  google: GoogleLogo,
  naver: NaverLogo,
}

/** 채널 이름(Meta/Google/Naver)을 브랜드 색 + 로고와 함께 보여준다 — 표의 채널별
 * 펼침 행, Summary의 "자세히 보기" 채널 카드 둘 다 여기 하나로 통일. Google/Naver는
 * 로고가 이미 워드마크(전체 글자)라 옆에 텍스트를 또 안 붙인다. */
export function ChannelLabel({
  channelKey,
  label,
}: {
  channelKey: ChannelKey
  label: string
}) {
  const Logo = CHANNEL_LOGO[channelKey]
  return (
    <span
      className="channel-insight__channel-label"
      style={{ color: CHANNEL_TEXT_COLOR[channelKey] }}
    >
      <Logo />
      {channelKey === 'meta' && label}
    </span>
  )
}
