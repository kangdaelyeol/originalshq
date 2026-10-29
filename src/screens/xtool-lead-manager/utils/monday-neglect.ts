import type { MondayFollowUp } from '../entity'

const DAY_MS = 86_400_000

/** 기한을 며칠 넘겼는지 — 기한이 오늘이거나 아직 안 왔으면 0. */
export const overdueDays = (followUp: MondayFollowUp, today: string): number =>
  followUp.dueAt && followUp.dueAt < today
    ? Math.round((Date.parse(today) - Date.parse(followUp.dueAt)) / DAY_MS)
    : 0

/** 담당자 한 명의 방치 현황. */
export interface NeglectRow {
  assignee: string
  /** 진행 중인 기록 수(보류 제외) — 미처리율의 모수. */
  open: number
  /** 보류 중인 기록 수 — 방치로 세지 않는다. */
  onHold: number
  /** 그중 기한이 지난(방치) 기록 수. */
  neglected: number
  /** 방치 기간별 — 1~7일 / 8~30일 / 31일 이상. */
  recent: number
  month: number
  old: number
  rate: number
  /** 방치된 기록 — 오래 방치된 것부터. 보류는 들어 있지 않다. */
  items: (MondayFollowUp & { overdue: number })[]
}

/** 진행 중인 기록을 담당자별로 묶어 방치 현황을 낸다. 방치가 많은 담당자부터. */
export const neglectByAssignee = (
  followUps: MondayFollowUp[],
  kind: MondayFollowUp['kind'],
  today: string,
): NeglectRow[] => {
  const groups = new Map<string, MondayFollowUp[]>()
  for (const followUp of followUps) {
    if (followUp.kind !== kind) continue
    const assignee = followUp.assignee ?? '(담당자 없음)'
    groups.set(assignee, [...(groups.get(assignee) ?? []), followUp])
  }

  return [...groups.entries()]
    .map(([assignee, all]) => {
      // 보류는 고객이 고민 중이라 기다리는 것 — 따로 세고 방치 계산에서 뺀다.
      const list = all.filter((followUp) => !followUp.onHold)
      const items = list
        .map((followUp) => ({
          ...followUp,
          overdue: overdueDays(followUp, today),
        }))
        .filter((followUp) => followUp.overdue > 0)
        .sort((a, b) => b.overdue - a.overdue)
      return {
        assignee,
        open: list.length,
        onHold: all.length - list.length,
        neglected: items.length,
        recent: items.filter((item) => item.overdue <= 7).length,
        month: items.filter((item) => item.overdue > 7 && item.overdue <= 30)
          .length,
        old: items.filter((item) => item.overdue > 30).length,
        rate: list.length === 0 ? 0 : items.length / list.length,
        items,
      }
    })
    .sort((a, b) => b.neglected - a.neglected || b.open - a.open)
}

/** 지금 일하는 담당자가 아닌 이름 — Monday가 탈퇴한 사람을 부르는 "삭제된
 * 팀원"과, 담당자 칸이 빈 기록. 방치·개인 KPI 표에서 기본으로 숨긴다. */
export const isInactiveAssignee = (assignee: string): boolean =>
  assignee === '' || assignee === '(담당자 없음)' || assignee === '삭제된 팀원'

/** 한국 시간 기준 오늘(YYYY-MM-DD). */
export const todayInKorea = (): string =>
  new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
