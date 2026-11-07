import { Firestore } from 'firebase-admin/firestore'
import { detectBoardKind, toConsultation } from './customers'
import { listBoardItems, listBoards, listItemsCreatedSince } from './firestore'
import { extractMondayPhones, isMobilePhone } from './helper'
import { MondayBoard, MondayItem, MondayLeadFeedRow } from './types'

export interface MondayLeadFeed {
  /** 상담 보드(리드를 받는 보드) 전부 — 이름 순. 화면의 보드 거르기 버튼. */
  boards: { id: string; name: string }[]
  /** 기간 안에(전체를 고르면 전부) 만들어진 상담 기록 — 최근 것부터. */
  leads: MondayLeadFeedRow[]
  /** 상담 보드의 마지막 동기화 시각(ms) — 아직 없으면 null. */
  syncedAt: number | null
}

const consultationBoards = (boards: MondayBoard[]): MondayBoard[] =>
  boards
    .filter((board) => detectBoardKind(board.columns) === 'consultation')
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))

/** 리드의 고객 번호 — 고객 통합(buildCustomers)과 같은 규칙(적힌 번호에서
 * 휴대폰을 먼저, 없으면 첫 번호)이라 mondayCustomers 문서 id와 같다. 저장된
 * item.phone은 동기화 때의 첫 번호라 유선 번호가 먼저 적힌 고객에서 다르다. */
const customerPhoneOf = (item: MondayItem): string | null => {
  const phones = extractMondayPhones(item.phoneRaw)
  return phones.find(isMobilePhone) ?? phones[0] ?? null
}

/** 상담 보드의 item을 리드 줄로 바꾼다(순수 함수) — 최근 것부터. */
export const buildLeadFeed = (
  items: MondayItem[],
  boardIds: ReadonlySet<string>,
): MondayLeadFeedRow[] =>
  items
    .filter((item) => boardIds.has(item.boardId))
    .map((item) => {
      const consultation = toConsultation(item)
      return {
        itemId: consultation.itemId,
        boardId: consultation.boardId,
        boardName: consultation.boardName,
        name: consultation.name,
        url: consultation.url,
        createdAt: consultation.createdAt,
        receivedAt: consultation.receivedAt,
        product: consultation.product,
        status: consultation.status,
        assignee: consultation.assignee,
        probability: consultation.probability,
        notes: consultation.notes,
        inquiryMessage: consultation.inquiryMessage,
        callbackDates: consultation.callbackDates,
        callbackStage: consultation.callbackStage,
        utmSource: consultation.utmSource,
        utmMedium: consultation.utmMedium,
        utmCampaign: consultation.utmCampaign,
        phone: customerPhoneOf(item),
        phoneRaw: item.phoneRaw,
      }
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

/** 리드 분석 탭 — since(ISO) 이후 Monday에 만들어진 상담 기록과 상담 보드 목록.
 * since가 null이면 상담 보드의 기록 전부(보드마다 읽는다). 인입 시각은 Monday에
 * 기록이 만들어진 시각이다(웹 문의는 접수 직후 만들어지고, 접수일 칸은
 * 날짜뿐이라). */
export async function readLeadFeed(
  db: Firestore,
  since: string | null,
): Promise<MondayLeadFeed> {
  const boards = await listBoards(db)
  const consultation = consultationBoards(boards)
  const items =
    since === null
      ? (
          await Promise.all(
            consultation.map((board) => listBoardItems(db, board.id)),
          )
        ).flat()
      : await listItemsCreatedSince(db, since)
  const syncedAt = consultation.reduce<number | null>(
    (latest, board) =>
      board.lastSync?.ok && board.lastSync.at > (latest ?? 0)
        ? board.lastSync.at
        : latest,
    null,
  )
  return {
    boards: consultation.map((board) => ({ id: board.id, name: board.name })),
    leads: buildLeadFeed(items, new Set(consultation.map((board) => board.id))),
    syncedAt,
  }
}
