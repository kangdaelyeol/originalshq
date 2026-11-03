// 소재 파일 처리 — 내려받아(HLS 스트리밍이면 조각을 받아 mp4 한 파일로) 원본을
// Storage에 두고, 분석용 프레임(긴 변 768px JPEG)을 ffmpeg로 뽑아 같이 둔다.
// 내려받기는 늘 Node가 하고 ffmpeg는 로컬 파일만 다룬다(fetchHls 참고). 영상은 framePlan 시점마다(첫 3초 촘촘히),
// 이미지는 한 장. Claude는 영상을 직접 받지 않아서 분석은 이 프레임으로 한다.
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { getStorage } from 'firebase-admin/storage'
import ffmpegPath from 'ffmpeg-static'
import { FRAME_LONG_SIDE, framePlan } from '../creative-analysis'
import type { CreativeFrame, CreativeKind, CreativeMedia } from './types'

const run = promisify(execFile)

// 함수 메모리 안의 임시 폴더에 받으므로 너무 큰 파일은 받지 않는다(지금 Meta
// 영상은 1~4MB).
const MAX_BYTES = 200 * 1024 * 1024

const ffmpeg = () => {
  if (!ffmpegPath) throw new Error('ffmpeg 실행 파일을 찾지 못했습니다')
  return ffmpegPath
}

/** 긴 변을 FRAME_LONG_SIDE로 줄인다(작으면 그대로). 짝수로 맞춘다. */
const SCALE =
  `scale='if(gte(iw,ih),min(${FRAME_LONG_SIDE},iw),-2)'` +
  `:'if(gte(iw,ih),-2,min(${FRAME_LONG_SIDE},ih))'`

/** ffmpeg -i의 안내 문구에서 길이·크기를 읽는다(ffprobe가 없어서). */
const probe = async (file: string) => {
  const out = await run(ffmpeg(), ['-hide_banner', '-i', file]).catch(
    (err: { stderr?: string }) => ({ stderr: err.stderr ?? '' }),
  )
  const text = out.stderr ?? ''
  const d = text.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/)
  const size = text.match(/Stream #.*?Video:.*?(\d{2,5})x(\d{2,5})/)
  return {
    lengthSec: d
      ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3])
      : null,
    width: size ? Number(size[1]) : null,
    height: size ? Number(size[2]) : null,
  }
}

const extOf = (contentType: string) =>
  contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('mp4')
        ? 'mp4'
        : contentType.startsWith('video/')
          ? 'video'
          : 'jpg'

/** 기본 Storage 버킷이 없어서 난 오류인지 — 콘솔에서 Storage를 안 켰으면 모든
 * 소재가 같은 이유로 실패하므로, 소재마다 실패를 세지 않고 실행을 멈춘다. */
export const isMissingBucket = (err: unknown) =>
  err instanceof Error && /bucket does not exist/i.test(err.message)

/**
 * 소재 하나를 처리한다 — url에서 내려받아 Storage의 adCreatives/{id}/에 원본과
 * frames/를 올린다. 같은 id로 다시 돌리면 덮어쓴다.
 */
/** 화면에서 볼 주소 — Storage 규칙은 외부 읽기를 다 막아 두고, 파일마다 붙인
 * 다운로드 토큰으로만 열리게 한다(Firebase 콘솔의 "다운로드 URL"과 같은 방식,
 * 추측할 수 없는 주소). 광고 소재는 이미 광고로 공개된 이미지·영상이다. */
