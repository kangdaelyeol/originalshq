import { useState } from 'react'
import { WaterSection, WaterSpec } from '@/ohq-ui/water/catalog/spec'
import { WaterCard } from '@/ohq-ui/water/surfaces/water-card'
import type { AttentionTile } from '../../../data/attention'
import type { TeamMemberStatus } from '../../../data/team-status'
import { KINGS, type KingResult } from '../../../data/tech-kings'
import { addDays, koreaToday } from '../../../lib/dates'
import { WaterAttentionRow } from '../overview/water-attention-row'
import { WaterKingCard } from '../overview/water-king-card'
import { WaterMiniList } from '../overview/water-mini-list'
import { WaterTeamCard } from '../overview/water-team-card'
import { WaterUpcomingList } from '../overview/water-upcoming-list'

// ── 견본 데이터(화면 안에서만 쓰는 가짜 값 — 디자인 화면 "tech 부품" 탭과 같은 구성) ──────────────────

const today = koreaToday()
const week = { start: today, end: addDays(today, 6) }

const ATTENTION: AttentionTile[] = [
  {
    id: 'overdueVisit',
    label: '지난 출장 일정',
    caption: '방문일이 지났는데 안 끝남',
    slug: 'field-service',
    count: 1,
    examples: ['조우진'],
    tone: 'crit',
  },
  {
    id: 'waitingInquiry',
    label: '응대 대기 아톡',
    caption: '신규 접수·1차 안내',
    slug: 'inquiry',
    count: 2,
    examples: [],
    tone: 'warn',
  },
  {
    id: 'newRequest',
    label: '새 AS 신청',
    caption: '최근 3일 접수',
    slug: 'as-requests',
    count: 3,
    examples: [],
    tone: 'info',
  },
  {
    id: 'blockedTask',
    label: '막힌 업무',
    caption: '기타업무 "막힘"',
    slug: 'tasks',
    count: 0,
    examples: [],
    tone: 'warn',
  },
]
// 값 바꾸기 — 숫자가 굴러간다
const ATTENTION_COUNTS = [
  [1, 2, 3, 0],
  [2, 0, 12, 1],
]

const KING_RESULT: KingResult = {
  total: 7,
  unassigned: 1,
  rows: [
    {
      name: '지상헌',
      count: 4,
      facts: [
        { itemId: 'f1', name: '조우진', date: today, assignees: ['지상헌'] },
        { itemId: 'f2', name: '주식회사 노바', date: addDays(today, -1), assignees: ['지상헌'] },
        { itemId: 'f3', name: '박서연', date: addDays(today, -2), assignees: ['지상헌', '이재민'] },
      ],
    },
    { name: '김다현', count: 2, facts: [] },
    { name: '이재민', count: 1, facts: [] },
  ],
}

const MEMBERS: TeamMemberStatus[] = [
  {
    name: '이재민',
    open: { fieldService: 0, repair: 5, techInquiry: 1, techTask: 4, records: 1 },
    openTotal: 11,
    visitsToday: 0,
    doneThisWeek: 3,
  },
  {
    name: '지상헌',
    open: { fieldService: 4, repair: 1, techInquiry: 1, techTask: 1, records: 0 },
    openTotal: 7,
    visitsToday: 1,
    doneThisWeek: 2,
  },
  {
    name: '원도윤',
    open: { fieldService: 0, repair: 2, techInquiry: 0, techTask: 0, records: 0 },
    openTotal: 2,
    visitsToday: 0,
    doneThisWeek: 5,
  },
]

