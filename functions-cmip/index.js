/**
 * MIP 백엔드 진입점 — Firebase Functions v2 콜러블.
 *
 * 프론트엔드(React SPA)는 이 프로젝트에 없다. 여기서는 도메인 로직만 노출한다.
 * 인증: 기본 Auth 게이트만 (대행사 단일 워크스페이스). 테넌시 격리는 이후 단계.
 *
 * 이관 진행:
 *  [x] CSV 파서 (src/csv/*)                      — Python csv_importer 파싱 계층
 *  [x] CSV 적재 (src/data/importer.js)           — import_rows_batch / conflict keys
 *  [x] 알림·MORTAR SCORE (src/analysis/engine.js) — Python analysis/engine.py
 *  [ ] 보고서 analyzer (src/reports/analyzer.js)  — Python reports/analyzer.py  ← 다음
 *  [ ] 보고서 렌더 (PDF/DOCX → Storage)          — ReportLab/python-docx 대체
 *  [ ] 백업/시드/CSV Storage 트리거
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

import { db } from "./src/data/firestore.js";
import { parseBuffer } from "./src/csv/parser.js";
import { importRowsBatch, existingConflictKeys, saveManualSmartstore } from "./src/data/importer.js";
import { runAlertCheck, calcMortarScore } from "./src/analysis/engine.js";

setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

function requireAuth(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
}

/** 파일 base64 배열 → ParseResult 배열. */
function parseFiles(files) {
  return (files || []).map((f) => {
    const buf = Buffer.from(f.contentBase64, "base64");
    return parseBuffer(buf, f.name || "upload.csv", f.channelHint || null);
  });
}

/**
 * CSV 미리보기(드라이런) — 적재 없이 파싱 결과 + 충돌 키만 반환.
 * data: { brandId, files: [{ name, contentBase64, channelHint? }] }
 */
export const previewCsv = onCall(async (req) => {
  requireAuth(req);
  const { brandId, files } = req.data || {};
  if (!brandId) throw new HttpsError("invalid-argument", "brandId 필요");

  const results = parseFiles(files);
  const allRows = results.flatMap((r) => r.rows);
  const conflicts = await existingConflictKeys(db, brandId, allRows);

  return {
    files: results.map((r) => ({
      source: r.sourceName,
      channel: r.channel,
      format: r.detectedFormat,
      rowCount: r.rows.length,
      dateRange: r.dateRange,
      warnings: r.warnings,
      sample: r.rows.slice(0, 5),
    })),
    totalRows: allRows.length,
    conflicts,
  };
});

/**
 * CSV 적재 — 배치 전체 (채널+캠페인+날짜) 1회 삭제 후 전체 삽입.
 * data: { brandId, files: [...] }
 */
export const importCsv = onCall(async (req) => {
  requireAuth(req);
  const { brandId, files } = req.data || {};
  if (!brandId) throw new HttpsError("invalid-argument", "brandId 필요");

  const results = parseFiles(files);
  const { inserted, deleted } = await importRowsBatch(db, brandId, results);
  return {
    inserted,
    deleted,
    warnings: results.flatMap((r) => r.warnings),
  };
});

/**
 * 스마트스토어 등 커머스 채널 매출·구매건 수기입력.
 * data: { brandId, entries: [{ date, orders, revenue }], channel? }
 */
export const saveCommerceRevenue = onCall(async (req) => {
  requireAuth(req);
  const { brandId, entries, channel } = req.data || {};
  if (!brandId || !Array.isArray(entries)) throw new HttpsError("invalid-argument", "brandId, entries 필요");
  return saveManualSmartstore(db, brandId, entries, channel || "smartstore");
});

/**
 * 이상 징후 재검사. data: { brandId, refDate?, periodLen? }
 * refDate 미지정 시 오늘 — 후행 업로드 검사에서는 임포트된 최신일을 넘길 것.
 */
export const alertCheck = onCall(async (req) => {
  requireAuth(req);
  const { brandId, refDate, periodLen } = req.data || {};
  if (!brandId) throw new HttpsError("invalid-argument", "brandId 필요");
  const created = await runAlertCheck(brandId, refDate || null, periodLen || 7);
  return { created };
});

/** MORTAR SCORE. data: { brandId, refDate?, periodLen? } */
export const mortarScore = onCall(async (req) => {
  requireAuth(req);
  const { brandId, refDate, periodLen } = req.data || {};
  if (!brandId) throw new HttpsError("invalid-argument", "brandId 필요");
  return calcMortarScore(brandId, refDate || null, periodLen || 7);
});