const downloadUrl = (bucket: string, path: string, token: string) => {
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST
  const base = host
    ? `http://${host}`
    : 'https://firebasestorage.googleapis.com'
  return `${base}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
}

/** 저장하면서 토큰을 붙이고 그 주소를 돌려준다. */
async function saveWithUrl(
  path: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const bucket = getStorage().bucket()
  const token = randomUUID()
  await bucket.file(path).save(data, {
    contentType,
    resumable: false,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  })
  return downloadUrl(bucket.name, path, token)
}

/** 주소가 없는(토큰을 붙이기 전에 저장한) 소재에 토큰을 붙여 주소를 채운다 —
 * 바뀌었으면 새 media, 이미 다 있으면 null. 파일마다 토큰을 새로 붙이기만
 * 한다(읽어 보지 않고 — 이 주소를 쓰는 곳은 이 문서뿐이라 덮어써도 된다). */
export async function withDownloadUrls(
  media: CreativeMedia,
): Promise<CreativeMedia | null> {
  if (media.originalUrl && media.frames.every((f) => f.url)) return null
  const bucket = getStorage().bucket()
  const urlOf = async (path: string) => {
    const token = randomUUID()
    await bucket
      .file(path)
      .setMetadata({ metadata: { firebaseStorageDownloadTokens: token } })
    return downloadUrl(bucket.name, path, token)
  }
  return {
    ...media,
    originalUrl: media.originalUrl ?? (await urlOf(media.originalPath)),
    frames: await Promise.all(
      media.frames.map(async (f) => ({
        ...f,
        url: f.url ?? (await urlOf(f.path)),
      })),
    ),
  }
}

/** 파일 주소 — hls면 스트리밍 목록(.m3u8, 당근 영상)이라 ffmpeg로 mp4 한
 * 파일로 받는다. */
export interface MediaSource {
  url: string
  lengthSec: number | null
  hls?: boolean
}

/** 목록을 받는다 — 당근 재생 주소는 서명된 다른 주소로 넘어가므로(301), 조각
 * 주소는 넘어간 뒤의 최종 주소(res.url)를 기준으로 만들어야 한다. */
const fetchPlaylist = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HLS 목록 받기 실패(HTTP ${res.status})`)
  return { text: await res.text(), url: res.url || url }
}

/** 목록의 URI 줄들(주석·빈 줄 제외)을 목록 주소 기준 절대 주소로. */
const uriLines = (text: string, base: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => new URL(l, base).toString())

/**
 * HLS 스트림을 한 파일로 받는다 — 화질이 여러 개인 목록(master)이면 가장 높은
 * 대역폭을 고르고, 조각(.ts)을 차례로 받아 이어 붙인다(MPEG-TS는 그대로 이어
 * 붙여도 된다). fMP4 조각이면 초기화 조각(EXT-X-MAP)을 앞에 붙인다. 암호화된
 * 스트림은 받지 않는다.
 */
