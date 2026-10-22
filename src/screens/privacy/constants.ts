import ParkeIcon from '@/assets/parke-icon.png'
import { PARKE_DOCS } from './doc-contents/parke'
import type { AppDocs, AppName, DocType } from './types'

/** 문서 순서 — 목록과 문서 페이지의 탭이 이 순서로 나온다. */
export const DOC_TYPES: DocType[] = [
  'privacy',
  'terms',
  'location',
  'consent',
  'location-consent',
  'consent-third',
]

export const DOC_TITLES: Record<DocType, string> = {
  privacy: '개인정보 처리방침',
  terms: '서비스 이용약관',
  location: '위치기반서비스 이용약관',
  consent: '개인정보 수집·이용 동의서',
  'location-consent': '개인위치정보 수집·이용 동의서',
  'consent-third': '개인정보 제3자 제공 동의서',
}

export interface AppInfo {
  name: string
  subtitle: string
  icon: string
  /** 문서 시행일. */
  effectiveDate: string
  docs: AppDocs
}

export const APPS: Record<AppName, AppInfo> = {
  parke: {
    name: 'Parke',
    subtitle: 'Smart Parking Solution',
    icon: ParkeIcon,
    // 2026-10-21 GPS 개정본의 시행일(이전 시행일은 2026년 3월 17일).
    effectiveDate: '2026년 10월 22일',
    docs: PARKE_DOCS,
  },
}

/** 문서 하나의 고정 주소 — 앱 스토어·구글 개발자 콘솔 등에 그대로 등록할 수
 * 있도록 문서마다 따로 열리는 링크다. 예: /privacy/parke/privacy */
export const docPath = (app: AppName, doc: DocType): string =>
  `/privacy/${app}/${doc}`

export const isAppName = (value: string | undefined): value is AppName =>
  value !== undefined && value in APPS

export const isDocType = (value: string | undefined): value is DocType =>
  value !== undefined && (DOC_TYPES as string[]).includes(value)
