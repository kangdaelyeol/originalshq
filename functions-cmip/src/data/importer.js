/**
 * CSV 적재 — Python `import_rows_batch` / `existing_conflict_keys` / `save_manual_smartstore`
 * 의 Firestore 버전.
 *
 * 절대 규칙 (과거 버그에서 나옴):
 *  - 배치 임포트는 배치 전체의 (채널+캠페인+날짜) 조합을 한 번만 삭제한 뒤 전체 삽입한다.
 *    파일별 delete-then-insert 를 루프하면 같은 배치의 다른 파일이 서로 지운다.
 *  - 삭제 범위는 '채널+날짜'가 아니라 '채널+캠페인+날짜'. 같은 네이버 채널의
 *    쇼핑검색광고와 애드부스트/GFA를 따로 임포트해도 서로 건드리지 않는다.
 *  - 균등배분 캠페인명의 ' [균등배분 …]' 접미사는 campaignName의 일부이며 삭제 키에도 그대로 쓴다
 *    (Python과 동일).
 */
import { perfCol, rowToPerfDoc } from "./firestore.js";
import { parseDate } from "../lib/dates.js";

function keyOf(r) {
  return JSON.stringify([r.channel, r.campaign_name || "", r.date]);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string|number} brandId
 * @param {Array<{rows:object[]}>|object[]} resultsOrRows  ParseResult(.rows) 배열 또는 row dict 배열
 * @returns {Promise<{inserted:number, deleted:number}>}
 */
export async function importRowsBatch(db, brandId, resultsOrRows) {
  /** @type {object[]} */
  const rows = [];
  for (const item of resultsOrRows) {
    if (item && Array.isArray(item.rows)) rows.push(...item.rows);
    else if (Array.isArray(item)) rows.push(...item);
    else if (item) rows.push(item);
  }
  if (rows.length === 0) return { inserted: 0, deleted: 0 };

  // 1) 삭제 대상 조합 수집
  const keys = new Map();
  for (const r of rows) if (!keys.has(keyOf(r))) keys.set(keyOf(r), r);

  const col = perfCol(brandId);
  let deleted = 0;
  const toDelete = [];
  for (const r of keys.values()) {
    const snap = await col
      .where("channel", "==", r.channel)
      .where("campaignName", "==", r.campaign_name || "")
      .where("date", "==", r.date)
      .get();
    for (const d of snap.docs) toDelete.push(d.ref);
    deleted += snap.size;
  }

  // 2) 삭제 + 삽입 (BulkWriter — 500 배치 자동 처리)
  const writer = db.bulkWriter();
  for (const ref of toDelete) writer.delete(ref);
  for (const r of rows) writer.create(col.doc(), rowToPerfDoc(brandId, r));
  await writer.close();

  return { inserted: rows.length, deleted };
}

/**
 * 덮어쓰기 확인용 — (채널+캠페인+날짜) 단위로 이미 DB에 있는 조합.
 * @returns {Promise<Array<[string,string,string]>>}
 */
export async function existingConflictKeys(db, brandId, rows) {
  if (!rows || rows.length === 0) return [];
  const col = perfCol(brandId);
  const seen = new Set();
  const found = [];
  for (const r of rows) {
    const k = keyOf(r);
    if (seen.has(k)) continue;
    seen.add(k);
    const snap = await col
      .where("channel", "==", r.channel)
      .where("campaignName", "==", r.campaign_name || "")
      .where("date", "==", r.date)
      .limit(1)
      .get();
    if (!snap.empty) found.push([r.channel, r.campaign_name || "", r.date]);
  }
  return found;
}

/**
 * 스마트스토어 등 커머스 채널 매출·구매건 수기입력.
 * @param {*} db
 * @param {string|number} brandId
 * @param {Array<{date:string, orders?:number, revenue?:number}>} entries
 * @param {string} channel
 */
export async function saveManualSmartstore(db, brandId, entries, channel = "smartstore") {
  const rows = [];
  for (const e of entries) {
    const d = parseDate(e.date);
    if (!d) continue;
    rows.push({
      date: d,
      channel,
      campaign_name: "수기입력",
      adgroup_name: "",
      keyword: "",
      impressions: 0,
      clicks: 0,
      cost: 0, // 광고비는 넣지 않는다. 실제 광고비는 매체 CSV 합계로 집계.
      conversion: Number(e.orders) || 0,
      conv_indirect: 0,
      conv_purchase: 0,
      revenue: Number(e.revenue) || 0,
      result_type: null,
    });
  }
  return importRowsBatch(db, brandId, rows);
}
