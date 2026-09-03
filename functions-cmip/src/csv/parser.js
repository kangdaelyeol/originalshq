/**
 * 매체 리포트 CSV 파서 — Python `src/core/csv_importer.py`의 파싱 계층 이관.
 * (적재 계층 `import_rows_batch`/`existing_conflict_keys` 는 Firestore 버전으로
 *  `src/data/importer.js` 에 별도 구현.)
 *
 * 설계 원칙 (2026-07 API 포기 → CSV 전환 이후 확정):
 *   - 매체에서 "열을 빼지 말고 풀 스키마로" 내려받으면 필요한 열만 자동 추출.
 *   - 인코딩·구분자·헤더 위치·매체 종류를 모두 자동 감지.
 *   - 데이터는 실시간이 아니라 과거 날짜 CSV를 나중에 올리는 방식.
 */
import { parse as parseCsv } from 'csv-parse/sync';

import { NAVER_OTHER_MEDIA_LABEL } from '../lib/channels.js';
import { parseDate, dateRange, todayISO } from '../lib/dates.js';
import {
	ALIASES,
	SUMMARY_RE,
	HEADER_KEYWORDS,
	FILENAME_HINTS,
	FN_RANGE_RE,
	TXT_RANGE_RE,
} from './aliases.js';
import { readText } from './encoding.js';

// --------------------------------------------------------------------------- //
// 값 정제
// --------------------------------------------------------------------------- //
function cleanNum(v) {
	if (v == null) return '';
	let s = String(v).trim().replace(/₩/g, '').replace(/\$/g, '');
	s = s.replace(/,/g, '').replace(/ /g, '');
	if (['-', '--', '—', '?'].includes(s)) return '';
	return s;
}

function toInt(v) {
	const s = cleanNum(v);
	if (!s) return 0;
	const n = Number(s);
	return Number.isFinite(n) ? Math.round(n) : 0;
}

function toFloat(v) {
	const s = cleanNum(v);
	if (!s) return 0;
	const n = Number(s);
	return Number.isFinite(n) ? n : 0;
}

function isSummaryLabel(s) {
	const t = (s || '').trim().toLowerCase();
	if (!t) return false;
	return (
		SUMMARY_RE.test(t) ||
		['전체', '전체 캠페인', '전체광고세트', '전체 광고세트'].includes(t)
	);
}

/** 네이버 리포트의 '총비용(VAT포함,원)'처럼 필드 안 콤마로 쪼개진 헤더를 다시 붙인다. */
function repairHeader(cells) {
	const out = [];
	let i = 0;
	while (i < cells.length) {
		let c = String(cells[i]).trim();
		while (count(c, '(') > count(c, ')') && i + 1 < cells.length) {
			i += 1;
			c = c + ',' + String(cells[i]).trim();
		}
		out.push(c);
		i += 1;
	}
	return out;
}

function count(str, ch) {
	let n = 0;
	for (const c of str) if (c === ch) n += 1;
	return n;
}

// --------------------------------------------------------------------------- //
// 구분자 / 헤더
// --------------------------------------------------------------------------- //
function detectDelimiter(txt) {
	const lines = txt
		.split('\n')
		.filter((ln) => ln.trim())
		.slice(0, 15);
	let best = ',';
	let bestScore = -1;
	for (const d of ['\t', ',', ';', '|']) {
		const score = lines.reduce((acc, ln) => acc + count(ln, d), 0);
		if (score > bestScore) {
			best = d;
			bestScore = score;
		}
	}
	return best;
}

function findHeaderIdx(rows) {
	for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
		const joined = rows[i].map((c) => String(c).toLowerCase()).join(' ');
		const hits = HEADER_KEYWORDS.filter((k) => joined.includes(k)).length;
		if (hits >= 3) return i;
	}
	return 0;
}

