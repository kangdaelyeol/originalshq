import { useState, type CSSProperties } from 'react'
import * as ExcelJS from 'exceljs'
import {
  aggregateMetrics,
  groupByCustomPeriod,
  groupByMonth,
  type ChannelSplitSeries,
  type CombinedAdset,
  type CombinedCampaign,
  type MetricsSummary,
} from '../client'
import { METRIC_FIELDS, type MetricField } from './metric-fields'
import '../styles/excel-export-modal.scss'

type MetricKey = keyof MetricsSummary

type ChannelKey = 'meta' | 'google' | 'naver'

/** 캠페인/애드셋 시트가 어느 데이터를 쓸지 — 'combined'는 기존 "캠페인"/
 * "애드셋" 시트(채널 합산), 그 외엔 "캠페인-Meta"류 매체별 시트(그 채널
 * 데이터만). ExportCampaign/CombinedAdset 둘 다 ChannelSplitSeries 모양이라
 * (combined/meta/google/naver 네 키를 그대로 갖고 있어) entity[selector]로
 * 바로 그 채널의 GroupedInsightSeries를 꺼낼 수 있다. */
type ChannelSelector = 'combined' | ChannelKey

// meta-insight.tsx의 CHANNELS와 같은 목록 — 순환 참조를 피하려고 이 모달
// 안에 따로 둔다(meta-insight.tsx는 lazy import로 이 파일을 불러오는 쪽이라
// 반대 방향 정적 import를 걸면 순환이 생긴다). 당근 등 채널이 늘면 이 목록도
// meta-insight.tsx의 CHANNELS와 같이 늘려야 한다.
const CHANNELS: readonly { key: ChannelKey; label: string }[] = [
  { key: 'meta', label: 'Meta' },
  { key: 'google', label: 'Google' },
  { key: 'naver', label: 'Naver' },
]

/** CombinedCampaign/CombinedAdset에 표시용 채널 라벨 문자열("Meta, Google")을
 * 미리 얹은 모양 — 채널 로고/브랜드색 계산(channelsOf, CHANNELS)은
 * meta-insight.tsx에 있는 걸 그대로 쓰고, 이 모달은 다 계산된 문자열만 받아
 * 엑셀 셀에 그대로 찍는다. */
export type ExportCampaign = CombinedCampaign & {
  channelLabel: string
  adsets: readonly (CombinedAdset & { channelLabel: string })[]
}

type SheetKey = 'total' | 'campaign' | 'adset'

const SHEET_OPTIONS: readonly { key: SheetKey; label: string }[] = [
  { key: 'total', label: '전체 요약' },
  { key: 'campaign', label: '캠페인' },
  { key: 'adset', label: '애드셋' },
]

// 원/회/건처럼 개수·금액성 단위는 헤더에 안 붙인다(값만 봐도 뜻이 분명하고,
// 붙이면 컬럼이 쓸데없이 넓어진다) — %만 값의 의미(비율)를 헷갈리기 쉬워서 남긴다.
const metricHeaders = (fields: readonly MetricField[]): string[] =>
  fields.map((f) => (f.unit === '%' ? `${f.label} (%)` : f.label))

// 소수점 있는 값(전환수·지표 비율 등)은 엑셀 General 서식이 부동소수점 오차까지
// 그대로 보여줄 수 있어(예: 12.345678913519) 여기서 미리 소수 둘째 자리로
// 반올림해 넣는다. 정수 지표(impressions/clicks 등)는 반올림해도 그대로다.
const round2 = (v: number): number => Math.round(v * 100) / 100

const metricValues = (
  metrics: MetricsSummary,
  fields: readonly MetricField[],
): number[] => fields.map((f) => round2(metrics[f.key]))

// impressions/clicks는 "횟수"라 낱개 값은 항상 정수다 — 그 칸엔 소수 서식을
// 안 준다(정수인데 "12.00"처럼 보이면 오히려 어색하다). 다만 이 두 지표도
// 여러 행의 평균은 자연히 소수가 되므로(예: 일평균 클릭 45.7회), 평균 행
// 에서는 이 구분 없이 전부 소수 둘째 자리로 보여준다.
const INTEGER_METRIC_KEYS: ReadonlySet<MetricKey> = new Set([
  'impressions',
  'clicks',
])
// #,##0 — 천 단위 구분 쉼표. 노출수·스펜드처럼 큰 값이 쉼표 없이 죽 이어져
// 자릿수를 세기 어려웠던 걸 보완한다.
const DECIMAL_FORMAT = '#,##0.00'
const INTEGER_FORMAT = '#,##0'

