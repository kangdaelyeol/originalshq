/**
 * 파싱 결과 컨테이너 — Python `ParseResult`, `_blank_row` 이관.
 */
import type { DetectedChannel } from './channel'
import type { ISODate } from '../types'

export type DetectedFormat =
  | 'per-row'
  | 'naver-other-summary'
  | 'period-aggregate'

/** DB(AdPerformance)에 그대로 적재되는 한 행. */
export interface ParsedRow {
  date: ISODate
  channel: DetectedChannel
  campaign_name: string
  adgroup_name: string
  keyword: string
  impressions: number
  clicks: number
  cost: number
  conversion: number
  conv_indirect: number
  conv_purchase: number
  revenue: number
  result_type: string | null
}

export function blankRow(channel: DetectedChannel, d: ISODate): ParsedRow {
  return {
    date: d,
    channel,
    campaign_name: '',
    adgroup_name: '',
    keyword: '',
    impressions: 0,
    clicks: 0,
    cost: 0,
    conversion: 0,
    conv_indirect: 0,
    conv_purchase: 0,
    revenue: 0,
    result_type: null,
  }
}

export class ParseResult {
  channel: DetectedChannel
  rows: ParsedRow[] = []
  warnings: string[] = []
  sourceName: string
  detectedFormat: DetectedFormat = 'per-row'

  constructor(channel: DetectedChannel, sourceName = '') {
    this.channel = channel
    this.sourceName = sourceName
  }

  get ok(): boolean {
    return this.rows.length > 0
  }

  get dateRange(): readonly [ISODate | null, ISODate | null] {
    const ds = this.rows
      .map((r) => r.date)
      .filter(Boolean)
      .sort()
    return ds.length ? [ds[0], ds[ds.length - 1]] : [null, null]
  }
}
