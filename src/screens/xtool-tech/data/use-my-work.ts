import { useMemo } from 'react'
import { useCurrentMember } from '../context/member-context'
import { buildWorkPeople, type MyWorkSources, type WorkPerson } from './my-work'
import type { DocTaskRecord, FieldServiceRecord, InquiryRecord, RentalRecord, RepairRecord, TaskRecord } from './tech-boards'
import { useTechBoard } from './tech-boards-store'
import { useTechMembers } from './tech-members'

export interface MyIdentity {
  /** 담당자 칸에서 나를 찾을 이름들 — 구성원 이름 */
  names: ReadonlySet<string>
  /** 화면에 쓸 내 이름 */
  name: string | null
}

/**
 * 나 — 담당자는 우리 시스템(관리자 화면에 등록한 기술팀 명단)의 이름으로 적으므로 구성원 이름으로
 * 찾는다. Monday 사용자 계정은 쓰지 않는다.
 */
export function useMyIdentity(): MyIdentity {
  const memberName = useCurrentMember()?.name || null
  return useMemo(() => ({ names: new Set(memberName ? [memberName] : []), name: memberName }), [memberName])
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
 * 내 업무의 직원 목록 — /admin/xtool에서 기술팀으로 등록한 구성원만(구성원 이름으로), 진행 중 건수가
 * 많은 순(0건도 나온다). 명단을 못 읽으면(불러오는 중·규칙 배포 전) 최근 담당자로 나온 사람으로 대신한다.
 */
export function useWorkPeople(sources: MyWorkSources, today: string): WorkPerson[] {
  const team = useTechMembers()
  return useMemo(() => {
    const recent = buildWorkPeople(sources, today)
    if (!team) return recent
    const openOf = new Map(recent.map((p) => [p.name, p.open]))
    const names = new Set(team.map((m) => m.name).filter(Boolean))
    return [...names]
      .map((name) => ({ name, open: openOf.get(name) ?? 0 }))
      .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'ko'))
  }, [sources, today, team])
}