/** 표 하나를 시트의 startRow부터 그려 넣고, 다음 표가 시작할 행 번호를
 * 돌려준다(제목 행 + 헤더 행 + 데이터 행들 + (있으면) 평균 행 + 빈 줄 하나).
 * 한 시트 안에 컬럼 구성이 서로 다른 표를 여러 개 쌓아야 해서, ws.columns
 * (시트 전체에 적용되는 고정 컬럼 스키마)나 ws.addRow(키 매핑) 대신 셀
 * 좌표를 직접 지정한다. fields는 headers/rows의 맨 뒤 fields.length개 칸이
 * 지표 칸이라는 뜻 — 그 칸에만 소수 서식·평균 계산을 적용하고, 앞쪽 라벨
 * 칸(이름/날짜 등)은 건드리지 않는다. showAverage=false는 "요약"류(이미
 * 합계·총계인 표라 그 행들을 다시 평균 내는 게 의미가 없는 표)에 쓴다.
 * groupRows=true면 제목 행만 빼고(헤더+데이터+평균) 하나의 outlineLevel
 * 그룹으로 묶어서, 표 하나를 제목만 남기고 접었다 펼 수 있게 한다 —
 * 일별 성과처럼 데이터 행이 많은 표에서 쓴다. 이 표 안에는(캠페인/애드셋
 * 블록과 달리) 빈 줄이 없어서 별도 height 보정 없이도 outlineLevel이
 * 정상 저장된다. */
function writeTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  headers: readonly string[],
  rows: readonly (string | number)[][],
  fields: readonly MetricField[],
  showAverage = true,
  groupRows = false,
): number {
  const titleCell = ws.getCell(startRow, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 12 }

  const headerRowIndex = startRow + 1
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRowIndex, i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1C2128' },
    }
  })

  const labelColumnCount = headers.length - fields.length

  rows.forEach((row, ri) => {
    row.forEach((value, ci) => {
      const cell = ws.getCell(headerRowIndex + 1 + ri, ci + 1)
      cell.value = value
      const field = fields[ci - labelColumnCount]
      if (field) {
        cell.numFmt = INTEGER_METRIC_KEYS.has(field.key)
          ? INTEGER_FORMAT
          : DECIMAL_FORMAT
      }
    })
  })

  let lastContentRow = headerRowIndex + rows.length

  if (showAverage && rows.length > 0) {
    const avgRowIndex = headerRowIndex + 1 + rows.length
    const labelCell = ws.getCell(avgRowIndex, 1)
    labelCell.value = '평균'
    labelCell.font = { italic: true, bold: true }

    fields.forEach((_, fi) => {
      const ci = labelColumnCount + fi
      const sum = rows.reduce((s, r) => {
        const v = r[ci]
        return s + (typeof v === 'number' ? v : 0)
      }, 0)
      const cell = ws.getCell(avgRowIndex, ci + 1)
      cell.value = round2(sum / rows.length)
      cell.numFmt = DECIMAL_FORMAT
      cell.font = { italic: true }
    })

    lastContentRow = avgRowIndex
  }

  // 제목 행(startRow)은 그룹 밖에 둬서 접어도 표 제목만은 남는다 — 헤더~
  // 평균(또는 마지막 데이터 행)까지만 묶는다.
  if (groupRows) {
    for (let r = headerRowIndex; r <= lastContentRow; r++) {
      const gr = ws.getRow(r)
      gr.outlineLevel = 1
      gr.hidden = false
    }
  }

  return lastContentRow + 2
}

function setColumnWidths(ws: ExcelJS.Worksheet, count: number) {
  ws.getColumn(1).width = 26
  for (let i = 2; i <= count; i++) ws.getColumn(i).width = 16
}

/** 캠페인·애드셋마다 표 블록(월간~요일별 5개)이 하나씩 쌓이는 구간에서,
 * 어디까지가 한 캠페인/애드셋 몫인지 한눈에 끊어 보이도록 굵은 색 띠를
 * 한 줄 긋는다. 표 사이(같은 엔티티 안)의 평범한 빈 줄보다 훨씬 눈에 띄게
 * 해서 "여기서 다음 캠페인/애드셋으로 넘어간다"는 게 스크롤만 해도 바로
 * 보이게 한다. */
function writeDivider(
  ws: ExcelJS.Worksheet,
  row: number,
  columnCount: number,
): number {
  for (let ci = 1; ci <= columnCount; ci++) {
    const cell = ws.getCell(row, ci)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4493F8' },
    }
  }
  return row + 2
}

/** 캠페인/애드셋 블록 맨 위에 두는 대제목 — 그 아래 표들(월간~요일별)은
 * outlineLevel로 묶여서 접히는데, 이 행은 그 그룹 밖(outlineLevel 0)에 둬서
 * 접었을 때도 안 사라진다. 그룹을 접으면 "[캠페인A] 월간 성과" 같은 표
 * 제목까지 같이 숨어버려서 뭘 접은 건지 알 수 없었던 문제(대제목이 없던
 * 이전 버전)를 이걸로 해결한다 — 접혀 있어도 이 행만은 항상 보인다. */
