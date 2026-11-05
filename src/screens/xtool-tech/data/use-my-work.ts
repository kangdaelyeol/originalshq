import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useCurrentMember } from '../context/member-context'
import { koreaToday } from '../lib/dates'
import { MY_WORK_PATH } from '../paths'
import { buildWorkPeople, type MyWorkSources, type WorkPerson } from './my-work'
import type { FieldServiceRecord, InquiryRecord, RentalRecord, RepairRecord, TaskRecord } from './tech-boards'
import { useTechBoard } from './tech-boards-store'
import { useTechMembers } from './tech-members'
import { usePhotoOf, useProfilePhoto } from './tech-profiles'

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

/** 담당자 칸이 있는 보드 다섯 개 — 실시간. loading은 아직 첫 응답이 안 온 보드가 있을 때. */
export function useWorkSources(): { sources: MyWorkSources; loading: boolean } {
  const field = useTechBoard('fieldService')
  const repair = useTechBoard('repair')
  const inquiry = useTechBoard('techInquiry')
  const task = useTechBoard('techTask')
  const rentals = useTechBoard('rentals')
  const boards = [field, repair, inquiry, task, rentals]
  const sources = useMemo<MyWorkSources>(
    () => ({
      fieldService: (field.board?.records as FieldServiceRecord[] | undefined) ?? null,
      repair: (repair.board?.records as RepairRecord[] | undefined) ?? null,
      techInquiry: (inquiry.board?.records as InquiryRecord[] | undefined) ?? null,
      techTask: (task.board?.records as TaskRecord[] | undefined) ?? null,
      rentals: (rentals.board?.records as RentalRecord[] | undefined) ?? null,
    }),
    [field.board, repair.board, inquiry.board, task.board, rentals.board],
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

/**
 * 사이드바 "내 업무" 아래 직원 목록 — 대시보드·Monday 표 사이드바(SidebarPeopleItem)와 물 사이드바(WaterSidebar)가
 * 같이 쓴다. 모양은 저마다 그리고, 누가 나오는지·건수·지금 보는 사람은 여기 하나다. 나는 맨 위(기술팀일 때만).
 */
export function useSidebarPeople() {
  const { pathname, search } = useLocation()
  const me = useMyIdentity()
  const member = useCurrentMember()
  // 기술팀이 아닌 관리자는 개인 보드("나")가 없다 — 직원 목록만.
  const isTech = member?.teams.tech === true
  // 내 사진은 이메일로, 다른 사람은 이름으로(담당자 동그라미와 같은 방법)
  const myPhoto = useProfilePhoto(member?.email)
  const photoOf = usePhotoOf()
  const { sources, loading } = useWorkSources()
  const today = koreaToday()
  // /admin/xtool에서 기술팀으로 등록한 사람만
  const people = useWorkPeople(sources, today)

  // 지금 보는 사람 — 내 업무 화면의 ?who=(없으면 나), 다른 화면이면 아무도 아니다
  const who = pathname.startsWith(MY_WORK_PATH) ? new URLSearchParams(search).get('who') : undefined
  const viewingMe = who === null || (!!who && me.names.has(who))
  const myOpen = people.filter((p) => me.names.has(p.name)).reduce((sum, p) => sum + p.open, 0)
  const others = people.filter((p) => !me.names.has(p.name))
  return { me, isTech, myPhoto, photoOf, loading, who, viewingMe, myOpen, others }
}
