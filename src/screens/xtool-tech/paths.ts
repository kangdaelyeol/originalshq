// originalshq 안에서 이 화면이 붙는 주소 — 메뉴·로그인 이동·로그아웃 링크가 모두 여기서 시작한다.
export const XT_BASE = '/xtool-tech'

/** XT_BASE 아래 경로 — 예: xtPath('/team') → '/xtool-tech/team' */
export const xtPath = (path = ''): string => `${XT_BASE}${path}`

/** 내 업무 — ?who=<이름>이면 그 직원의 업무, 없으면 나 */
export const MY_WORK_PATH = xtPath('/my-work')
export const myWorkPath = (who?: string | null): string =>
  who ? `${MY_WORK_PATH}?who=${encodeURIComponent(who)}` : MY_WORK_PATH
