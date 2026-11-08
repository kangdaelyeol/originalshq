import { useMemo } from 'react';
import { koreaToday } from '@xtool-core/dates';
import { POSITIONS, TECH_AREAS } from '@xtool-core/members';
import { buildMyWork } from '@xtool-core/my-work';
import { useTechMembers } from '@xtool-core/tech-members';
import { useWorkPeople, useWorkSources } from './use-my-work';

// 팀원 화면의 동작 — 모든 레이아웃이 같이 쓴다. 기술팀 명단(못 읽으면 최근 담당자로 대신)과 사람마다 진행 중·임박 건수.

export interface TeamRow {
  name: string;
  email: string | null;
  /** 직책 · 담당 영역(없으면 이메일) */
  sub: string;
  open: number;
  /** 지났거나 3일 안에 다가오는 건 */
  urgent: number;
}

export function useTeamRows(): { rows: TeamRow[]; loading: boolean } {
  const team = useTechMembers();
  const { sources, loading } = useWorkSources();
  const today = koreaToday();
  const people = useWorkPeople(sources, today);
  const rows = useMemo(() => {
    const list = team
      ? team.map(m => ({
          name: m.name,
          email: m.email,
          sub:
            [POSITIONS.find(x => x.key === m.position)?.label, TECH_AREAS.find(x => x.key === m.techArea)?.label]
              .filter(Boolean)
              .join(' · ') || m.email,
        }))
      : people.map(x => ({ name: x.name, email: null, sub: '' }));
    return list
      .filter(r => r.name)
      .map(r => {
        const work = buildMyWork(sources, new Set([r.name]), today);
        return { ...r, open: work.length, urgent: work.filter(i => i.urgent).length };
      })
      .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'ko'));
  }, [team, people, sources, today]);
  return { rows, loading };
}
