import type { Tone } from './types'

export type MemberStatus = 'active' | 'away' | 'inactive'

export interface Member {
  id: string
  name: string
  /** 아바타 글자 — 이름에서 두 글자. */
  initials: string
  email: string
  role: string
  /** 담당 영역 — 표에서 링크 색으로 보인다. */
  focus: string
  status: MemberStatus
  /** 아바타 배경색(장식용 — 사람 구분). */
  color: string
}

export const MEMBER_STATUS: Record<MemberStatus, { label: string; tone: Tone }> = {
  active: { label: '활성', tone: 'good' },
  away: { label: '휴가 중', tone: 'warn' },
  inactive: { label: '비활성', tone: 'crit' },
}

export const TEAM: readonly Member[] = [
  {
    id: 'm1',
    name: '김도윤',
    initials: '도윤',
    email: 'doyun.kim@xtool.co.kr',
    role: '테크 리드',
    focus: '플랫폼 · 아키텍처',
    status: 'active',
    color: '#ef6342',
  },
  {
    id: 'm2',
    name: '이서연',
    initials: '서연',
    email: 'seoyeon.lee@xtool.co.kr',
    role: '백엔드',
    focus: 'CMIP · 광고 API 연동',
    status: 'active',
    color: '#3d9bea',
  },
  {
    id: 'm3',
    name: '박지호',
    initials: '지호',
    email: 'jiho.park@xtool.co.kr',
    role: '프론트엔드',
    focus: '리드 매니저 · 디자인 시스템',
    status: 'active',
    color: '#9a7cf2',
  },
  {
    id: 'm4',
    name: '최하은',
    initials: '하은',
    email: 'haeun.choi@xtool.co.kr',
    role: '데브옵스',
    focus: '배포 파이프라인 · 모니터링',
    status: 'away',
    color: '#eda12a',
  },
  {
    id: 'm5',
    name: '정민재',
    initials: '민재',
    email: 'minjae.jung@xtool.co.kr',
    role: 'QA',
    focus: '테스트 자동화',
    status: 'inactive',
    color: '#e5484d',
  },
]

export const memberById = (id: string): Member =>
  TEAM.find((m) => m.id === id) ?? TEAM[0]

/** 사이드바 아래 프로필(로그인 사용자 자리) — 강조 녹색 위 짙은 글자(앱 아이콘과 같은 짝). */
export const CURRENT_USER = {
  name: '테크 관리자',
  role: '슈퍼 관리자',
  initials: 'XT',
  color: '#00c767',
  ink: '#07160e',
}
