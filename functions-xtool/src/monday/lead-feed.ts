import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'
import { attributionChannel } from './attribution'
import { detectBoardKind, toConsultation } from './customers'
import {
  listBoardItems,
  listBoards,
  listItemsCreatedSince,
  readLeadFeedRows,
  saveLeadFeedRows,
} from './firestore'
import { extractMondayPhones, representativePhone } from './helper'
import {
  MondayBoard,
  MondayItem,
  MondayLeadFeed,
  MondayLeadFeedRow,
} from './types'

/** 리드 줄의 모양 — 칸을 더하거나 바꾸면 올린다. 묶어 둔 줄(mondayLeadFeed)의
 * 판이 다르면 다음 동기화가 새로 묶을 때까지 원본 기록에서 읽는다. */
const LEAD_FEED_ROW_VERSION = 1

const consultationBoards = (boards: MondayBoard[]): MondayBoard[] =>
  boards
    .filter((board) => detectBoardKind(board.columns) === 'consultation')
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))

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
        // 고객 통합과 같은 규칙이라 mondayCustomers 문서 id와 같다. 저장된
        // item.phone도 같은 규칙이지만 그 item을 동기화하던 때의 규칙으로 뽑은
        // 값이라, 규칙이 바뀐 뒤 그대로인 item에서는 다를 수 있어 다시 뽑는다.
        phone: representativePhone(extractMondayPhones(item.phoneRaw)),
        phoneRaw: item.phoneRaw,
        channel: attributionChannel(consultation.utmSource),
      }
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

/** 리드 줄을 묶어 저장한다 — 동기화가 끝날 때 고객 통합(rebuildCustomers)이
 * 같은 item으로 부른다. 리드 분석 탭이 열 때마다 상담 기록 수천 건을 읽지 않게. */
export async function saveLeadFeed(
  db: Firestore,
  items: MondayItem[],
  boards: MondayBoard[],
): Promise<void> {
  const boardIds = new Set(consultationBoards(boards).map((board) => board.id))
  await saveLeadFeedRows(
    db,
    buildLeadFeed(items, boardIds),
    LEAD_FEED_ROW_VERSION,
  )
}

/** 리드 분석 탭 — since(ISO) 이후 Monday에 만들어진 상담 기록과 상담 보드 목록.
 * since가 null이면 상담 보드의 기록 전부. 인입 시각은 Monday에 기록이 만들어진
 * 시각이다(웹 문의는 접수 직후 만들어지고, 접수일 칸은 날짜뿐이라).
 * 동기화 때 묶어 둔 리드 줄을 읽고, 아직 없으면(첫 배포 직후 등) 원본 기록에서
 * 만든다 — 기간이면 그 기간에 만들어진 기록만, 전체면 상담 보드마다 읽는다. */
export async function readLeadFeed(
  db: Firestore,
  since: string | null,
): Promise<MondayLeadFeed> {
  const [boards, saved] = await Promise.all([
    listBoards(db),
    readLeadFeedRows(db, since, LEAD_FEED_ROW_VERSION),
  ])
  const consultation = consultationBoards(boards)
  const boardIds = new Set(consultation.map((board) => board.id))
  let leads: MondayLeadFeedRow[]
  if (saved) {
    // 묶은 뒤 등록이 풀린 보드의 줄은 뺀다 — 원본에서 읽을 때와 같게.
    leads = saved.filter((row) => boardIds.has(row.boardId))
  } else {
    logger.info('리드 분석: 묶어 둔 리드 줄이 없어 원본 기록에서 읽습니다')
    const items =
      since === null
        ? (
            await Promise.all(
              consultation.map((board) => listBoardItems(db, board.id)),
            )
          ).flat()
        : await listItemsCreatedSince(db, since)
    leads = buildLeadFeed(items, boardIds)
  }
  const syncedAt = consultation.reduce<number | null>(
    (latest, board) =>
      board.lastSync?.ok && board.lastSync.at > (latest ?? 0)
        ? board.lastSync.at
        : latest,
    null,
  )
  return {
    boards: consultation.map((board) => ({ id: board.id, name: board.name })),
    leads,
    syncedAt,
  }
}
