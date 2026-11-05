/** 단계 색 — 웹 디자인(ohq-ui Tone)과 같은 값 */
export type StageTone = 'good' | 'warn' | 'crit' | 'info' | 'neutral'

// 진행 단계(Monday 그룹 이름) 해석 — 보드마다 그룹 이름이 달라도 같은 기준으로 본다.
// functions-xtool/src/monday/tech.ts의 isTechDone·FIRST_STAGE와 같은 규칙.

/** 끝난 건 — 마지막 그룹에 모두 "완료"가 들어 있다(완료, 완료된 문의). */
export const isDone = (r: { stage: string | null; status: string | null }): boolean =>
  /완료/.test(r.stage ?? r.status ?? '')

/** 아직 손대지 않은 건 — 보드의 첫 그룹. */
export const isNew = (r: { stage: string | null }): boolean => /^(신규|새로\s*인입|진행\s*전)/.test(r.stage ?? '')

/** 멈춘 건 */
export const isBlocked = (r: { stage: string | null; status: string | null }): boolean =>
  /막힘|보류/.test(`${r.stage ?? ''} ${r.status ?? ''}`)

export function stageTone(r: { stage: string | null; status: string | null }): StageTone {
  if (isDone(r)) return 'good'
  if (isBlocked(r)) return 'crit'
  if (isNew(r)) return 'info'
  return 'warn'
}

/** "<접수>" 같은 꼬리표를 뗀 짧은 단계 이름 — 배지용. */
export const stageLabel = (stage: string | null): string =>
  (stage ?? '단계 없음').replace(/\s*<[^>]*>\s*/g, '').trim()

/** 담당자 칸(쉼표로 이어진 이름) → 이름 목록 */
export const splitNames = (value: string | null | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

/** 010-1234-5678 / 02-123-4567 */
export function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const d = phone.replace(/\D/g, '')
  if (/^010\d{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  if (/^02\d{7,8}$/.test(d)) return `02-${d.slice(2, d.length - 4)}-${d.slice(-4)}`
  if (/^0\d{9,10}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`
  return phone
}
