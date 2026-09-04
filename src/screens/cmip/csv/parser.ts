/**
 * 매체 리포트 CSV 파서 — functions-cmip `src/csv/parser.ts` 이관 (브라우저용, 미리보기 전용).
 *
 * 가져오기(적재)는 서버가 원본 파일을 다시 파싱하는 게 권위 소스다. 이 모듈은 업로드 없이
 * 즉시 미리보기(매체 감지 / 행 수 / 기간 / 경고)를 보여주기 위한 것.
 *
 * 하위 모듈: primitives(값 정제) / header(구분자·헤더) / channel(매체 감지) /
 * period-range(기간 추출) / encoding(인코딩 감지). ParseResult·ParsedRow·ALIASES 등
 * 공용 타입/상수는 `../types`에서 가져온다.
 */
import { parse as parseCsv } from 'csv-parse/browser/esm/sync'

import {
  NAVER_OTHER_MEDIA_LABEL,
  ParseResult,
  blankRow,
  type DetectedChannel,
  type ISODate,
  type ParsedRow,
} from '../types'
import { parseDate, dateRange, todayISO } from '../utils'
import { isSummaryLabel, toInt, toFloat } from './primitives'
import {
  repairHeader,
  detectDelimiter,
  findHeaderIdx,
  indexMap,
  type CsvRow,
  type IndexMap,
} from './header'
import { detectChannel } from './channel'
import { rangeFromFilename, rangeFromText, type DateSpan } from './period-range'
import { readText } from './encoding'

function cell(row: CsvRow, i: number): string | undefined {
  return i >= 0 && i < row.length ? row[i] : undefined
}

function campaignFor(
  idx: IndexMap,
  row: CsvRow,
  channel: DetectedChannel,
): string {
  const ci = idx.campaign
  const raw = ci >= 0 && ci < row.length ? String(row[ci]).trim() : ''
  if (
    channel === 'naver' &&
    (raw.toLowerCase().includes('naver') || raw.includes(':') || raw === '')
  ) {
    return NAVER_OTHER_MEDIA_LABEL
  }
  return raw || '(캠페인)'
}

function resolveSpan(rng: DateSpan | null): DateSpan {
  return rng ?? [todayISO(), todayISO()]
}

// --------------------------------------------------------------------------- //
// 진입점
// --------------------------------------------------------------------------- //
export function parseBuffer(
  buffer: Uint8Array | ArrayBuffer,
  name: string,
  channelHint: DetectedChannel | null = null,
): ParseResult {
  return parseText(readText(buffer), name, channelHint)
}

export function parseText(
  txt: string,
  name: string,
  channelHint: DetectedChannel | null = null,
): ParseResult {
  const delim = detectDelimiter(txt)
  let allRows = parseCsv(txt, {
    delimiter: delim,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: false,
    trim: false,
  }) as CsvRow[]
  allRows = allRows.filter((r) => r.some((c) => String(c).trim()))

  if (allRows.length < 2) {
    const res = new ParseResult(channelHint ?? 'generic', name)
    res.warnings.push('빈 파일이거나 데이터 행이 없습니다.')
    return res
  }

  const hIdx = findHeaderIdx(allRows)
  const header = repairHeader(allRows[hIdx].map((c) => String(c).trim()))
  const body = allRows.slice(hIdx + 1)
  const idx = indexMap(header)

  const rawChannel = channelHint ?? detectChannel(header, name)
  const channel: DetectedChannel =
    rawChannel === 'naver_other' ? 'naver' : rawChannel
  const res = new ParseResult(channel, name)

  const hasDateCol =
    idx.date >= 0 &&
    body.slice(0, 50).some((r) => r.length > idx.date && parseDate(r[idx.date]))

  // (A) 네이버 기타매체 계정 집계형 (날짜 없음)
  if (rawChannel === 'naver_other' && !hasDateCol) {
    return parseNaverOtherSummary(body, idx, name, txt, res)
  }
  // (B) 날짜 컬럼 없는 기간 집계형 (구글/네이버 등)
  if (!hasDateCol) {
    return parsePeriodAggregate(body, idx, name, txt, res)
  }
  // (C) 일반 per-row
  return parsePerRow(body, idx, res)
}

function parsePerRow(
  body: CsvRow[],
  idx: IndexMap,
  res: ParseResult,
): ParseResult {
  for (const row of body) {
    if (!row || row.length === 0) continue
    // B열 '전체' 공통 필터
    if (row.length > 1 && String(row[1]).includes('전체')) continue

    const d =
      idx.date >= 0 && row.length > idx.date ? parseDate(row[idx.date]) : null
    if (!d) continue

    const rawCamp =
      idx.campaign >= 0 && idx.campaign < row.length
        ? String(row[idx.campaign]).trim()
        : ''
    const rawAdg =
      idx.adgroup >= 0 && idx.adgroup < row.length
        ? String(row[idx.adgroup]).trim()
        : ''
    // 캠페인/광고세트가 모두 빈 행 = 매체 전체 합계 행(메타 CSV) → 중복 집계 방지
    if (!rawCamp && !rawAdg) continue

    const campaign = campaignFor(idx, row, res.channel)
    const adgroup = rawAdg
    if (isSummaryLabel(campaign) || isSummaryLabel(adgroup)) continue

    const imp = toInt(cell(row, idx.impressions))
    const clk = toInt(cell(row, idx.clicks))
    const cost = toFloat(cell(row, idx.cost))
    if (!(imp || clk || cost)) continue

    let rt: string | null = null
    if (idx.result_type >= 0 && row.length > idx.result_type) {
      rt = String(row[idx.result_type]).trim() || null
    }

    const r: ParsedRow = blankRow(res.channel, d)
    Object.assign(r, {
      campaign_name: campaign,
      adgroup_name: adgroup,
      keyword:
        idx.keyword >= 0 && row.length > idx.keyword
          ? String(row[idx.keyword]).trim()
          : '',
      impressions: imp,
      clicks: clk,
      cost,
      conversion: toFloat(cell(row, idx.conversion)),
      conv_indirect: toFloat(cell(row, idx.conv_indirect)),
      conv_purchase: toFloat(cell(row, idx.conv_purchase)),
      revenue: toFloat(cell(row, idx.revenue)),
      result_type: rt,
    })
    res.rows.push(r)
  }

  if (res.rows.length === 0) {
    res.warnings.push('파싱된 유효 행이 없습니다. 헤더/날짜 형식을 확인하세요.')
  }
  if (idx.revenue < 0) {
    res.warnings.push(
      '매출(전환매출액/리드수익) 컬럼을 찾지 못했습니다 — ROAS는 계산되지 않습니다.',
    )
  }
  return res
}