async function fetchHls(
  url: string,
  dir: string,
): Promise<{ ext: 'ts' | 'mp4' }> {
  let { text, url: playlistUrl } = await fetchPlaylist(url)
  if (text.includes('#EXT-X-STREAM-INF')) {
    const lines = text.split('\n').map((l) => l.trim())
    let best: { bandwidth: number; uri: string } | null = null
    for (const [i, line] of lines.entries()) {
      if (!line.startsWith('#EXT-X-STREAM-INF')) continue
      const bandwidth = Number(line.match(/BANDWIDTH=(\d+)/)?.[1] ?? 0)
      const uri = lines.slice(i + 1).find((l) => l && !l.startsWith('#'))
      if (uri && (!best || bandwidth > best.bandwidth))
        best = { bandwidth, uri }
    }
    if (!best) throw new Error('HLS 목록에 재생할 화질이 없습니다')
    ;({ text, url: playlistUrl } = await fetchPlaylist(
      new URL(best.uri, playlistUrl).toString(),
    ))
  }
  if (/#EXT-X-KEY:(?!.*METHOD=NONE)/.test(text))
    throw new Error('암호화된 HLS 영상은 받을 수 없습니다')

  const map = text.match(/#EXT-X-MAP:.*URI="([^"]+)"/)?.[1]
  const parts = [
    ...(map ? [new URL(map, playlistUrl).toString()] : []),
    ...uriLines(text, playlistUrl),
  ]
  if (parts.length === 0) throw new Error('HLS 목록에 조각이 없습니다')

  const chunks: Buffer[] = []
  let bytes = 0
  for (const part of parts) {
    const res = await fetch(part)
    if (!res.ok) throw new Error(`HLS 조각 받기 실패(HTTP ${res.status})`)
    const chunk = Buffer.from(await res.arrayBuffer())
    bytes += chunk.length
    if (bytes > MAX_BYTES) throw new Error(`파일이 너무 큽니다(${bytes} bytes)`)
    chunks.push(chunk)
  }
  const ext = map ? 'mp4' : 'ts'
  await writeFile(join(dir, `stream.${ext}`), Buffer.concat(chunks))
  return { ext }
}

/** 원본을 임시 폴더에 받는다 — 일반 파일은 그대로, HLS는 스트림을 복사해 mp4로. */
async function download(
  dir: string,
  kind: CreativeKind,
  source: MediaSource,
): Promise<{ input: string; body: Buffer; contentType: string }> {
  if (source.hls) {
    // 조각은 Node가 받고 ffmpeg에는 로컬 파일만 준다 — 운영(리눅스)의 정적
    // 빌드 ffmpeg는 네트워크 주소를 직접 열면 이름 찾기(DNS)에서 죽는다
    // (signal 11, 2026-11-03 당근 영상).
    const stream = join(dir, `stream.${(await fetchHls(source.url, dir)).ext}`)
    const input = join(dir, 'original.mp4')
    // 다시 인코딩하지 않고 그대로 mp4에 담는다(-c copy). AAC 오디오는 mp4에
    // 넣으려면 비트스트림 변환이 필요하다.
    try {
      await run(ffmpeg(), [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        stream,
        '-c',
        'copy',
        '-bsf:a',
        'aac_adtstoasc',
        '-y',
        input,
      ])
    } catch (err) {
      // 명령 줄 전체 대신 ffmpeg가 남긴 마지막 오류 한 줄만.
      const stderr = (err as { stderr?: string }).stderr?.trim() ?? ''
      throw new Error(
        `HLS 영상 변환 실패 — ${stderr.split('\n').pop() || '알 수 없는 오류'}`,
      )
    }
    const body = await readFile(input)
    return { input, body, contentType: 'video/mp4' }
  }
  const res = await fetch(source.url)
  if (!res.ok) throw new Error(`파일 내려받기 실패(HTTP ${res.status})`)
  const length = Number(res.headers.get('content-length') ?? 0)
  if (length > MAX_BYTES) throw new Error(`파일이 너무 큽니다(${length} bytes)`)
  const contentType =
    res.headers.get('content-type') ??
    (kind === 'video' ? 'video/mp4' : 'image/jpeg')
  const body = Buffer.from(await res.arrayBuffer())
  const input = join(dir, `original.${extOf(contentType)}`)
  await writeFile(input, body)
  return { input, body, contentType }
}

export async function processCreativeMedia(
  id: string,
  kind: CreativeKind,
  source: MediaSource,
): Promise<CreativeMedia> {
  const dir = await mkdtemp(join(tmpdir(), 'creative-'))
  try {
    const { input, body, contentType } = await download(dir, kind, source)
    const knownLengthSec = source.lengthSec
    const info = await probe(input)
    const lengthSec =
      kind === 'video' ? (knownLengthSec ?? info.lengthSec) : null

    // 프레임 — 시점마다 한 장(-ss를 -i 앞에 두면 그 근처로 바로 건너뛴다).
    const times = kind === 'video' ? framePlan(lengthSec ?? 0) : [0]
    const frames: { t: number; file: string }[] = []
    for (const [index, t] of times.entries()) {
      const file = join(dir, `frame-${index}.jpg`)
      const args =
        kind === 'video'
          ? ['-ss', String(t), '-i', input, '-frames:v', '1']
          : ['-i', input, '-frames:v', '1']
      await run(ffmpeg(), [
        '-hide_banner',
        '-loglevel',
        'error',
        ...args,
        '-vf',
        SCALE,
        '-q:v',
        '3',
        '-y',
        file,
      ])
      // 영상 끝을 넘은 시점이면 파일이 안 생긴다 — 건너뛴다.
      if (await stat(file).catch(() => null)) frames.push({ t, file })
    }
    if (frames.length === 0) throw new Error('프레임을 하나도 뽑지 못했습니다')

    const base = `adCreatives/${id}`
    const originalPath = `${base}/original.${extOf(contentType)}`
    const originalUrl = await saveWithUrl(originalPath, body, contentType)

    const uploaded: CreativeFrame[] = []
    for (const [index, frame] of frames.entries()) {
      const data = await readFile(frame.file)
      const size = await probe(frame.file)
      const path = `${base}/frames/${String(index).padStart(2, '0')}.jpg`
      const url = await saveWithUrl(path, data, 'image/jpeg')
      uploaded.push({
        t: frame.t,
        path,
        url,
        width: size.width ?? 0,
        height: size.height ?? 0,
      })
    }

    return {
      originalPath,
      originalUrl,
      contentType,
      bytes: body.length,
      width: info.width,
      height: info.height,
      lengthSec,
      frames: uploaded,
      processedAt: Date.now(),
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