function writeEntityHeading(
  ws: ExcelJS.Worksheet,
  row: number,
  title: string,
  columnCount: number,
): number {
  const cell = ws.getCell(row, 1)
  cell.value = title
  cell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  for (let ci = 1; ci <= columnCount; ci++) {
    ws.getCell(row, ci).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF21262D' },
    }
  }
  ws.mergeCells(row, 1, row, columnCount)
  return row + 1
}

const periodTitle = (label: string, bucketSize: number | null): string =>
  bucketSize
    ? `${label} (${bucketSize}일 단위)`
    : `${label} (구간 일수를 입력해주세요)`

function writeTotalSheet(
  wb: ExcelJS.Workbook,
  total: {
    combined: MetricsSummary
    meta: MetricsSummary
    google: MetricsSummary
    naver: MetricsSummary
  },
  series: ChannelSplitSeries,
  fields: readonly MetricField[],
  dateStart: string,
  dateEnd: string,
  bucketSize: number | null,
) {
  const ws = wb.addWorksheet('전체요약')
  // summaryBelow: true → 표마다 제목 행만 남기고 접었다 펼 수 있는 컨트롤이
  // 그 표 바로 아래(다음 표 시작 전 빈 줄 자리)에 뜬다.
  ws.properties.outlineProperties = {
    summaryBelow: true,
    summaryRight: false,
  }
  setColumnWidths(ws, 1 + fields.length)

  // 이 캠페인/adset에 데이터가 아예 없는 채널(예: Meta 전용 계정의 Google)은
  // 펼쳐봐야 모든 행이 0으로만 나와서 의미가 없으니 미리 걸러낸다 — 화면의
  // "자세히 보기" 채널 카드, 채널 필터와 같은 기준.
  const applicableChannels = CHANNELS.filter(
    (c) => series[c.key].byDate.length > 0,
  )

  let row = 1

  // 화면 맨 위 Summary 카드(channel-insight__summary)에 대응 — 전체(combined)
  // 총계 1행 + 데이터가 있는 채널마다 1행. 이미 총계들이라 평균 행은 안 붙인다.
  row = writeTable(
    ws,
    row,
    '요약',
    ['Channel', ...metricHeaders(fields)],
    [
      ['전체', ...metricValues(total.combined, fields)],
      ...applicableChannels.map((c) => [
        c.label,
        ...metricValues(total[c.key], fields),
      ]),
    ],
    fields,
    false,
    true,
  )

  // 표 순서: 요약(위에서 이미 씀) → 월간 → 주간 → 일간 → 이전 일정 vs
  // 지정 일정(아래 별도 블록) → 요일별(맨 마지막, 별도 블록). 요일별(월~일
  // 반복 집계)은 이 "기간을 점점 좁혀가며 보기" 흐름과 안 맞아 따로 뺐다.
  const timeTables: readonly {
    title: string
    headLabel: string
    rowsOf: (
      s: ChannelSplitSeries[ChannelKey | 'combined'],
    ) => (string | number)[][]
  }[] = [
    {
      title: '월간 성과',
      headLabel: '월',
      rowsOf: (s) =>
        groupByMonth(s.byDate).map((w) => [
          w.period,
          ...metricValues(w, fields),
        ]),
    },
    {
      title: '주차별 성과',
      headLabel: '기간',
      rowsOf: (s) =>
        s.byGroupedWeek.map((w) => [w.period, ...metricValues(w, fields)]),
    },
    {
      title: '일별 성과',
      headLabel: '날짜',
      rowsOf: (s) => s.byDate.map((d) => [d.date, ...metricValues(d, fields)]),
    },
  ]

  // 월간/주차별/일별 각각 — combined 표 하나 다음에 채널별(Meta/Google/Naver
  // 중 실제 데이터 있는 것만) 표를 바로 이어 쌓는다.
  for (const t of timeTables) {
    row = writeTable(
      ws,
      row,
      t.title,
      [t.headLabel, ...metricHeaders(fields)],
      t.rowsOf(series.combined),
      fields,
      true,
      true,
    )
    for (const c of applicableChannels) {
      row = writeTable(
        ws,
        row,
        `${c.label} ${t.title}`,
        [t.headLabel, ...metricHeaders(fields)],
        t.rowsOf(series[c.key]),
        fields,
        true,
        true,
      )
    }
  }

  // 이전 일정 vs 지정 일정 — combined 다음 채널별.
  const customRowsOf = (byDate: ChannelSplitSeries['combined']['byDate']) =>
    bucketSize
      ? groupByCustomPeriod(byDate, dateStart, dateEnd, bucketSize)
      : []
  row = writeTable(
    ws,
    row,
    periodTitle('이전 일정 vs 지정 일정 비교분석', bucketSize),
    ['기간', ...metricHeaders(fields)],
    customRowsOf(series.combined.byDate).map((w) => [
      w.period,
      ...metricValues(w, fields),
    ]),
    fields,
    true,
    true,
  )
  for (const c of applicableChannels) {
    row = writeTable(
      ws,
      row,
      periodTitle(`${c.label} 이전 일정 vs 지정 일정 비교분석`, bucketSize),
      ['기간', ...metricHeaders(fields)],
      customRowsOf(series[c.key].byDate).map((w) => [
        w.period,
        ...metricValues(w, fields),
      ]),
      fields,
      true,
      true,
    )
  }

  // 맨 마지막 — 요일별. combined 다음 채널별.
  row = writeTable(
    ws,
    row,
    '요일별 성과',
    ['요일', ...metricHeaders(fields)],
    series.combined.byDayOfWeek.map((d) => [
      d.dayOfWeek,
      ...metricValues(d, fields),
    ]),
    fields,
    true,
    true,
  )
  for (const c of applicableChannels) {
    row = writeTable(
      ws,
      row,
      `${c.label} 요일별 성과`,
      ['요일', ...metricHeaders(fields)],
      series[c.key].byDayOfWeek.map((d) => [
        d.dayOfWeek,
        ...metricValues(d, fields),
      ]),
      fields,
      true,
      true,
    )
  }
}

