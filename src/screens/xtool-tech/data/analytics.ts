import { periodBuckets, type Period } from './period'
import { seeded, seedOf } from './random'
import type { Option, StatCardData } from './types'

// ────────────────────────────────────────────────────────────────────────
// 분석 화면 목업 — 실제 모니터링(로그·APM) 값이 붙으면 이 파일만 바꾸면 된다.
// ────────────────────────────────────────────────────────────────────────

export const ANALYTICS_KPIS: Record<Period, StatCardData[]> = {
  today: [
    { key: 'peak', title: '최대 처리량', value: '1,840 RPS', delta: { value: '+22.4%', direction: 'up', good: true }, caption: '피크 버스트 기준' },
    { key: 'latency', title: '평균 응답 시간', value: '28.4ms', delta: { value: '-4.2ms', direction: 'down', good: true }, caption: 'SLA 목표 50ms' },
    { key: 'success', title: 'API 성공률', value: '99.92%', tag: { label: '정상', tone: 'good' }, caption: '기준 99.5% 이상' },
    { key: 'errors', title: '에러 이벤트', value: '148건', tag: { label: '주의', tone: 'crit' }, caption: '미해결 3건' },
  ],
  '7d': [
    { key: 'peak', title: '최대 처리량', value: '2,120 RPS', delta: { value: '+9.8%', direction: 'up', good: true }, caption: '피크 버스트 기준' },
    { key: 'latency', title: '평균 응답 시간', value: '30.1ms', delta: { value: '-1.6ms', direction: 'down', good: true }, caption: 'SLA 목표 50ms' },
    { key: 'success', title: 'API 성공률', value: '99.90%', tag: { label: '정상', tone: 'good' }, caption: '기준 99.5% 이상' },
    { key: 'errors', title: '에러 이벤트', value: '812건', tag: { label: '주의', tone: 'crit' }, caption: '미해결 5건' },
  ],
  '30d': [
    { key: 'peak', title: '최대 처리량', value: '2,460 RPS', delta: { value: '+14.2%', direction: 'up', good: true }, caption: '피크 버스트 기준' },
    { key: 'latency', title: '평균 응답 시간', value: '31.7ms', delta: { value: '+0.8ms', direction: 'up', good: false }, caption: 'SLA 목표 50ms' },
    { key: 'success', title: 'API 성공률', value: '99.88%', tag: { label: '정상', tone: 'good' }, caption: '기준 99.5% 이상' },
    { key: 'errors', title: '에러 이벤트', value: '3,204건', tag: { label: '주의', tone: 'crit' }, caption: '미해결 7건' },
  ],
  '1y': [
    { key: 'peak', title: '최대 처리량', value: '2,980 RPS', delta: { value: '+38.5%', direction: 'up', good: true }, caption: '피크 버스트 기준' },
    { key: 'latency', title: '평균 응답 시간', value: '34.9ms', delta: { value: '-6.3ms', direction: 'down', good: true }, caption: 'SLA 목표 50ms' },
    { key: 'success', title: 'API 성공률', value: '99.86%', tag: { label: '정상', tone: 'good' }, caption: '기준 99.5% 이상' },
    { key: 'errors', title: '에러 이벤트', value: '41,870건', tag: { label: '주의', tone: 'crit' }, caption: '미해결 9건' },
  ],
}

// ── 트래픽 파형(현재 기간 vs 직전 기간, 같은 축) ─────────────────────────────

export type TrafficMetric = 'requests' | 'latency'

export const TRAFFIC_METRICS: readonly Option<TrafficMetric>[] = [
  { value: 'requests', label: '요청 수' },
  { value: 'latency', label: '응답 시간' },
]

// 칸 하나의 평균 요청 수 — 오늘은 3시간, 7일은 하루, 30일은 3일, 1년은 한 달.
const REQUESTS_PER_BUCKET: Record<Period, number> = {
  today: 7800,
  '7d': 46000,
  '30d': 138000,
  '1y': 1_380_000,
}

/** 기간별 부하 모양(0~1) — 오늘은 오후 2~3시가 정점인 종 모양, 1년은 꾸준한 성장. */
function loadShape(period: Period, i: number, n: number): number {
  const t = i / (n - 1)
  switch (period) {
    case 'today': {
      const hour = i === n - 1 ? 24 : i * 3
      return 0.32 + 0.68 * Math.exp(-(((hour - 14) / 5.6) ** 2))
    }
    case '7d':
      return 0.78 + 0.22 * Math.sin(t * Math.PI)
    case '30d':
      return 0.82 + 0.18 * Math.sin(t * Math.PI * 1.6)
    case '1y':
      return 0.62 + 0.38 * t
  }
}

export function trafficLabels(period: Period): string[] {
  if (period === 'today') {
    return [...Array.from({ length: 8 }, (_, i) => `${String(i * 3).padStart(2, '0')}:00`), '23:59']
  }
  return periodBuckets(period)
}

export function trafficWave(
  period: Period,
  metric: TrafficMetric,
): { labels: string[]; current: number[]; previous: number[] } {
  const labels = trafficLabels(period)
  const rand = seeded(seedOf(`${period}:${metric}`))
  const n = labels.length
  const current: number[] = []
  const previous: number[] = []
  for (let i = 0; i < n; i++) {
    const load = loadShape(period, i, n)
    if (metric === 'requests') {
      const base = REQUESTS_PER_BUCKET[period] * load
      current.push(Math.round(base * (0.94 + rand() * 0.12)))
      previous.push(Math.round(base * (0.8 + rand() * 0.1)))
    } else {
      // 부하가 높을수록 응답이 느려진다 — 직전 기간이 조금 더 느렸던 걸로.
      const base = 19 + 18 * load
      current.push(Math.round(base * (0.95 + rand() * 0.1) * 10) / 10)
      previous.push(Math.round(base * (1.04 + rand() * 0.1) * 10) / 10)
    }
  }
  return { labels, current, previous }
}

// ── 서비스별 응답 지연(가로 막대) · 트래픽 소스(100% 막대) ─────────────────────

export const LATENCY_TARGET_MS = 50
export const LATENCY_SCALE_MS = 70

export const SERVICE_LATENCY = [
  { key: 'xtool-web', label: 'xtool-web', value: 22 },
  { key: 'lead-manager-web', label: 'lead-manager-web', value: 35 },
  { key: 'cmip-functions', label: 'cmip-functions', value: 41 },
  { key: 'monday-bridge', label: 'monday-bridge', value: 31 },
  { key: 'cafe24-sync', label: 'cafe24-sync', value: 58 },
] as const

export const TRAFFIC_SOURCES = [
  { key: 'web', label: '웹 대시보드', value: 46 },
  { key: 'api', label: '내부 API', value: 31 },
  { key: 'batch', label: '배치 · 스케줄러', value: 15 },
  { key: 'other', label: '기타', value: 8 },
] as const