/** 헤더 → 표준 필드명 인덱스. '정확 일치 우선, 없으면 부분 포함'. -1 = 없음. */
function indexMap(header) {
	const norm = header.map((h) => String(h).trim().toLowerCase());
	const idx = {};
	for (const [fieldName, names] of Object.entries(ALIASES)) {
		let found = -1;
		for (const alias of names) {
			const a = alias.toLowerCase();
			const i = norm.indexOf(a);
			if (i >= 0) {
				found = i;
				break;
			}
		}
		if (found < 0) {
			for (const alias of names) {
				const a = alias.toLowerCase();
				const i = norm.findIndex((h) => h.includes(a));
				if (i >= 0) {
					found = i;
					break;
				}
			}
		}
		idx[fieldName] = found;
	}
	return idx;
}

// --------------------------------------------------------------------------- //
// 매체 감지
// --------------------------------------------------------------------------- //
function guessChannelFromName(name) {
	const low = name.toLowerCase();
	for (const [ch, keys] of FILENAME_HINTS) {
		if (keys.some((k) => low.includes(k))) return ch;
	}
	return null;
}

function detectChannel(header, filename) {
	const hdr = header.map((h) => String(h).toLowerCase()).join(' ');

	// 네이버 계정 집계형(애드부스트/GFA/쇼핑부스트업) — 계정명 + 총비용, 캠페인/광고그룹 없음
	if (
		hdr.includes('광고 계정 이름') &&
		(hdr.includes('총비용') || hdr.includes('총 비용'))
	) {
		return 'naver_other';
	}
	if (
		hdr.includes('일별') &&
		(hdr.includes('총비용') || hdr.includes('평균클릭비용'))
	) {
		return 'naver';
	}
	if (
		[
			'디맨드젠',
			'demand gen',
			'캠페인 상태',
			'입찰 전략',
			'최적화 점수',
			'상호작용수',
			'pmax',
			'p-max',
		].some((k) => hdr.includes(k))
	) {
		return 'google';
	}
	if (
		(hdr.includes('광고 세트') || hdr.includes('광고세트')) &&
		(hdr.includes('지출 금액') || hdr.includes('링크 클릭'))
	) {
		return 'meta';
	}
	if (hdr.includes('결과 유형') || hdr.includes('결과유형')) return 'meta';
	if (
		hdr.includes('기간') &&
		(hdr.includes('캠페인 id') ||
			hdr.includes('비용 (vat 포함)') ||
			hdr.includes('비용(vat 포함)'))
	) {
		return 'daangn';
	}

	return guessChannelFromName(filename) || 'generic';
}

// --------------------------------------------------------------------------- //
// 기간 추출 (날짜 컬럼 없는 집계형)
// --------------------------------------------------------------------------- //
function rangeFromFilename(name) {
	const m = FN_RANGE_RE.exec(name);
	if (!m) return null;
	const s = parseDate(m[1]);
	const e = parseDate(m[2]);
	return s && e ? [s, e] : null;
}

function rangeFromText(txt) {
	const m = TXT_RANGE_RE.exec(txt);
	if (!m) return null;
	const s = parseDate(`${m[1]}-${m[2]}-${m[3]}`);
	const e = parseDate(`${m[4]}-${m[5]}-${m[6]}`);
	return s && e ? [s, e] : null;
}

// --------------------------------------------------------------------------- //
// 결과 컨테이너
// --------------------------------------------------------------------------- //
export class ParseResult {
	constructor(channel, sourceName = '') {
		this.channel = channel;
		/** @type {object[]} */
		this.rows = [];
		/** @type {string[]} */
		this.warnings = [];
		this.sourceName = sourceName;
		this.detectedFormat = 'per-row';
	}

	get ok() {
		return this.rows.length > 0;
	}

	/** @returns {[string|null, string|null]} */
	get dateRange() {
		const ds = this.rows
			.map((r) => r.date)
			.filter(Boolean)
			.sort();
		return ds.length ? [ds[0], ds[ds.length - 1]] : [null, null];
	}
}

function blankRow(channel, d) {
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
	};
}

// --------------------------------------------------------------------------- //
// 진입점
// --------------------------------------------------------------------------- //
/**
 * @param {Buffer|Uint8Array} buffer  파일 바이트
 * @param {string} name  파일명 (매체/기간 힌트)
 * @param {string|null} channelHint
 * @returns {ParseResult}
 */