/** tech 부품 — 개요 카드·목록 */
export function OverviewSection() {
  const [step, setStep] = useState(0)
  const counts = ATTENTION_COUNTS[step % ATTENTION_COUNTS.length]
  const tiles = ATTENTION.map((tile, i) => ({ ...tile, count: counts[i] }))

  return (
    <WaterSection title="개요 카드 · 목록" note="tech 데이터 타입·props 그대로 — 기존 개요 카드와 바꿔 끼운다">
      <WaterSpec
        name="<WaterUpcomingList>"
        note="due — 지난 날 빨간 점 · 오늘 어두운 알약 · since — 며칠째"
        wide
        spec="upcoming"
      >
        <div className="water-surf-demo-grid">
          <WaterCard title="다가오는 방문" subtitle="due">
            <WaterUpcomingList
              today={today}
              empty="일정 없음"
              items={[
                { key: '1', date: addDays(today, -1), title: '지난 일정', meta: '빨간 점' },
                { key: '2', date: today, title: '오늘 방문', meta: '경상권 · 방문 설치' },
                { key: '3', date: addDays(today, 2), title: '모레 방문', meta: '수도권' },
              ]}
            />
          </WaterCard>
          <WaterCard title="진행 중인 AS" subtitle="since">
            <WaterUpcomingList
              mode="since"
              today={today}
              empty="진행 중인 건 없음"
              items={[
                { key: '1', date: addDays(today, -9), title: '박서연 · P2S', meta: '수리 중' },
                { key: '2', date: addDays(today, -2), title: '김도현 · F2', meta: '입고 대기' },
              ]}
            />
          </WaterCard>
          <WaterCard title="다음 주 방문" subtitle="빈 목록">
            <WaterUpcomingList today={today} empty="일정 없음" items={[]} />
          </WaterCard>
        </div>
      </WaterSpec>

      <WaterSpec name="<WaterMiniList>" note="이름 · 설명 · 오른쪽 값(챙길 값은 빨간 점 칩)" spec="mini">
        <WaterCard title="재고 부족" className="water-surf-demo-fill">
          <WaterMiniList
            empty="없음"
            items={[
              { key: '1', title: '(P2S) 레이저 튜브', meta: 'P5010404 · P2S', value: '재고 -1', alert: true },
              { key: '2', title: '(D1) 마더보드', meta: 'D1', value: '재고 2' },
              { key: '3', title: '(F2) 집진 필터', meta: 'F2010022 · F2', value: '재고 5' },
            ]}
          />
        </WaterCard>
      </WaterSpec>

      <WaterSpec name="<WaterMiniList>" note="빈 목록" spec="mini-empty">
        <WaterCard title="중복 SN" className="water-surf-demo-fill">
          <WaterMiniList empty="겹치는 SN이 없어요." items={[]} />
        </WaterCard>
      </WaterSpec>

      <WaterSpec
        name="<WaterAttentionRow>"
        note="챙길 건이 있으면 떠 있는 유리 + 어두운 숫자 알약 · 0건은 벽에 붙은 판 · 숫자가 바뀌면 굴러간다"
        wide
        spec="attention"
      >
        <div className="water-ov-demo-stack">
          <WaterAttentionRow tiles={tiles} loading={false} />
          <button type="button" className="water-surf-demo" onClick={() => setStep((s) => s + 1)}>
            값 바꾸기
          </button>
          <WaterAttentionRow tiles={ATTENTION} loading />
        </div>
      </WaterSpec>

      <WaterSpec
        name="<WaterKingCard>"
        note="순위 막대(위에서부터 21ms) · 줄을 누르면 센 기록 · 실적 없음 · 불러오는 중"
        wide
        spec="king"
      >
        <div className="water-surf-demo-grid">
          <WaterKingCard
            def={KINGS[0]}
            spanLabel="이번 주"
            previousLabel="지난주"
            period={week}
            result={KING_RESULT}
            previousTop={{ name: '지상헌', count: 5, facts: [] }}
          />
          <WaterKingCard
            def={KINGS[1]}
            spanLabel="이번 주"
            previousLabel="지난주"
            period={week}
            result={{ total: 0, unassigned: 0, rows: [] }}
            previousTop={null}
          />
          <WaterKingCard
            def={KINGS[2]}
            spanLabel="이번 주"
            previousLabel="지난주"
            period={week}
            result={null}
            previousTop={null}
          />
        </div>
      </WaterSpec>

      <WaterSpec name="<WaterTeamCard>" note="나는 어두운 동그라미·나 칩 · 오늘 방문은 어두운 알약" wide spec="team">
        <div className="water-ov-demo-full">
          <WaterTeamCard members={MEMBERS} me={new Set(['이재민'])} loading={false} />
        </div>
      </WaterSpec>

      <WaterSpec name="<WaterTeamCard loading>" note="불러오는 중 · 사람 없음" wide spec="team-states">
        <div className="water-surf-demo-pair">
          <WaterTeamCard members={[]} me={new Set()} loading />
          <WaterTeamCard members={[]} me={new Set()} loading={false} />
        </div>
      </WaterSpec>
    </WaterSection>
  )
}
