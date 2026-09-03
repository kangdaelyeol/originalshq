/**
 * cmip 샘플 매체 CSV 생성기.
 *
 *   node sample-data/cmip/generate.mjs
 *
 * 2026-08-04 ~ 2026-09-02 (30일) 일별 데이터를 매체별로 1파일씩 생성한다.
 * 숫자는 시드 고정(재현 가능) + 요일 효과 + 완만한 우상향 추세로 만든다.
 * 헤더는 각 매체 실제 리포트 컬럼명을 따라 자동 감지(detectChannel)에 걸리도록 맞췄다.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = dirname(fileURLToPath(import.meta.url))

const START = Date.UTC(2026, 7, 4) // 2026-08-04 (월)
const DAYS = 30 // ~ 2026-09-02 (화)

const iso = (ms) => new Date(ms).toISOString().slice(0, 10)
const addDays = (ms, n) => ms + n * 86400000
const round = (n) => Math.round(n)

/** mulberry32 — 결정적 PRNG */
function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 매체별 일자 지표 산출.
 * base: 일 평균 노출, ctr/cpc/cvr/aov: 파생 비율, trend: 기간말 증가율,
 * weekend: 주말 배수, jitter: 일자 노이즈 폭.
 */
function buildRows(cfg) {
  const r = makeRng(cfg.seed)
  const out = []
  for (let i = 0; i < DAYS; i++) {
    const dayMs = addDays(START, i)
    const dow = new Date(dayMs).getUTCDay() // 0=일 … 6=토
    const isWeekend = dow === 0 || dow === 6
    const growth = 1 + cfg.trend * (i / (DAYS - 1))
    const weekend = isWeekend ? cfg.weekend : 1
    const noise = (amp) => 1 + (r() - 0.5) * 2 * amp

    const imp = Math.max(1, round(cfg.base * growth * weekend * noise(cfg.jitter)))
    const clk = Math.max(1, round(imp * cfg.ctr * noise(0.15)))
    const cost = round(clk * cfg.cpc * noise(0.1))
    const conv = Math.max(0, round(clk * cfg.cvr * noise(0.35)))
    const rev = round(conv * cfg.aov * noise(0.2))

    out.push({ date: iso(dayMs), imp, clk, cost, conv, rev })
  }
  return out
}

const CHANNELS = [
  {
    file: 'meta_2026-08-04_2026-09-02.csv',
    header:
      '보고 시작,캠페인 이름,광고 세트 이름,노출,링크 클릭,지출 금액,결과,결과 유형,구매 전환값',
    seed: 101,
    base: 14000,
    ctr: 0.021,
    cpc: 360,
    cvr: 0.035,
    aov: 46000,
    trend: 0.28,
    weekend: 0.8,
    jitter: 0.12,
    line: (m) =>
      `${m.date},여름_프로스펙팅,AS_LAL10_광고세트,${m.imp},${m.clk},${m.cost},${m.conv},구매,${m.rev}`,
  },
  {
    file: 'naver_2026-08-04_2026-09-02.csv',
    header: '일별,캠페인,광고그룹,키워드,노출수,클릭수,총비용,전환수,전환매출액(원)',
    seed: 202,
    base: 4200,
    ctr: 0.055,
    cpc: 330,
    cvr: 0.05,
    aov: 52000,
    trend: 0.15,
    weekend: 0.7,
    jitter: 0.1,
    line: (m) =>
      `${m.date},브랜드_파워링크,AG_브랜드_핵심,브랜드명,${m.imp},${m.clk},${m.cost},${m.conv},${m.rev}`,
  },
  {
    file: 'google_2026-08-04_2026-09-02.csv',
    header: '날짜,캠페인,캠페인 상태,노출수,클릭수,비용,전환수,전환 가치',
    seed: 303,
    base: 10000,
    ctr: 0.026,
    cpc: 350,
    cvr: 0.038,
    aov: 48000,
    trend: 0.2,
    weekend: 0.85,
    jitter: 0.13,
    line: (m) =>
      `${m.date},퍼포먼스_검색,사용 설정됨,${m.imp},${m.clk},${m.cost},${m.conv},${m.rev}`,
  },
  {
    file: 'daangn_2026-08-04_2026-09-02.csv',
    header: '기간,캠페인 ID,캠페인,노출,클릭,비용 (VAT 포함),전환수,전환매출액',
    seed: 404,
    base: 20000,
    ctr: 0.02,
    cpc: 120,
    cvr: 0.012,
    aov: 39000,
    trend: 0.1,
    weekend: 1.05,
    jitter: 0.15,
    line: (m) =>
      `${m.date},CMP-1001,지역_타겟_인지,${m.imp},${m.clk},${m.cost},${m.conv},${m.rev}`,
  },
]

for (const cfg of CHANNELS) {
  const rows = buildRows(cfg)
  const csv = [cfg.header, ...rows.map(cfg.line)].join('\n') + '\n'
  const path = join(OUT_DIR, cfg.file)
  writeFileSync(path, csv, 'utf8')
  const spend = rows.reduce((s, m) => s + m.cost, 0)
  const conv = rows.reduce((s, m) => s + m.conv, 0)
  console.log(
    `${cfg.file.padEnd(36)} rows=${rows.length}  spend=₩${spend.toLocaleString('en-US')}  conv=${conv}`,
  )
}
