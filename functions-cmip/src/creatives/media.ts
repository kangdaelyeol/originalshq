// 소재 파일 처리 — 내려받아 원본을 Storage에 두고, 분석용 프레임(긴 변 768px
// JPEG)을 ffmpeg로 뽑아 같이 둔다. 영상은 framePlan 시점마다(첫 3초 촘촘히),
// 이미지는 한 장. Claude는 영상을 직접 받지 않아서 분석은 이 프레임으로 한다.
import { execFile } from 'node:child_process'
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
export async function processCreativeMedia(
  id: string,
  kind: CreativeKind,
  url: string,
  knownLengthSec: number | null,
): Promise<CreativeMedia> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`파일 내려받기 실패(HTTP ${res.status})`)
  const length = Number(res.headers.get('content-length') ?? 0)
  if (length > MAX_BYTES) throw new Error(`파일이 너무 큽니다(${length} bytes)`)
  const contentType =
    res.headers.get('content-type') ??
    (kind === 'video' ? 'video/mp4' : 'image/jpeg')
  const body = Buffer.from(await res.arrayBuffer())

  const dir = await mkdtemp(join(tmpdir(), 'creative-'))
  try {
    const input = join(dir, `original.${extOf(contentType)}`)
    await writeFile(input, body)
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

    const bucket = getStorage().bucket()
    const base = `adCreatives/${id}`
    const originalPath = `${base}/original.${extOf(contentType)}`
    await bucket
      .file(originalPath)
      .save(body, { contentType, resumable: false })

    const uploaded: CreativeFrame[] = []
    for (const [index, frame] of frames.entries()) {
      const data = await readFile(frame.file)
      const size = await probe(frame.file)
      const path = `${base}/frames/${String(index).padStart(2, '0')}.jpg`
      await bucket
        .file(path)
        .save(data, { contentType: 'image/jpeg', resumable: false })
      uploaded.push({
        t: frame.t,
        path,
        width: size.width ?? 0,
        height: size.height ?? 0,
      })
    }

    return {
      originalPath,
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
