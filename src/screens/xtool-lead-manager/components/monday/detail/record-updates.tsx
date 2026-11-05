/** Monday 기록 한 건의 메모·첨부 파일 펼치기. */
import { useContext, useState } from 'react'
import type {
  MondayAsset,
  MondayItemUpdates,
} from '@/screens/xtool-lead-manager/entity'
import { Spinner } from '@/components/glass'
import '@/screens/xtool-lead-manager/styles/monday-updates.scss'
import { UpdatesContext } from './updates-context'
import { koreaIso } from '@/screens/xtool-lead-manager/utils/calc'

const IMAGE_EXT = /^(jpe?g|png|gif|webp|heic|bmp|svg)$/
const VIDEO_EXT = /^(mp4|mov|webm|m4v|avi)$/

const formatSize = (size: number | null): string => {
  if (!size) return ''
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`
  return `${(size / 1024 / 1024).toFixed(1)}MB`
}

/** 첨부 파일 하나 — 이미지는 미리보기, 영상은 바로 재생, 나머지는 열기 링크.
 * 주소는 한 시간쯤 뒤 만료된다(다시 펼치면 새로 받는다). */
const AssetView = ({ asset }: { asset: MondayAsset }) => {
  const ext = asset.extension ?? ''
  if (asset.url && VIDEO_EXT.test(ext))
    return (
      <figure className="monday_asset is-video">
        <video src={asset.url} controls preload="metadata" />
        <figcaption>
          <a href={asset.url} target="_blank" rel="noreferrer">
            {asset.name}
          </a>{' '}
          {formatSize(asset.size)}
        </figcaption>
      </figure>
    )
  // HEIC는 브라우저가 못 그려서 Monday 미리보기(thumbnail)를 쓴다.
  const preview =
    IMAGE_EXT.test(ext) && ext !== 'heic' ? asset.url : asset.thumbnail
  if (asset.url && preview)
    return (
      <a
        className="monday_asset is-image"
        href={asset.url}
        target="_blank"
        rel="noreferrer"
        title={`${asset.name} ${formatSize(asset.size)}`}
      >
        <img src={preview} alt={asset.name} loading="lazy" />
      </a>
    )
  return (
    <a
      className="monday_asset is-file"
      href={asset.url ?? undefined}
      target="_blank"
      rel="noreferrer"
    >
      <span className="ext">{ext || '파일'}</span>
      <span className="name">{asset.name}</span>
      <span className="size">{formatSize(asset.size)}</span>
    </a>
  )
}

const Assets = ({ assets }: { assets: MondayAsset[] }) =>
  assets.length > 0 ? (
    <div className="monday_assets">
      {assets.map((asset) => (
        <AssetView key={asset.id} asset={asset} />
      ))}
    </div>
  ) : null

/** Monday가 준 시각(UTC)을 한국 시간 "YYYY-MM-DD HH:mm"으로. */
const formatAt = (value: string | null): string => {
  const time = value ? Date.parse(value) : NaN
  if (Number.isNaN(time)) return ''
  return koreaIso(time).replace('T', ' ').slice(0, 16)
}

const UpdatesBody = ({ data }: { data: MondayItemUpdates }) =>
  data.updates.length === 0 && data.files.length === 0 ? (
    <p className="monday_updates_empty">메모·파일이 없습니다.</p>
  ) : (
    <>
      {data.files.length > 0 && (
        <div className="monday_update">
          <div className="monday_update_head">파일 컬럼</div>
          <Assets assets={data.files} />
        </div>
      )}
      {data.updates.map((update) => (
        <div key={update.id} className="monday_update">
          <div className="monday_update_head">
            <strong>{update.author ?? '알 수 없음'}</strong>
            <span>{formatAt(update.createdAt)}</span>
          </div>
          {update.text && <p className="monday_update_text">{update.text}</p>}
          <Assets assets={update.assets} />
          {update.replies.length > 0 && (
            <ul className="monday_update_replies">
              {update.replies.map((reply) => (
                <li key={reply.id}>
                  <div className="monday_update_head">
                    <strong>{reply.author ?? '알 수 없음'}</strong>
                    <span>{formatAt(reply.createdAt)}</span>
                  </div>
                  <p className="monday_update_text">{reply.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  )

/** "메모·파일" 펼치기 — 처음 펼칠 때 Monday에서 받아온다. */
export const RecordUpdates = ({ itemId }: { itemId: string }) => {
  const updates = useContext(UpdatesContext)
  const [open, setOpen] = useState(false)
  if (!updates) return null
  const state = updates.states[itemId]
  const toggle = () => {
    if (!open) updates.load(itemId)
    setOpen(!open)
  }
  const count =
    state?.status === 'ready'
      ? state.data.updates.length + state.data.files.length
      : null

  return (
    <div className="monday_updates">
      <button
        type="button"
        className="monday_updates_toggle"
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? '▾' : '▸'} 메모·파일
        {count !== null && <span className="count">{count}</span>}
      </button>
      {open && (
        <div className="monday_updates_body">
          {!state || state.status === 'loading' ? (
            <p className="monday_updates_empty">
              <Spinner size={14} /> Monday에서 불러오는 중
            </p>
          ) : state.status === 'error' ? (
            <p className="monday_updates_empty">
              {state.error}{' '}
              <button
                type="button"
                className="monday_updates_retry"
                onClick={() => updates.load(itemId, true)}
              >
                다시 시도
              </button>
            </p>
          ) : (
            <UpdatesBody data={state.data} />
          )}
        </div>
      )}
    </div>
  )
}
