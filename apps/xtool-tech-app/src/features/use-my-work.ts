import { useMemo } from 'react';
import { useCurrentMember } from '@xtool-core/member-context';
import { buildWorkPeople, type MyWorkSources, type WorkPerson } from '@xtool-core/my-work';
import type {
  FieldServiceRecord,
  InquiryRecord,
  RentalRecord,
  RepairRecord,
  TaskRecord,
} from '@xtool-core/tech-boards';
import { useTechBoard } from '@xtool-core/tech-boards-store';
import { useTechMembers } from '@xtool-core/tech-members';

// 내 업무의 재료 — 웹 src/screens/xtool-tech/data/use-my-work.ts와 같은 규칙(주소·프로필 사진 부분만 뺐다).

export interface MyIdentity {
  /** 담당자 칸에서 나를 찾을 이름들 — 구성원 이름(Monday 계정은 쓰지 않는다) */
  names: ReadonlySet<string>;
  /** 화면에 쓸 내 이름 */
  name: string | null;
}

export function useMyIdentity(): MyIdentity {
  const memberName = useCurrentMember()?.name || null;
  return useMemo(() => ({ names: new Set(memberName ? [memberName] : []), name: memberName }), [memberName]);
}

/** 담당자 칸이 있는 보드 다섯 개 — 실시간. loading은 아직 첫 응답이 안 온 보드가 있을 때. */
export function useWorkSources(): { sources: MyWorkSources; loading: boolean } {
  const field = useTechBoard('fieldService');
  const repair = useTechBoard('repair');
  const inquiry = useTechBoard('techInquiry');
  const task = useTechBoard('techTask');
  const rentals = useTechBoard('rentals');
  const boards = [field, repair, inquiry, task, rentals];
  const sources = useMemo<MyWorkSources>(
    () => ({
      fieldService: (field.board?.records as FieldServiceRecord[] | undefined) ?? null,
      repair: (repair.board?.records as RepairRecord[] | undefined) ?? null,
      techInquiry: (inquiry.board?.records as InquiryRecord[] | undefined) ?? null,
      techTask: (task.board?.records as TaskRecord[] | undefined) ?? null,
      rentals: (rentals.board?.records as RentalRecord[] | undefined) ?? null,
    }),
    [field.board, repair.board, inquiry.board, task.board, rentals.board],
  );
  return { sources, loading: boards.some(b => !b.board && !b.error) };
}

/**
 * 직원 목록 — 기술팀으로 등록한 구성원만(이름으로), 진행 중 건수가 많은 순. 명단을 못 읽으면 최근 담당자로
 * 나온 사람으로 대신한다.
 */
export function useWorkPeople(sources: MyWorkSources, today: string): WorkPerson[] {
  const team = useTechMembers();
  return useMemo(() => {
    const recent = buildWorkPeople(sources, today);
    if (!team) return recent;
    const openOf = new Map(recent.map(p => [p.name, p.open]));
    const names = new Set(team.map(m => m.name).filter(Boolean));
    return [...names]
      .map(name => ({ name, open: openOf.get(name) ?? 0 }))
      .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'ko'));
  }, [sources, today, team]);
}
