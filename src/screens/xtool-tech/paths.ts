// originalshq 안에서 이 화면이 붙는 주소 — 메뉴·로그인 이동·로그아웃 링크가 모두 여기서 시작한다.
export const XT_BASE = '/xtool-tech'

/** XT_BASE 아래 경로 — 예: xtPath('/analytics') → '/xtool-tech/analytics' */
export const xtPath = (path = ''): string => `${XT_BASE}${path}`
