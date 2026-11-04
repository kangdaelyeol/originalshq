// 당근 광고그룹 설정 읽기 — 예산·입찰·타기팅(지역·연령·성별·플랫폼·관심사·
// 맞춤 오디언스)은 광고그룹에 있다(캠페인에는 없어 읽지 않는다). 켜진(ON)
// 것만, 조회만 한다. 금액은 매체가 준 그대로(부가세를 빼지 않는다).
import { adEntityKey } from '../ad-settings/types'
import {
  fetchDaangnGroups,
  type DaangnCredentials,
} from '../channel/daangn/client'
import { budgetOf, join, positiveOrNull, reading, won } from './format'
import type { PlatformReading } from './types'

const BIDDING: Record<string, string> = {
  MAXIMIZE_CONVERSIONS: '전환 최대화',
  MAXIMIZE_CLICKS: '클릭 최대화',
}

const GENDER: Record<string, string> = { FEMALE: '여성', MALE: '남성' }

const sorted = (values: readonly string[] | undefined) =>
  [...(values ?? [])].sort().join(', ')

/** 켜진 광고그룹의 설정. */
export async function readDaangnSettings(
  credentials: DaangnCredentials,
): Promise<PlatformReading[]> {
  const groups = await fetchDaangnGroups(credentials)
  return groups
    .filter((g) => g.liveStatusType === 'ON')
    .map((g) => {
      const bid = positiveOrNull(g.bidAmount)
      const regions = g.targetRegionIds?.length ?? 0
      const interests = g.targetInterestCategoryIds?.length ?? 0
      const audiences = g.targetCustomAudiences?.length ?? 0
      return reading(
        {
          entityKey: adEntityKey('daangn', 'adset', g.groupId),
          channel: 'daangn',
          level: 'adset',
          platformId: g.groupId,
          name: g.title,
        },
        {
          budget: budgetOf(
            g.budget?.amount?.value,
            !g.budget?.type || g.budget.type === 'DAILY_BUDGET'
              ? 'daily'
              : 'lifetime',
          ),
          bidding: join([
            g.biddingType && (BIDDING[g.biddingType] ?? g.biddingType),
            bid !== null && `입찰가 ${won(bid)}`,
          ]),
          audience: join([
            regions > 0 &&
              `지역 ${regions}곳${g.targetRegionOption ? `(${g.targetRegionOption})` : ''}`,
            sorted(g.targetDemographic?.targetAge) &&
              `연령 ${sorted(g.targetDemographic?.targetAge)}`,
            sorted(g.targetDemographic?.targetGender) &&
              `성별 ${sorted(
                g.targetDemographic?.targetGender?.map((v) => GENDER[v] ?? v),
              )}`,
            g.targetPlatform && `플랫폼 ${g.targetPlatform}`,
            interests > 0 && `관심사 ${interests}`,
            audiences > 0 && `맞춤 오디언스 ${audiences}`,
          ]),
        },
      )
    })
}