const channelSelectorLabel = (
  selector: ChannelSelector,
  fallback: string,
): string =>
  selector === 'combined'
    ? fallback
    : (CHANNELS.find((c) => c.key === selector)?.label ?? selector)

/** 캠페인 시트 하나를 쓴다 — channelSelector가 'combined'면 기존 "캠페인"
 * 시트(채널 합산: c.combined), 그 외(meta/google/naver)면 그 채널 데이터만
 * (c.meta/c.google/c.naver)으로 완전히 같은 표 구성을 다시 만든다. 채널별
 * 시트는 호출부가 이미 그 채널 데이터가 있는 캠페인만 추려서 넘긴다. */
function writeCampaignSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  campaigns: readonly ExportCampaign[],
  channelSelector: ChannelSelector,
  fields: readonly MetricField[],
  dateStart: string,
  dateEnd: string,
  bucketSize: number | null,
) {
  const ws = wb.addWorksheet(sheetName)
  // summaryBelow: true → 캠페인마다 아래에서 묶는(outlineLevel) 행 그룹의
  // 접기/펼치기(+/-) 컨트롤이 그 캠페인 블록 바로 아래(구분선 자리)에 뜬다.
  ws.properties.outlineProperties = {
    summaryBelow: true,
    summaryRight: false,
  }
  setColumnWidths(ws, 3 + fields.length)

  const seriesOf = (c: ExportCampaign) => c[channelSelector]

  let row = 1
  row = writeTable(
    ws,
    row,
    '캠페인 합계 요약',
    ['Campaign', 'Channel', '전환 목표', ...metricHeaders(fields)],
    campaigns.map((c) => [
      c.campaignName,
      channelSelectorLabel(channelSelector, c.channelLabel),
      c.resultType ?? '',
      ...metricValues(aggregateMetrics(seriesOf(c).byDate), fields),
    ]),
    fields,
    false,
    true,
  )
  row = writeTable(
    ws,
    row,
    '캠페인별 월간 성과',
    ['Campaign', '월', ...metricHeaders(fields)],
    campaigns.flatMap((c) =>
      groupByMonth(seriesOf(c).byDate).map((w) => [
        c.campaignName,
        w.period,
        ...metricValues(w, fields),
      ]),
    ),
    fields,
    true,
    true,
  )
  row = writeTable(
    ws,
    row,
    '캠페인별 주차별 성과',
    ['Campaign', '기간', ...metricHeaders(fields)],
    campaigns.flatMap((c) =>
      seriesOf(c).byGroupedWeek.map((w) => [
        c.campaignName,
        w.period,
        ...metricValues(w, fields),
      ]),
    ),
    fields,
    true,
    true,
  )
  row = writeTable(
    ws,
    row,
    '캠페인별 일별 성과',
    ['Campaign', '날짜', ...metricHeaders(fields)],
    campaigns.flatMap((c) =>
      seriesOf(c).byDate.map((d) => [
        c.campaignName,
        d.date,
        ...metricValues(d, fields),
      ]),
    ),
    fields,
    true,
    true,
  )
  row = writeTable(
    ws,
    row,
    periodTitle('캠페인별 이전 일정 vs 지정 일정 비교분석', bucketSize),
    ['Campaign', '기간', ...metricHeaders(fields)],
    campaigns.flatMap((c) =>
      (bucketSize
        ? groupByCustomPeriod(seriesOf(c).byDate, dateStart, dateEnd, bucketSize)
        : []
      ).map((w) => [c.campaignName, w.period, ...metricValues(w, fields)]),
    ),
    fields,
    true,
    true,
  )
  // 요일별은 "기간을 점점 좁혀가며 보기" 흐름과 다른 축이라 따로 맨 뒤에 둔다.
  row = writeTable(
    ws,
    row,
    '캠페인별 요일별 성과',
    ['Campaign', '요일', ...metricHeaders(fields)],
    campaigns.flatMap((c) =>
      seriesOf(c).byDayOfWeek.map((d) => [
        c.campaignName,
        d.dayOfWeek,
        ...metricValues(d, fields),
      ]),
    ),
    fields,
    true,
    true,
  )

  // 추가 — 여기까지의 "캠페인별 OO 성과" 표는 여러 캠페인의 행을 한 표에
  // 모아서(Campaign 칸에 같은 이름이 쭉 반복) 보여주는 방식이라, 캠페인 하나를
  // 통째로 놓고 보기엔 불편하다. 그래서 캠페인마다 자기 표 블록(월간→주차별→
  // 일별→지정기간→요일별)을 따로 하나씩 더 만든다 — 캠페인 수만큼 표가
  // 늘어나지만, 캠페인 단위로 훑어보기엔 이쪽이 낫다.
  const campaignColumnCount = 3 + fields.length
  for (const c of campaigns) {
    row = writeEntityHeading(ws, row, `■ ${c.campaignName}`, campaignColumnCount)
    const blockStart = row
    const s = seriesOf(c)
    row = writeTable(
      ws,
      row,
      `[${c.campaignName}] 월간 성과`,
      ['월', ...metricHeaders(fields)],
      groupByMonth(s.byDate).map((w) => [w.period, ...metricValues(w, fields)]),
      fields,
    )
    row = writeTable(
      ws,
      row,
      `[${c.campaignName}] 주차별 성과`,
      ['기간', ...metricHeaders(fields)],
      s.byGroupedWeek.map((w) => [w.period, ...metricValues(w, fields)]),
      fields,
    )
    row = writeTable(
      ws,
      row,
      `[${c.campaignName}] 일별 성과`,
      ['날짜', ...metricHeaders(fields)],
      s.byDate.map((d) => [d.date, ...metricValues(d, fields)]),
      fields,
    )
    row = writeTable(
      ws,
      row,
      periodTitle(
        `[${c.campaignName}] 이전 일정 vs 지정 일정 비교분석`,
        bucketSize,
      ),
      ['기간', ...metricHeaders(fields)],
      (bucketSize
        ? groupByCustomPeriod(s.byDate, dateStart, dateEnd, bucketSize)
        : []
      ).map((w) => [w.period, ...metricValues(w, fields)]),
      fields,
    )
    row = writeTable(
      ws,
      row,
      `[${c.campaignName}] 요일별 성과`,
      ['요일', ...metricHeaders(fields)],
      s.byDayOfWeek.map((d) => [d.dayOfWeek, ...metricValues(d, fields)]),
      fields,
    )

    // 대제목 아래 5개 표(월간~요일별) 전체를 한 그룹(outlineLevel 1)으로
    // 묶어서, 엑셀에서 그 캠페인 몫만 통째로 접었다 펼 수 있게 한다 — 5개
    // 표를 각각 따로 접는 게 아니라 하나의 컨트롤로 한 번에. row가 이미
    // 다음 표 시작 위치(마지막 행 + 2)로 넘어가 있으니 실제 마지막 행은
    // row - 2. hidden = false는 기본 펼침 상태를 명시적으로 고정한다(접힌
    // 채로 저장되는 일이 없도록).
    //
    // height도 같이 명시하는 이유 — ExcelJS의 Row.model()은 "셀이 하나도
    // 없고 height도 없는" 행이면 그 행 자체를 통째로 null(=존재하지 않는
    // 행)로 취급해 저장한다. 표 사이에 남겨둔 빈 줄(어떤 셀도 안 건드린
    // 진짜 빈 행)이 정확히 이 케이스라, outlineLevel을 줘도 저장 시점에
    // 같이 버려져서 그 지점에서 그룹이 끊기고 — 그 결과 5개 표가 각각 따로
    // 접히는 것처럼 보였다. height를 주면 그 행도 "존재하는 행"이 되어
    // outlineLevel이 온전히 저장되고, 표들 사이 끊김 없이 하나의 그룹으로
    // 이어진다.
    const blockEnd = row - 2
    for (let r = blockStart; r <= blockEnd; r++) {
      const gr = ws.getRow(r)
      gr.outlineLevel = 1
      gr.hidden = false
      if (!gr.height) gr.height = 15
    }

    // 캠페인 사이 구분선 — summaryBelow 설정상 이 자리가 접기 컨트롤의 앵커도
    // 겸하므로, 마지막 캠페인 뒤에도(그 블록의 접기 컨트롤이 뜨려면 필요) 그린다.
    row = writeDivider(ws, row, campaignColumnCount)
  }
}

