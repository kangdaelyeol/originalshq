/**
 * Firestore 접근 계층 — Python `src/core/database.py`의 세션/모델 역할.
 *
 * 컬렉션 구조 (SQLite 테이블 → 서브컬렉션):
 *   brands/{brandId}
 *     - name, industry, mainKpi(CPA|ROAS|DB), commerceChannels: string[], memo, createdAt
 *   brands/{brandId}/performance/{autoId}
 *     - date: "YYYY-MM-DD"(문자열, 타임존 없는 달력일), channel, campaignName, adgroupName,
 *       keyword, impressions, clicks, cost, conversion, convIndirect, convPurchase,
 *       revenue, resultType, createdAt
 *   brands/{brandId}/alerts/{autoId}
 *     - channel, alertType, severity(info|warn|critical), title, message,
 *       refDate: "YYYY-MM-DD"|null, isRead: 0|1, createdAt
 *   brands/{brandId}/reports/{autoId}
 *     - reportType(weekly|monthly), dateStart, dateEnd, fmt(pdf|docx), storagePath, createdAt
 *
 * 집계(SUM/GROUP BY)는 Firestore가 서버측으로 못 하므로, 분석/보고서는 해당 기간
 * performance 문서를 한 번에 읽어와 메모리에서 합산한다 (기간이 짧아 문서 수가 적다).
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

export const db = getFirestore();
export { FieldValue };

export const brandsCol = () => db.collection("brands");
export const perfCol = (brandId) => db.collection("brands").doc(String(brandId)).collection("performance");
export const alertsCol = (brandId) => db.collection("brands").doc(String(brandId)).collection("alerts");
export const reportsCol = (brandId) => db.collection("brands").doc(String(brandId)).collection("reports");

/** performance 문서 → 분석 코드가 쓰는 평탄 객체 (Python row dict와 동일 키). */
export function perfDocToRow(d) {
  const x = d.data();
  return {
    id: d.id,
    date: x.date,
    channel: x.channel,
    campaign_name: x.campaignName ?? "",
    adgroup_name: x.adgroupName ?? "",
    keyword: x.keyword ?? "",
    impressions: x.impressions ?? 0,
    clicks: x.clicks ?? 0,
    cost: x.cost ?? 0,
    conversion: x.conversion ?? 0,
    conv_indirect: x.convIndirect ?? 0,
    conv_purchase: x.convPurchase ?? 0,
    revenue: x.revenue ?? 0,
    result_type: x.resultType ?? null,
  };
}

/** 파서 row dict → performance 문서 필드. */
export function rowToPerfDoc(brandId, r) {
  return {
    brandId: String(brandId),
    date: r.date,
    channel: r.channel,
    campaignName: r.campaign_name || "",
    adgroupName: r.adgroup_name || "",
    keyword: r.keyword || "",
    impressions: Math.trunc(Number(r.impressions) || 0),
    clicks: Math.trunc(Number(r.clicks) || 0),
    cost: Number(r.cost) || 0,
    conversion: Number(r.conversion) || 0,
    convIndirect: Number(r.conv_indirect) || 0,
    convPurchase: Number(r.conv_purchase) || 0,
    revenue: Number(r.revenue) || 0,
    resultType: r.result_type ?? null,
    createdAt: FieldValue.serverTimestamp(),
  };
}

/** 브랜드의 [start, end] (포함) 구간 performance rows. 한 번 읽어 메모리 집계용. */
export async function fetchPerfRows(brandId, startISO, endISO, channel = null) {
  let q = perfCol(brandId).where("date", ">=", startISO).where("date", "<=", endISO);
  if (channel) q = q.where("channel", "==", channel);
  const snap = await q.get();
  return snap.docs.map(perfDocToRow);
}
