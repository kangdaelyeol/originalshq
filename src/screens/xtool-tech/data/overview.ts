import { GitPullRequest, Rocket, ShieldCheck, Timer } from 'lucide-react'
import { periodBuckets, type Period } from './period'
import { seeded, seedOf } from './random'
import type { Option, StatCardData, Tone } from './types'

// ────────────────────────────────────────────────────────────────────────
// 개요 화면 목업 — 실제 데이터(배포 기록·GitHub 등)가 붙으면 이 파일만 바꾸면 된다.
// ────────────────────────────────────────────────────────────────────────

export const OVERVIEW_KPIS: Record<Period, StatCardData[]> = {
  today: [
    { key: 'deploys', title: '배포 횟수', value: '6회', icon: Rocket, tint: 'blue', delta: { value: '+2회', direction: 'up', good: true }, caption: '어제 대비' },
    { key: 'prs', title: '머지된 PR', value: '14건', icon: GitPullRequest, tint: 'violet', delta: { value: '+16.7%', direction: 'up', good: true }, caption: '리뷰 평균 2.4시간' },
    { key: 'uptime', title: '서비스 가동률', value: '100%', icon: ShieldCheck, tint: 'green', delta: { value: '+0.02%', direction: 'up', good: true }, caption: 'SLA 99.9% 목표' },
    { key: 'lead', title: '평균 리드타임', value: '0.9일', icon: Timer, tint: 'amber', delta: { value: '-0.2일', direction: 'down', good: true }, caption: '커밋 → 배포' },
  ],
  '7d': [
    { key: 'deploys', title: '배포 횟수', value: '31회', icon: Rocket, tint: 'blue', delta: { value: '+9.4%', direction: 'up', good: true }, caption: '지난주 대비' },
    { key: 'prs', title: '머지된 PR', value: '82건', icon: GitPullRequest, tint: 'violet', delta: { value: '+5.1%', direction: 'up', good: true }, caption: '리뷰 평균 3.0시간' },
    { key: 'uptime', title: '서비스 가동률', value: '99.97%', icon: ShieldCheck, tint: 'green', delta: { value: '+0.04%', direction: 'up', good: true }, caption: 'SLA 99.9% 목표' },
    { key: 'lead', title: '평균 리드타임', value: '1.3일', icon: Timer, tint: 'amber', delta: { value: '-0.1일', direction: 'down', good: true }, caption: '커밋 → 배포' },
  ],
  '30d': [
    { key: 'deploys', title: '배포 횟수', value: '128회', icon: Rocket, tint: 'blue', delta: { value: '+14.6%', direction: 'up', good: true }, caption: '직전 30일 대비' },
    { key: 'prs', title: '머지된 PR', value: '342건', icon: GitPullRequest, tint: 'violet', delta: { value: '+8.2%', direction: 'up', good: true }, caption: '리뷰 평균 3.1시간' },
    { key: 'uptime', title: '서비스 가동률', value: '99.94%', icon: ShieldCheck, tint: 'green', delta: { value: '+0.06%', direction: 'up', good: true }, caption: 'SLA 99.9% 목표' },
    { key: 'lead', title: '평균 리드타임', value: '1.42일', icon: Timer, tint: 'amber', delta: { value: '-0.3일', direction: 'down', good: true }, caption: '커밋 → 배포' },
  ],
  '1y': [
    { key: 'deploys', title: '배포 횟수', value: '1,412회', icon: Rocket, tint: 'blue', delta: { value: '+38.2%', direction: 'up', good: true }, caption: '직전 1년 대비' },
    { key: 'prs', title: '머지된 PR', value: '3,980건', icon: GitPullRequest, tint: 'violet', delta: { value: '+21.4%', direction: 'up', good: true }, caption: '리뷰 평균 3.6시간' },
    { key: 'uptime', title: '서비스 가동률', value: '99.91%', icon: ShieldCheck, tint: 'green', delta: { value: '-0.02%', direction: 'down', good: false }, caption: 'SLA 99.9% 목표' },
    { key: 'lead', title: '평균 리드타임', value: '1.8일', icon: Timer, tint: 'amber', delta: { value: '-0.9일', direction: 'down', good: true }, caption: '커밋 → 배포' },
  ],
}

// ── 개발 생산성 추이(선 차트) ──────────────────────────────────────────────

export type OverviewMeasure = 'deploys' | 'commits' | 'prs'

export const OVERVIEW_MEASURES: readonly Option<OverviewMeasure>[] = [
  { value: 'deploys', label: '배포' },
  { value: 'commits', label: '커밋' },
  { value: 'prs', label: 'PR' },
]