export function parseBuffer(buffer, name, channelHint = null) {
	return parseText(readText(buffer), name, channelHint);
}

/**
 * @param {string} txt  이미 디코딩된 텍스트
 * @param {string} name
 * @param {string|null} channelHint
 * @returns {ParseResult}
 */
export function parseText(txt, name, channelHint = null) {
	const delim = detectDelimiter(txt);
	let allRows = parseCsv(txt, {
		delimiter: delim,
		relax_column_count: true,
		relax_quotes: true,
		skip_empty_lines: false,
		trim: false,
	});
	allRows = allRows.filter((r) => r.some((c) => String(c).trim()));

	if (allRows.length < 2) {
		const res = new ParseResult(channelHint || 'generic', name);
		res.warnings.push('빈 파일이거나 데이터 행이 없습니다.');
		return res;
	}

	const hIdx = findHeaderIdx(allRows);
	const header = repairHeader(allRows[hIdx].map((c) => String(c).trim()));
	const body = allRows.slice(hIdx + 1);
	const idx = indexMap(header);

	const channel = channelHint || detectChannel(header, name);
	const res = new ParseResult(
		channel === 'naver_other' ? 'naver' : channel,
		name,
	);

	const hasDateCol =
		idx.date >= 0 &&
		body
			.slice(0, 50)
			.some((r) => r.length > idx.date && parseDate(r[idx.date]));

	// (A) 네이버 기타매체 계정 집계형 (날짜 없음)
	if (channel === 'naver_other' && !hasDateCol) {
		return parseNaverOtherSummary(body, idx, name, txt, res);
	}
	// (B) 날짜 컬럼 없는 기간 집계형 (구글/네이버 등)
	if (!hasDateCol) {
		return parsePeriodAggregate(body, idx, name, txt, res);
	}
	// (C) 일반 per-row
	return parsePerRow(body, idx, res);
}

function campaignFor(idx, row, channel) {
	const ci = idx.campaign;
	const raw = ci >= 0 && ci < row.length ? String(row[ci]).trim() : '';
	if (
		channel === 'naver' &&
		(raw.toLowerCase().includes('naver') || raw.includes(':') || raw === '')
	) {
		return NAVER_OTHER_MEDIA_LABEL;
	}
	return raw || '(캠페인)';
}

function cell(row, i) {
	return i >= 0 && i < row.length ? row[i] : undefined;
}

function parsePerRow(body, idx, res) {
	for (const row of body) {
		if (!row || row.length === 0) continue;
		// B열 '전체' 공통 필터
		if (row.length > 1 && String(row[1]).includes('전체')) continue;

		const d =
			idx.date >= 0 && row.length > idx.date ? parseDate(row[idx.date]) : null;
		if (!d) continue;

		const rawCamp =
			idx.campaign >= 0 && idx.campaign < row.length
				? String(row[idx.campaign]).trim()
				: '';
		const rawAdg =
			idx.adgroup >= 0 && idx.adgroup < row.length
				? String(row[idx.adgroup]).trim()
				: '';
		// 캠페인/광고세트가 모두 빈 행 = 매체 전체 합계 행(메타 CSV) → 중복 집계 방지
		if (!rawCamp && !rawAdg) continue;

		const campaign = campaignFor(idx, row, res.channel);
		const adgroup = rawAdg;
		if (isSummaryLabel(campaign) || isSummaryLabel(adgroup)) continue;

		const imp = toInt(cell(row, idx.impressions));
		const clk = toInt(cell(row, idx.clicks));
		const cost = toFloat(cell(row, idx.cost));
		if (!(imp || clk || cost)) continue;

		let rt = null;
		if (idx.result_type >= 0 && row.length > idx.result_type) {
			rt = String(row[idx.result_type]).trim() || null;
		}

		const r = blankRow(res.channel, d);
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
		});
		res.rows.push(r);
	}

	if (res.rows.length === 0) {
		res.warnings.push(
			'파싱된 유효 행이 없습니다. 헤더/날짜 형식을 확인하세요.',
		);
	}
	if (idx.revenue < 0) {
		res.warnings.push(
			'매출(전환매출액/리드수익) 컬럼을 찾지 못했습니다 — ROAS는 계산되지 않습니다.',
		);
	}
	return res;
}

