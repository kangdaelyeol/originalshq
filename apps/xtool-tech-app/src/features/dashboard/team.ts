import { useMemo } from 'react';
import { koreaToday } from '@xtool-core/dates';
import { useCurrentMember } from '@xtool-core/member-context';
import { GROUP_ROLES, POSITIONS, TECH_AREAS } from '@xtool-core/members';
import { buildMyWork } from '@xtool-core/my-work';
import { useTechMembers } from '@xtool-core/tech-members';
import type { PillData } from '../../themes/dashboard/parts';
import { useWorkSources } from '../use-my-work';

// 팀원 화면의 동작(대시보드 짜임) — 웹 team-page.tsx "팀원 & 권한": 관리자 화면에서 기술팀으로 등록한 활성 구성원(이름순),
// 직책·그룹 역할·담당 영역, 지금 맡은 업무(내 업무와 같은 계산 — 진행 중 N · 임박·지남 N). 누르면 그 사람의 업무.
// 수정 기록(로그)·구성원 관리는 아직 웹에서만.

export interface TeamMemberRow {
  key: string;
  name: string;
  email: string;
  /** '사원 · 설치' 처럼 — 비었으면 '직책·담당 영역 미정' */
  sub: string;
  /** 그룹 역할(그룹장은 안내 색) + 지금 맡은 업무 */
  pills: PillData[];
  open: number;
  urgent: number;
}

export interface TeamTableModel {
  title: string;
  subtitle: string;
  loading: boolean;
  rows: TeamMemberRow[];
  empty: string | null;
  isAdmin: boolean;
}

export function useTeamTable(): TeamTableModel {
  const me = useCurrentMember();
  const members = useTechMembers();
  const { sources, loading } = useWorkSources();
  const today = koreaToday();

  const rows = useMemo(
    () =>
      [...(members ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .map(member => {
          const items = buildMyWork(sources, new Set([member.name]), today);
          const urgent = items.filter(i => i.urgent).length;
          const position = POSITIONS.find(p => p.key === member.position)?.label ?? null;
          const area = TECH_AREAS.find(a => a.key === member.techArea)?.label ?? null;
          const groupRole = GROUP_ROLES.find(r => r.key === member.groupRole)?.label ?? null;
          const work: PillData =
            loading && items.length === 0
              ? { label: '불러오는 중', tone: 'neutral' }
              : items.length === 0
              ? { label: '맡은 업무 없음', tone: 'neutral' }
              : {
                  label: `진행 중 ${items.length}건${urgent ? ` · 임박·지남 ${urgent}` : ''}`,
                  tone: urgent ? 'warn' : 'info',
                  dot: true,
                };
          return {
            key: member.email,
            name: member.name,
            email: member.email,
            sub: [position, area].filter(Boolean).join(' · ') || '직책·담당 영역 미정',
            pills: [
              ...(groupRole
                ? [{ label: groupRole, tone: member.groupRole === 'lead' ? 'info' : 'neutral' } as PillData]
                : []),
              work,
            ],
            open: items.length,
            urgent,
          };
        }),
    [members, sources, today, loading],
  );

  return {
    title: '팀원 & 권한',
    subtitle: members === null ? '불러오는 중…' : `기술팀 ${rows.length}명 — 등록과 담당영역은 관리자 화면에서 정해요`,
    loading: members === null,
    rows,
    empty: members !== null && rows.length === 0 ? '기술팀으로 등록된 사람이 없어요.' : null,
    isAdmin: me?.isAdmin === true,
  };
}