/** 애드셋 시트 하나를 쓴다 — writeCampaignSheet와 같은 방식. adsets는 호출부가
 * (channelSelector가 'combined'가 아니면) 이미 그 채널 데이터가 있는
 * 애드셋만 추려서 넘긴다. */
function writeAdsetSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  adsets: readonly (CombinedAdset & { channelLabel: string })[],
  channelSelector: ChannelSelector,
  fields: readonly MetricField[],
  dateStart: string,
  dateEnd: string,
  bucketSize: number | null,
) {
  const ws = wb.addWorksheet(sheetName)
  ws.properties.outlineProperties = {
    summaryBelow: true,
    summaryRight: false,
  }
  setColumnWidths(ws, 2 + fields.length)

  const seriesOf = (a: CombinedAdset) => a[channelSelector]

  let row = 1
  row = writeTable(
    ws,
    row,
    '애드셋 합계 요약',
    ['Adset', 'Channel', ...metricHeaders(fields)],
    adsets.map((a) => [
      a.adsetName,
      channelSelectorLabel(channelSelector, a.channelLabel),
      ...metricValues(aggregateMetrics(seriesOf(a).byDate), fields),
    ]),
    fields,
    false,
    true,
  )
  row = writeTable(
    ws,
    row,
    '애드셋별 월간 성과',
    ['Adset', '월', ...metricHeaders(fields)],
    adsets.flatMap((a) =>
      groupByMonth(seriesOf(a).byDate).map((w) => [
        a.adsetName,
        w.period,
        ...metricValues(w, fields),
      ]),
    ),
    fields,
    true,
    true,
  )
  row = writeTable(
    ws,
    row,
    '애드셋별 주차별 성과',
    ['Adset', '기간', ...metricHeaders(fields)],
    adsets.flatMap((a) =>
      seriesOf(a).byGroupedWeek.map((w) => [
        a.adsetName,
        w.period,
        ...metricValues(w, fields),
      ]),
    ),
    fields,
    true,
    true,
  )
  row = writeTable(
    ws,
    row,
    '애드셋별 일별 성과',
    ['Adset', '날짜', ...metricHeaders(fields)],
    adsets.flatMap((a) =>
      seriesOf(a).byDate.map((d) => [
        a.adsetName,
        d.date,
        ...metricValues(d, fields),
      ]),
    ),
    fields,
    true,
    true,
  )
  row = writeTable(
    ws,
    row,
    periodTitle('애드셋별 이전 일정 vs 지정 일정 비교분석', bucketSize),
    ['Adset', '기간', ...metricHeaders(fields)],
    adsets.flatMap((a) =>
      (bucketSize
        ? groupByCustomPeriod(seriesOf(a).byDate, dateStart, dateEnd, bucketSize)
        : []
      ).map((w) => [a.adsetName, w.period, ...metricValues(w, fields)]),
    ),
    fields,
    true,
    true,
  )
  // 요일별은 "기간을 점점 좁혀가며 보기" 흐름과 다른 축이라 따로 맨 뒤에 둔다.
  row = writeTable(
    ws,
    row,
    '애드셋별 요일별 성과',
    ['Adset', '요일', ...metricHeaders(fields)],
    adsets.flatMap((a) =>
      seriesOf(a).byDayOfWeek.map((d) => [
        a.adsetName,
        d.dayOfWeek,
        ...metricValues(d, fields),
      ]),
    ),
    fields,
    true,
    true,
  )

  // 추가 — writeCampaignSheet와 같은 이유(맨 위 주석 참고): 애드셋마다 자기
  // 표 블록을 따로 하나씩 더 만든다.
  const adsetColumnCount = 2 + fields.length
  for (const a of adsets) {
    row = writeEntityHeading(ws, row, `■ ${a.adsetName}`, adsetColumnCount)
    const blockStart = row
    const s = seriesOf(a)
    row = writeTable(
      ws,
      row,
      `[${a.adsetName}] 월간 성과`,
      ['월', ...metricHeaders(fields)],
      groupByMonth(s.byDate).map((w) => [w.period, ...metricValues(w, fields)]),
      fields,
    )
    row = writeTable(
      ws,
      row,
      `[${a.adsetName}] 주차별 성과`,
      ['기간', ...metricHeaders(fields)],
      s.byGroupedWeek.map((w) => [w.period, ...metricValues(w, fields)]),
      fields,
    )
    row = writeTable(
      ws,
      row,
      `[${a.adsetName}] 일별 성과`,
      ['날짜', ...metricHeaders(fields)],
      s.byDate.map((d) => [d.date, ...metricValues(d, fields)]),
      fields,
    )
    row = writeTable(
      ws,
      row,
      periodTitle(
        `[${a.adsetName}] 이전 일정 vs 지정 일정 비교분석`,
        bucketSize,
      ),
      ['기간', ...metricHeaders(fields)],
      (bucketSize
        ? groupByCustomPeriod(s.byDate, dateStart, dateEnd, bucketSize)
        : []
      ).map((w) => [w.period, ...metricValues(w, fields)]),
      fields,
    )
    row = writeTable(
      ws,
      row,
      `[${a.adsetName}] 요일별 성과`,
      ['요일', ...metricHeaders(fields)],
      s.byDayOfWeek.map((d) => [d.dayOfWeek, ...metricValues(d, fields)]),
      fields,
    )

    // 이 애드셋 블록 행 전체를 한 그룹(outlineLevel 1)으로 묶는다 — 이유(및
    // height를 같이 주는 이유)는 writeCampaignSheet의 같은 자리 주석 참고.
    const blockEnd = row - 2
    for (let r = blockStart; r <= blockEnd; r++) {
      const gr = ws.getRow(r)
      gr.outlineLevel = 1
      gr.hidden = false
      if (!gr.height) gr.height = 15
    }

    // 애드셋 사이 구분선 — summaryBelow 설정상 접기 컨트롤의 앵커도 겸하므로
    // 마지막 애드셋 뒤에도 그린다.
    row = writeDivider(ws, row, adsetColumnCount)
  }
}

