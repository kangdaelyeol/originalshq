import { useMemo, useState } from 'react'
import type { MondayKpiFacts } from '@/screens/xtool-lead-manager/entity'
import {
  buildCsTeamStats,
  csCandidates,
} from '@/screens/xtool-lead-manager/utils'
import { usePersistentState } from '@/hooks/use-persistent-state'

/** 저장값 검사 — 이름(문자열) 배열이면 그대로(빈 이름·중복은 뺀다). */
const parseMembers = (stored: unknown): string[] | undefined =>
  Array.isArray(stored)
    ? [
        ...new Set(
          stored.filter(
            (name): name is string =>
              typeof name === 'string' && name.trim() !== '',
          ),
        ),
      ]
    : undefined

/**
 * 인입통계 맨 아래 CS팀 섹션 — 명단은 이 브라우저(localStorage)에 두어 사람마다
 * 따로 고를 수 있다. 숫자는 통계 탭이 받아 둔 상담 기록(consultations)을
 * 인입통계 기간(range)으로 센다.
 */
export const useCsTeamViewModel = (
  consultations: MondayKpiFacts['consultations'],
  range: { start: string; end: string },
) => {
  const [members, setMembers] = usePersistentState<string[]>(
    'xtool.csTeam.members',
    [],
    parseMembers,
  )
  const [editing, setEditing] = useState(false)

  const stats = useMemo(
    () => buildCsTeamStats(consultations, members, range),
    [consultations, members, range],
  )
  // 명단 편집 창의 후보 — 상담 담당자로 나온 이름들(많이 맡은 순).
  const candidates = useMemo(() => csCandidates(consultations), [consultations])

  return {
    state: { members, editing, stats, candidates },
    actions: {
      openEditor: () => setEditing(true),
      closeEditor: () => setEditing(false),
      /** 명단 저장(이 브라우저) — 저장하고 편집 창을 닫는다. */
      save: (next: string[]) => {
        setMembers(next)
        setEditing(false)
      },
    },
  }
}
