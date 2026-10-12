import { Firestore } from 'firebase-admin/firestore'
import { MondayBoard, MondayItem } from './types'

const BOARDS_COLLECTION = 'mondayBoards'
const ITEMS_COLLECTION = 'mondayItems'

// Firestore batch 한 번에 담을 수 있는 쓰기는 500건 — 여유를 두고 끊는다.
const BATCH_SIZE = 400

export async function listBoards(db: Firestore): Promise<MondayBoard[]> {
  const snapshot = await db.collection(BOARDS_COLLECTION).get()
  return snapshot.docs.map((doc) => doc.data() as MondayBoard)
}

export async function getBoard(
  db: Firestore,
  boardId: string,
): Promise<MondayBoard | null> {
  const doc = await db.collection(BOARDS_COLLECTION).doc(boardId).get()
  return doc.exists ? (doc.data() as MondayBoard) : null
}

export async function saveBoard(
  db: Firestore,
  board: MondayBoard,
): Promise<void> {
  await db.collection(BOARDS_COLLECTION).doc(board.id).set(board)
}

export async function updateBoard(
  db: Firestore,
  boardId: string,
  patch: Partial<MondayBoard>,
): Promise<void> {
  await db.collection(BOARDS_COLLECTION).doc(boardId).update(patch)
}

/** 보드 한 개의 item을 Monday와 똑같이 맞춘다: 받아온 item은 전부 덮어쓰고,
 * 저장돼 있는데 이번에 안 온 item(Monday에서 지워졌거나 다른 보드로 옮겨진
 * 것)은 지운다. 지운 문서 수를 돌려준다. */
export async function replaceBoardItems(
  db: Firestore,
  boardId: string,
  items: MondayItem[],
): Promise<number> {
  const collection = db.collection(ITEMS_COLLECTION)
  const existing = await collection
    .where('boardId', '==', boardId)
    .select()
    .get()

  const incomingIds = new Set(items.map((item) => item.id))
  const staleRefs = existing.docs
    .filter((doc) => !incomingIds.has(doc.id))
    .map((doc) => doc.ref)

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const item of items.slice(i, i + BATCH_SIZE)) {
      batch.set(collection.doc(item.id), item)
    }
    await batch.commit()
  }

  for (let i = 0; i < staleRefs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const ref of staleRefs.slice(i, i + BATCH_SIZE)) batch.delete(ref)
    await batch.commit()
  }

  return staleRefs.length
}

/** 보드 등록을 해제한다 — 보드 문서와 그 보드에서 가져온 item을 전부 지운다.
 * 지운 item 수를 돌려준다. */
export async function deleteBoard(
  db: Firestore,
  boardId: string,
): Promise<number> {
  const deletedCount = await replaceBoardItems(db, boardId, [])
  await db.collection(BOARDS_COLLECTION).doc(boardId).delete()
  return deletedCount
}
