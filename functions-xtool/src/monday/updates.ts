import { fetchMonday } from './client'

// item 하나의 업데이트(이름 칸을 누르면 열리는 메모 창)와 첨부 파일을 Monday에서
// 바로 읽는다 — DB에 두지 않는다. 파일 주소(public_url)는 한 시간쯤 뒤에 만료되어
// 저장해 둘 수 없어서, 화면이 기록을 열 때마다 새로 받는다.

export interface MondayAsset {
  id: string
  name: string
  extension: string | null
  /** 바이트. */
  size: number | null
  /** 누구나 열 수 있는 임시 주소 — 한 시간쯤 뒤 만료. */
  url: string | null
  /** 이미지·영상의 작은 미리보기(없으면 null). */
  thumbnail: string | null
}

export interface MondayUpdateReply {
  id: string
  author: string | null
  createdAt: string | null
  text: string
}

export interface MondayUpdate {
  id: string
  author: string | null
  createdAt: string | null
  /** 서식을 뺀 글자. */
  text: string
  assets: MondayAsset[]
  replies: MondayUpdateReply[]
}

export interface MondayItemUpdates {
  itemId: string
  name: string
  updates: MondayUpdate[]
  /** 파일 컬럼(증상 자료·기기 사진 등)에 올린 파일. */
  files: MondayAsset[]
}

const ASSET_FIELDS = `
  id
  name
  file_extension
  file_size
  public_url
  url_thumbnail
`

const ITEM_UPDATES_QUERY = `
  query GetItemUpdates($itemIds: [ID!]) {
    items(ids: $itemIds) {
      id
      name
      updates(limit: 100) {
        id
        text_body
        created_at
        creator {
          name
        }
        assets {
          ${ASSET_FIELDS}
        }
        replies {
          id
          text_body
          created_at
          creator {
            name
          }
        }
      }
      assets(assets_source: columns) {
        ${ASSET_FIELDS}
      }
    }
  }
`

interface RawAsset {
  id: string
  name: string
  file_extension: string | null
  file_size: number | null
  public_url: string | null
  url_thumbnail: string | null
}

interface RawReply {
  id: string
  text_body: string | null
  created_at: string | null
  creator: { name: string } | null
}

interface RawItem {
  id: string
  name: string
  updates: Array<
    RawReply & { assets: RawAsset[] | null; replies: RawReply[] | null }
  > | null
  assets: RawAsset[] | null
}

const toAsset = (asset: RawAsset): MondayAsset => ({
  id: asset.id,
  name: asset.name,
  extension: asset.file_extension?.replace(/^\./, '').toLowerCase() || null,
  size: asset.file_size,
  url: asset.public_url,
  thumbnail: asset.url_thumbnail,
})

const toReply = (reply: RawReply): MondayUpdateReply => ({
  id: reply.id,
  author: reply.creator?.name ?? null,
  createdAt: reply.created_at,
  text: reply.text_body?.trim() ?? '',
})

/** item 하나의 메모·파일. item이 없거나 이 API 키로 볼 수 없으면 null. */
export async function fetchItemUpdates(
  apiKey: string,
  itemId: string,
): Promise<MondayItemUpdates | null> {
  const data = await fetchMonday<{ items: RawItem[] | null }>(
    apiKey,
    ITEM_UPDATES_QUERY,
    { itemIds: [itemId] },
  )
  const item = data.items?.[0]
  if (!item) return null
  return {
    itemId: item.id,
    name: item.name,
    // Monday는 최근 것부터 준다 — 그대로 둔다.
    updates: (item.updates ?? []).map((update) => ({
      ...toReply(update),
      assets: (update.assets ?? []).map(toAsset),
      // 댓글은 오래된 것부터(대화 순서).
      replies: (update.replies ?? [])
        .map(toReply)
        .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')),
    })),
    files: (item.assets ?? []).map(toAsset),
  }
}