const PER_DAY: Record<OverviewMeasure, number> = { deploys: 4.3, commits: 46, prs: 11.4 }
const DAYS_PER_BUCKET: Record<Period, number> = { today: 1 / 12, '7d': 1, '30d': 3, '1y': 30.4 }
// 하루 중 시간대별 작업량(2시간 칸) — 밤에는 거의 없고 오후에 몰린다.
const HOURLY_SHAPE = [0.15, 0.05, 0.05, 0.3, 1.2, 1.7, 1.5, 1.9, 1.6, 0.9, 0.45, 0.2]
const HOURLY_MEAN = HOURLY_SHAPE.reduce((s, v) => s + v, 0) / HOURLY_SHAPE.length

/** 기간 × 지표별 추이 — 오른쪽으로 갈수록 늘어나는 모양(샘플 영상의 곡선과 같은 흐름). */
export function overviewTrend(
  period: Period,
  measure: OverviewMeasure,
): { labels: string[]; values: number[] } {
  const labels = periodBuckets(period)
  const rand = seeded(seedOf(`${period}:${measure}`))
  const last = labels.length - 1
  const values = labels.map((_, i) => {
    const growth = 0.7 + 0.55 * (i / last)
    const shape = period === 'today' ? HOURLY_SHAPE[i] / HOURLY_MEAN : 1
    const noise = 0.86 + rand() * 0.28
    return Math.round(PER_DAY[measure] * DAYS_PER_BUCKET[period] * growth * shape * noise)
  })
  return { labels, values }
}

// ── 작업 유형 분포(도넛) ──────────────────────────────────────────────────

export interface WorkSlice {
  key: string
  label: string
  value: number
}

export const WORK_MIX: Record<Period, WorkSlice[]> = {
  today: [
    { key: 'feature', label: '기능 개발', value: 9 },
    { key: 'bug', label: '버그 수정', value: 5 },
    { key: 'infra', label: '인프라 · 운영', value: 3 },
  ],
  '7d': [
    { key: 'feature', label: '기능 개발', value: 52 },
    { key: 'bug', label: '버그 수정', value: 27 },
    { key: 'infra', label: '인프라 · 운영', value: 17 },
  ],
  '30d': [
    { key: 'feature', label: '기능 개발', value: 184 },
    { key: 'bug', label: '버그 수정', value: 95 },
    { key: 'infra', label: '인프라 · 운영', value: 61 },
  ],
  '1y': [
    { key: 'feature', label: '기능 개발', value: 2140 },
    { key: 'bug', label: '버그 수정', value: 1180 },
    { key: 'infra', label: '인프라 · 운영', value: 702 },
  ],
}

// ── 최근 배포 내역(표) ────────────────────────────────────────────────────

export type DeployStatus = 'success' | 'running' | 'failed'
export type DeployFilter = 'all' | DeployStatus

export const DEPLOY_STATUS: Record<DeployStatus, { label: string; tone: Tone }> = {
  success: { label: '성공', tone: 'good' },
  running: { label: '진행 중', tone: 'warn' },
  failed: { label: '실패', tone: 'crit' },
}

export const DEPLOY_FILTERS: readonly Option<DeployFilter>[] = [
  { value: 'all', label: '전체' },
  { value: 'success', label: '성공' },
  { value: 'running', label: '진행 중' },
  { value: 'failed', label: '실패' },
]

export interface DeployRecord {
  id: string
  authorId: string
  service: string
  /** 브랜치@커밋 */
  ref: string
  status: DeployStatus
  time: string
}

export const RECENT_DEPLOYS: readonly DeployRecord[] = [
  { id: 'DEP-2041', authorId: 'm2', service: 'cmip-functions', ref: 'main@3f9c2a1', status: 'success', time: '2분 전' },
  { id: 'DEP-2040', authorId: 'm3', service: 'lead-manager-web', ref: 'main@a81d07e', status: 'success', time: '8분 전' },
  { id: 'DEP-2039', authorId: 'm4', service: 'monday-bridge', ref: 'release@5be2f19', status: 'running', time: '14분 전' },
  { id: 'DEP-2038', authorId: 'm5', service: 'cafe24-sync', ref: 'hotfix@c0941aa', status: 'failed', time: '22분 전' },
  { id: 'DEP-2037', authorId: 'm1', service: 'xtool-tech', ref: 'main@77e1b3d', status: 'success', time: '35분 전' },
]

// ── 실시간 활동 로그 ──────────────────────────────────────────────────────

export interface ActivityItem {
  id: string
  tone: 'good' | 'info' | 'warn' | 'crit'
  title: string
  time: string
}

export const ACTIVITY: readonly ActivityItem[] = [
  { id: 'a1', tone: 'info', title: 'PR #482가 main 브랜치에 머지됐어요', time: '방금 전' },
  { id: 'a2', tone: 'good', title: 'lead-manager-web 프로덕션 배포 완료', time: '4분 전' },
  { id: 'a3', tone: 'warn', title: 'cafe24-sync p95 응답 지연 경고 (58ms)', time: '11분 전' },
  { id: 'a4', tone: 'crit', title: 'cafe24-sync 빌드 실패 감지', time: '22분 전' },
  { id: 'a5', tone: 'good', title: '야간 배치 정상 종료 (Firestore 백업)', time: '38분 전' },
]