interface ExcelExportModalProps {
  onClose: () => void
  dateStart: string
  dateEnd: string
  total: {
    combined: MetricsSummary
    meta: MetricsSummary
    google: MetricsSummary
    naver: MetricsSummary
  }
  series: ChannelSplitSeries
  campaigns: readonly ExportCampaign[]
}

/** "엑셀 다운로드" 버튼에서 여는 모달 — 전체요약/캠페인/애드셋 중 시트로
 * 내보낼 것(복수 선택)과, 각 시트에 실을 지표(복수 선택, 기본 전체)를 고르면
 * 하나의 .xlsx 파일에 고른 시트를 모두 담아 내려받는다. 전체요약 시트는 맨 위에
 * 요약(채널별 총계) 표를 두고, 월간/주간/일간/이전-지정 일정 비교분석/요일별
 * 마다 combined 표 + 채널별(Meta/Google/Naver 중 데이터 있는 것만) 표를 이어
 * 쌓는다. 캠페인·애드셋 시트는 그 단위별로 같은 시간 축 표들을 쌓는다. 시간
 * 축 표(요약류 제외)는 맨 밑에 지표별 평균 행이 같이 붙는다. */
export function ExcelExportModal({
  onClose,
  dateStart,
  dateEnd,
  total,
  series,
  campaigns,
}: ExcelExportModalProps) {
  const [sheets, setSheets] = useState<ReadonlySet<SheetKey>>(
    () => new Set(SHEET_OPTIONS.map((s) => s.key)),
  )
  const [metricKeys, setMetricKeys] = useState<ReadonlySet<MetricKey>>(
    () => new Set(METRIC_FIELDS.map((f) => f.key)),
  )
  // "이전 일정 vs 지정 일정" 표의 구간 일수 — 모든 시트가 공유한다. null이면
  // (입력칸을 지우는 중) 그 표는 헤더만 있고 빈 채로 나간다.
  const [bucketSize, setBucketSize] = useState<number | null>(7)
  const [isExporting, setIsExporting] = useState(false)

  const toggleSheet = (key: SheetKey) => {
    setSheets((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleMetric = (key: MetricKey) => {
    setMetricKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedFields = METRIC_FIELDS.filter((f) => metricKeys.has(f.key))
  const canExport = sheets.size > 0 && selectedFields.length > 0

  const handleExport = async () => {
    if (!canExport || isExporting) return
    setIsExporting(true)

    try {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Originals CMIP'
      wb.created = new Date()

      // 어떤 시트가 실제로 만들어질지 먼저 정한다(체크 여부 + 데이터 있는
      // 채널만) — 이 계획대로 아래서 실제 시트를 만든다.
      type PlannedSheet =
        | { kind: 'total' }
        | {
            kind: 'campaign'
            name: string
            selector: ChannelSelector
            data: readonly ExportCampaign[]
          }
        | {
            kind: 'adset'
            name: string
            selector: ChannelSelector
            data: readonly (CombinedAdset & { channelLabel: string })[]
          }

      const planned: PlannedSheet[] = []

      if (sheets.has('total')) {
        planned.push({ kind: 'total' })
      }
      if (sheets.has('campaign')) {
        planned.push({
          kind: 'campaign',
          name: '캠페인',
          selector: 'combined',
          data: campaigns,
        })
        // 매체별 캠페인 시트 — 그 채널 데이터가 있는 캠페인이 하나도 없으면
        // (예: Naver 캠페인을 한 번도 안 돌린 계정) 빈 시트를 만들지 않는다.
        for (const c of CHANNELS) {
          const channelCampaigns = campaigns.filter(
            (campaign) => campaign[c.key].byDate.length > 0,
          )
          if (channelCampaigns.length === 0) continue
          planned.push({
            kind: 'campaign',
            name: `캠페인-${c.label}`,
            selector: c.key,
            data: channelCampaigns,
          })
        }
      }
      if (sheets.has('adset')) {
        const allAdsets = campaigns.flatMap((c) => c.adsets)
        planned.push({
          kind: 'adset',
          name: '애드셋',
          selector: 'combined',
          data: allAdsets,
        })
        // 매체별 애드셋 시트 — 캠페인과 같은 이유로, 데이터 있는 것만.
        for (const c of CHANNELS) {
          const channelAdsets = allAdsets.filter(
            (adset) => adset[c.key].byDate.length > 0,
          )
          if (channelAdsets.length === 0) continue
          planned.push({
            kind: 'adset',
            name: `애드셋-${c.label}`,
            selector: c.key,
            data: channelAdsets,
          })
        }
      }

      for (const p of planned) {
        if (p.kind === 'total') {
          writeTotalSheet(
            wb,
            total,
            series,
            selectedFields,
            dateStart,
            dateEnd,
            bucketSize,
          )
        } else if (p.kind === 'campaign') {
          writeCampaignSheet(
            wb,
            p.name,
            p.data,
            p.selector,
            selectedFields,
            dateStart,
            dateEnd,
            bucketSize,
          )
        } else {
          writeAdsetSheet(
            wb,
            p.name,
            p.data,
            p.selector,
            selectedFields,
            dateStart,
            dateEnd,
            bucketSize,
          )
        }
      }

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cmip_${dateStart}_${dateEnd}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      onClose()
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="excel-export-modal" onClick={onClose}>
      <div
        className="excel-export-modal__panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="excel-export-modal__header">
          <h3 className="excel-export-modal__title">엑셀 다운로드</h3>
          <button
            type="button"
            className="excel-export-modal__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        <div className="excel-export-modal__body">
          <section className="excel-export-modal__section">
            <div className="excel-export-modal__section-title">시트 선택</div>
            <p className="excel-export-modal__desc">
              시트마다 전체요약(총계) · 월간 · 주간 · 일간 · 이전 일정 vs 지정
              일정 비교분석 · 요일별 표를 이 순서로 담습니다(캠페인·애드셋은
              그 단위별로 나눠서). 요약류를 제외한 표는 맨 밑에 지표별 평균
              행이 같이 붙습니다. 캠페인·애드셋은 채널 합산 시트 외에
              "캠페인-Meta"처럼 매체별 시트도 데이터가 있는 채널만 골라
              추가로 담습니다. 캠페인·애드셋마다 표 블록을 접었다 펼 수
              있습니다.
            </p>
            <div
              className="excel-export-modal__chip-row"
              role="group"
              aria-label="시트 선택"
            >
              {SHEET_OPTIONS.map((s) => {
                const active = sheets.has(s.key)
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`excel-export-modal__chip${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => toggleSheet(s.key)}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="excel-export-modal__section">
            <div className="excel-export-modal__section-title">지표 선택</div>
            <div
              className="excel-export-modal__chip-row"
              role="group"
              aria-label="지표 선택"
            >
              {METRIC_FIELDS.map((f) => {
                const active = metricKeys.has(f.key)
                return (
                  <button
                    key={f.key}
                    type="button"
                    className={`excel-export-modal__chip${active ? ' is-active' : ''}`}
                    style={{ '--chip-color': f.color } as CSSProperties}
                    aria-pressed={active}
                    onClick={() => toggleMetric(f.key)}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="excel-export-modal__section">
            <div className="excel-export-modal__section-title">
              이전 일정 vs 지정 일정 구간 일수
            </div>
            <label className="excel-export-modal__period-size">
              <input
                type="number"
                min={1}
                step={1}
                value={bucketSize ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    setBucketSize(null)
                    return
                  }
                  const parsed = Math.trunc(Number(raw))
                  setBucketSize(
                    Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                  )
                }}
              />
              일 단위 (최신일 기준으로 거꾸로 묶고, 나머지는 버림)
            </label>
          </section>

          {!canExport && (
            <p className="excel-export-modal__hint">
              시트와 지표를 각각 하나 이상 골라주세요.
            </p>
          )}
        </div>

        <footer className="excel-export-modal__footer">
          <button
            type="button"
            className="excel-export-modal__btn excel-export-modal__ghost"
            onClick={onClose}
            disabled={isExporting}
          >
            취소
          </button>
          <button
            type="button"
            className="excel-export-modal__btn excel-export-modal__primary"
            onClick={handleExport}
            disabled={!canExport || isExporting}
          >
            {isExporting ? '생성하는 중…' : '다운로드'}
          </button>
        </footer>
      </div>
    </div>
  )
}