/** 날짜 없는 집계형: 캠페인별 합계. */
function aggregateBody(body, idx) {
	const agg = {};
	for (const row of body) {
		if (!row || row.length === 0) continue;
		if (row.length > 1 && String(row[1]).includes('전체')) continue;

		const ci = idx.campaign;
		const camp =
			ci >= 0 && ci < row.length ? String(row[ci]).trim() : '(캠페인)';
		if (isSummaryLabel(camp)) continue;

		const imp = toInt(cell(row, idx.impressions));
		const clk = toInt(cell(row, idx.clicks));
		const cost = toFloat(cell(row, idx.cost));
		const conv = toFloat(cell(row, idx.conversion));
		const rev = toFloat(cell(row, idx.revenue));
		if (!(imp || clk || cost)) continue;

		const key = camp || '(캠페인)';
		const o = (agg[key] ??= { imp: 0, clk: 0, cost: 0, conv: 0, rev: 0 });
		o.imp += imp;
		o.clk += clk;
		o.cost += cost;
		o.conv += conv;
		o.rev += rev;
	}
	return agg;
}

function distribute(res, campLabel, aggOne, days, tag) {
	const n = days.length;
	for (const d of days) {
		const r = blankRow(res.channel, d);
		Object.assign(r, {
			campaign_name:
				n > 1 ? `${campLabel} [균등배분 ${days[0]}~${days[n - 1]}]` : campLabel,
			impressions: Math.round(aggOne.imp / n),
			clicks: Math.round(aggOne.clk / n),
			cost: aggOne.cost / n,
			conversion: aggOne.conv / n,
			revenue: aggOne.rev / n,
		});
		res.rows.push(r);
	}
	if (n > 1) {
		res.warnings.push(
			`'${campLabel}' — ${tag}: 총계를 ${n}일로 균등 배분했습니다. ` +
				'※ 나중에 이 기간 중 일부 날짜만 실제 일별 데이터로 교체하면 나머지 날짜 배분값이 왜곡됩니다.',
		);
	}
}

function parseNaverOtherSummary(body, idx, name, txt, res) {
	res.detectedFormat = 'naver-other-summary';
	let rng = rangeFromFilename(name) || rangeFromText(txt);
	if (!rng) {
		res.warnings.push(
			'기간을 찾지 못해 오늘 하루로 처리했습니다 — 파일명에 기간(_YYYYMMDD_YYYYMMDD)을 포함해 주세요.',
		);
		rng = [todayISO(), todayISO()];
	}
	const days = dateRange(rng[0], rng[1]);
	const agg = aggregateBody(body, idx);
	if (Object.keys(agg).length === 0) {
		res.warnings.push('집계할 데이터를 찾지 못했습니다.');
		return res;
	}
	for (const one of Object.values(agg)) {
		distribute(
			res,
			NAVER_OTHER_MEDIA_LABEL,
			one,
			days,
			'네이버 기타매체 계정 집계형',
		);
	}
	return res;
}

function parsePeriodAggregate(body, idx, name, txt, res) {
	res.detectedFormat = 'period-aggregate';
	let rng = rangeFromText(txt) || rangeFromFilename(name);
	if (!rng) {
		res.warnings.push('날짜 컬럼도 기간 표기도 없어 오늘 하루로 처리했습니다.');
		rng = [todayISO(), todayISO()];
	}
	const days = dateRange(rng[0], rng[1]);
	const agg = aggregateBody(body, idx);
	if (Object.keys(agg).length === 0) {
		res.warnings.push('집계할 데이터를 찾지 못했습니다.');
		return res;
	}
	for (const [camp, one] of Object.entries(agg)) {
		distribute(res, camp, one, days, '기간 집계형(날짜 컬럼 없음)');
	}
	return res;
}
