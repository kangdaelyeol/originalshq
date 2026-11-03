import { useMemo } from 'react'
import { useCurrentMember } from '../context/member-context'
import { buildWorkPeople, type MyWorkSources, type WorkPerson } from './my-work'
import type { DocTaskRecord, FieldServiceRecord, InquiryRecord, RentalRecord, RepairRecord, TaskRecord } from './tech-boards'
import { useMondayUsers, useTechBoard } from './tech-boards-store'
import { useTechMembers } from './tech-members'

export interface MyIdentity {
  /** Monday 담당자 칸에서 나를 찾을 이름들(Monday 사용자 이름 · 구성원 이름) */
  names: ReadonlySet<string>
  /** 화면에 쓸 내 이름 — Monday 이름이 있으면 그것 */
  name: string | null
  /** Monday 사용자와 이메일로 이어졌는지 — 아니면 구성원 이름으로만 찾는다 */
  linked: boolean
}

/**
 * 나 — Monday 담당자 칸의 이름으로 찾는다. 구성원 이메일로 Monday 사용자를 찾아 그 이름을 쓰고,
 * 못 찾으면 구성원 이름으로 대신한다.
 */
export function useMyIdentity(): MyIdentity {
  const member = useCurrentMember()
  const users = useMondayUsers()
  const mondayMe = member ? users?.find((u) => u.email.toLowerCase() === member.email.toLowerCase()) : undefined
  const mondayName = mondayMe?.name
  const memberName = member?.name
  return useMemo(
    () => ({
      names: new Set([mondayName, memberName].filter((n): n is string => !!n)),
      name: mondayName ?? memberName ?? null,
      linked: !!mondayName,
    }),
    [mondayName, memberName],
  )
}

/** 담당자 칸이 있는 보드 여섯 개 — 실시간. loading은 아직 첫 응답이 안 온 보드가 있을 때. */
export function useWorkSources(): { sources: MyWorkSources; loading: boolean } {
  const field = useTechBoard('fieldService')
  const repair = useTechBoard('repair')
  const inquiry = useTechBoard('techInquiry')
  const task = useTechBoard('techTask')
  const docs = useTechBoard('records')
  const rentals = useTechBoard('rentals')
  const boards = [field, repair, inquiry, task, docs, rentals]
  const sources = useMemo<MyWorkSources>(
    () => ({
      fieldService: (field.board?.records as FieldServiceRecord[] | undefined) ?? null,
      repair: (repair.board?.records as RepairRecord[] | undefined) ?? null,
      techInquiry: (inquiry.board?.records as InquiryRecord[] | undefined) ?? null,
      techTask: (task.board?.records as TaskRecord[] | undefined) ?? null,
      records: (docs.board?.records as DocTaskRecord[] | undefined) ?? null,
      rentals: (rentals.board?.records as RentalRecord[] | undefined) ?? null,
    }),
    [field.board, repair.board, inquiry.board, task.board, docs.board, rentals.board],
  )
  return { sources, loading: boards.some((b) => !b.board && !b.error) }
}

/**
 * 내 업무의 직원 목록 — /admin/xtool에서 기술팀으로 등록한 구성원만, 진행 중 건수가 많은 순(0건도
 * 나온다). 담당자 칸은 Monday 사용자 이름이라 구성원 이메일로 Monday 사용자를 찾아 그 이름을 쓰고,
 * 없으면 구성원 이름. 명단을 못 읽으면(불러오는 중·규칙 배포 전) 최근 담당자로 나온 사람으로 대신한다.
 */
export function useWorkPeople(sources: MyWorkSources, today: string): WorkPerson[] {
  const team = useTechMembers()
  const users = useMondayUsers()
  return useMemo(() => {
    const recent = buildWorkPeople(sources, today)
    if (!team) return recent
    const openOf = new Map(recent.map((p) => [p.name, p.open]))
    const names = new Set(
      team.map((m) => users?.find((u) => u.email.toLowerCase() === m.email.toLowerCase())?.name ?? m.name).filter(Boolean),
    )
    return [...names]
      .map((name) => ({ name, open: openOf.get(name) ?? 0 }))
      .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'ko'))
  }, [sources, today, team, users])
}