interface AggregateEntry {
  imp: number
  clk: number
  cost: number
  conv: number
  rev: number
}

/** 날짜 없는 집계형: 캠페인별 합계. */
function aggregateBody(
  body: CsvRow[],
  idx: IndexMap,
): Record<string, AggregateEntry> {
  const agg: Record<string, AggregateEntry> = {}
  for (const row of body) {
    if (!row || row.length === 0) continue
    if (row.length > 1 && String(row[1]).includes('전체')) continue

    const ci = idx.campaign
    const camp =
      ci >= 0 && ci < row.length ? String(row[ci]).trim() : '(캠페인)'
    if (isSummaryLabel(camp)) continue

    const imp = toInt(cell(row, idx.impressions))
    const clk = toInt(cell(row, idx.clicks))
    const cost = toFloat(cell(row, idx.cost))
    const conv = toFloat(cell(row, idx.conversion))
    const rev = toFloat(cell(row, idx.revenue))
    if (!(imp || clk || cost)) continue

    const key = camp || '(캠페인)'
    agg[key] ??= { imp: 0, clk: 0, cost: 0, conv: 0, rev: 0 }
    const o = agg[key]
    o.imp += imp
    o.clk += clk
    o.cost += cost
    o.conv += conv
    o.rev += rev
  }
  return agg
}

function distribute(
  res: ParseResult,
  campLabel: string,
  aggOne: AggregateEntry,
  days: ISODate[],
  tag: string,
): void {
  const n = days.length
  for (const d of days) {
    const r: ParsedRow = blankRow(res.channel, d)
    Object.assign(r, {
      campaign_name:
        n > 1 ? `${campLabel} [균등배분 ${days[0]}~${days[n - 1]}]` : campLabel,
      impressions: Math.round(aggOne.imp / n),
      clicks: Math.round(aggOne.clk / n),
      cost: aggOne.cost / n,
      conversion: aggOne.conv / n,
      revenue: aggOne.rev / n,
    })
    res.rows.push(r)
  }
  if (n > 1) {
    res.warnings.push(
      `'${campLabel}' — ${tag}: 총계를 ${n}일로 균등 배분했습니다. ` +
        '※ 나중에 이 기간 중 일부 날짜만 실제 일별 데이터로 교체하면 나머지 날짜 배분값이 왜곡됩니다.',
    )
  }
}

function parseNaverOtherSummary(
  body: CsvRow[],
  idx: IndexMap,
  name: string,
  txt: string,
  res: ParseResult,
): ParseResult {
  res.detectedFormat = 'naver-other-summary'
  const found = rangeFromFilename(name) || rangeFromText(txt)
  if (!found) {
    res.warnings.push(
      '기간을 찾지 못해 오늘 하루로 처리했습니다 — 파일명에 기간(_YYYYMMDD_YYYYMMDD)을 포함해 주세요.',
    )
  }
  const [start, end] = resolveSpan(found)
  const days = dateRange(start, end)
  const agg = aggregateBody(body, idx)
  if (Object.keys(agg).length === 0) {
    res.warnings.push('집계할 데이터를 찾지 못했습니다.')
    return res
  }
  for (const one of Object.values(agg)) {
    distribute(
      res,
      NAVER_OTHER_MEDIA_LABEL,
      one,
      days,
      '네이버 기타매체 계정 집계형',
    )
  }
  return res
}

function parsePeriodAggregate(
  body: CsvRow[],
  idx: IndexMap,
  name: string,
  txt: string,
  res: ParseResult,
): ParseResult {
  res.detectedFormat = 'period-aggregate'
  const found = rangeFromText(txt) || rangeFromFilename(name)
  if (!found) {
    res.warnings.push('날짜 컬럼도 기간 표기도 없어 오늘 하루로 처리했습니다.')
  }
  const [start, end] = resolveSpan(found)
  const days = dateRange(start, end)
  const agg = aggregateBody(body, idx)
  if (Object.keys(agg).length === 0) {
    res.warnings.push('집계할 데이터를 찾지 못했습니다.')
    return res
  }
  for (const [camp, one] of Object.entries(agg)) {
    distribute(res, camp, one, days, '기간 집계형(날짜 컬럼 없음)')
  }
  return res
}
