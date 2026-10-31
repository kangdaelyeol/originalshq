import { Firestore } from 'firebase-admin/firestore'
import {
  TechBoardDoc,
  TechBoardKey,
  TechBoardRecords,
  TechBoardSyncResult,
} from './types'

// 보드 하나 = 문서 하나(기록 수백 건, 수백 KB 이내). 고객 통합 컬렉션
// (mondayBoards·mondayItems·mondayCustomers)과 섞이지 않게 따로 둔다.
const COLLECTION = 'techBoards'

/** 기록을 통째로 바꾼다 — 성공한 동기화에서만 부른다. */
export async function saveTechBoard<K extends TechBoardKey>(
  db: Firestore,
  doc: {
    key: K
    boardId: string
    name: string
    records: TechBoardRecords[K]
    result: TechBoardSyncResult
  },
): Promise<void> {
  const data: TechBoardDoc<K> = {
    key: doc.key,
    boardId: doc.boardId,
    name: doc.name,
    records: doc.records,
    syncedAt: doc.result.at,
    lastSync: doc.result,
  }
  await db.collection(COLLECTION).doc(doc.key).set(data)
}

/** 실패 결과만 남긴다 — 저장된 기록은 그대로 둔다(일시적인 오류가 "전부
 * 삭제"로 이어지지 않게). */
export async function saveTechBoardFailure(
  db: Firestore,
  key: TechBoardKey,
  boardId: string,
  result: TechBoardSyncResult,
): Promise<void> {
  await db
    .collection(COLLECTION)
    .doc(key)
    .set({ key, boardId, lastSync: result }, { merge: true })
}

export async function listTechBoards(db: Firestore): Promise<TechBoardDoc[]> {
  const snapshot = await db.collection(COLLECTION).get()
  return snapshot.docs.map((doc) => doc.data() as TechBoardDoc)
}
