import { fetchMonday } from '../monday/client'
import { TechEditError } from './errors'

// item 업데이트(Monday 댓글) — Monday 표의 말풍선 패널이 그때그때 읽고 쓴다(캐시에는
// 개수만 둔다 — items.ts updateCount). 쓰기는 우리 API 키 주인 계정으로 올라가서,
// 누가 썼는지 본문 끝에 서명("— 이름 · xtool tech")을 붙이고, 읽을 때 그 서명을
// 떼어 작성자로 보여 준다.

// 패널에 보여 줄 최근 업데이트 수
const UPDATE_LIMIT = 50
const MAX_BODY = 5000
// 본문 끝 서명 — 화면(tech-updates.ts)이 같은 모양으로 떼어 낸다.
const signature = (name: string) => `— ${name} · xtool tech`

interface RawUpdate {
  id: string
  text_body: string | null
  created_at: string | null
  creator: { id: string; name: string; photo_thumb_small: string | null } | null
  replies?: RawUpdate[]
}

export interface TechUpdate {
  id: string
  text: string
  createdAt: string | null
  /** Monday에 적힌 작성자(우리 화면에서 쓴 건 API 키 주인) */
  creator: { name: string; photo: string | null } | null
  replies: TechUpdate[]
}

const toUpdate = (raw: RawUpdate): TechUpdate => ({
  id: String(raw.id),
  text: raw.text_body ?? '',
  createdAt: raw.created_at,
  creator: raw.creator
    ? { name: raw.creator.name, photo: raw.creator.photo_thumb_small }
    : null,
  replies: (raw.replies ?? []).map(toUpdate),
})

/** item의 업데이트 — 최근 것부터, 답글은 오래된 것부터(Monday 순서 그대로). */
export async function fetchItemUpdates(
  apiKey: string,
  itemId: string,
): Promise<TechUpdate[]> {
  const fields = 'id text_body created_at creator { id name photo_thumb_small }'
  const data = await fetchMonday<{
    items: Array<{ updates: RawUpdate[] | null }> | null
  }>(
    apiKey,
    `query TechUpdates($ids: [ID!]) {
      items(ids: $ids) {
        updates(limit: ${UPDATE_LIMIT}) { ${fields} replies { ${fields} } }
      }
    }`,
    { ids: [itemId] },
  )
  return (data.items?.[0]?.updates ?? []).map(toUpdate)
}

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** 업데이트(또는 parentId의 답글) 쓰기 — 글자만, 줄바꿈은 그대로. 새 id. */
export async function createItemUpdate(
  apiKey: string,
  itemId: string,
  text: string,
  author: string,
  parentId?: string | null,
): Promise<string> {
  const body = text.trim()
  if (!body) throw new TechEditError('내용을 적어 주세요')
  if (body.length > MAX_BODY) {
    throw new TechEditError(`${MAX_BODY}자 안으로 적어 주세요`)
  }
  if (parentId && !/^\d+$/.test(parentId)) {
    throw new TechEditError('답글을 달 업데이트가 올바르지 않아요')
  }
  const html = `${escapeHtml(body).replace(/\n/g, '<br>')}<br><br>${escapeHtml(
    signature(author),
  )}`
  const data = await fetchMonday<{ create_update: { id: string } }>(
    apiKey,
    `mutation TechCreateUpdate($itemId: ID!, $body: String!, $parentId: ID) {
      create_update(item_id: $itemId, body: $body, parent_id: $parentId) { id }
    }`,
    { itemId, body: html, parentId: parentId ?? null },
  )
  return String(data.create_update.id)
}
