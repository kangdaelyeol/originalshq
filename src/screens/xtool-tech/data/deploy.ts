import type { Tone } from './types'

// 배포 스테이션 목업 — 실제 배포 트리거(GitHub Actions 등)가 붙기 전까지 화면 확인용.

export type InfraStatus = 'ok' | 'degraded' | 'down'

export const INFRA_STATUS: Record<InfraStatus, { label: string; tone: Tone }> = {
  ok: { label: '정상', tone: 'good' },
  degraded: { label: '지연', tone: 'warn' },
  down: { label: '장애', tone: 'crit' },
}

export interface InfraService {
  key: string
  name: string
  latencyMs: number
  status: InfraStatus
}

export const INFRA_HEALTH: readonly InfraService[] = [
  { key: 'functions', name: 'Firebase Functions', latencyMs: 42, status: 'ok' },
  { key: 'firestore', name: 'Cloud Firestore', latencyMs: 31, status: 'ok' },
  { key: 'actions', name: 'GitHub Actions', latencyMs: 58, status: 'degraded' },
  { key: 'monday', name: 'Monday API', latencyMs: 96, status: 'ok' },
]

export const DEFAULT_BRANCH = 'feature/glass-dashboard'

/** 다음 배포 번호 — 최근 배포 내역(DEP-2041) 다음부터. */
export const NEXT_DEPLOY_NUMBER = 2042
