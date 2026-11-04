import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { fileErrorMessage, type TechFileActions, type TechFileTarget } from '../../data/tech-file-actions'
import { checkFile, type TechFileRef } from '../../data/tech-files'

// 파일 칸 하나의 올리기·비우기·끌어다 놓기 — 세 레이아웃의 파일 칸이 같이 쓴다: 대시보드 상세 서랍(ItemFiles)·
// 수정 패널(FileField), Monday 표 파일 모달(FilesModal), 물 상세 서랍(WaterItemFiles). 모양은 저마다 그리고,
// 진행·실패·다시 시도·비우기·놓을 자리의 규칙은 여기 하나다(레이아웃은 달라도 기능은 같게).

// 진행률은 이만큼 늘 때만 다시 그린다(XHR progress가 촘촘해도 React를 덜 그리게) — 막대가 이어 준다
const PROGRESS_STEP = 0.02
// 다 올린 것이 실시간 갱신으로 목록에 들어오기를 기다리는 시간 — 늦으면 그냥 지운다(토스트가 이미 알렸다)
const DONE_HOLD_MS = 6000

let nextUploadId = 1

/** 올리는 중인 파일 하나 */
export interface FileUpload {
  id: number
  file: File
  isImage: boolean
  /** 사진이면 이 기기 안 미리보기(object URL) */
  preview: string | null
  ratio: number
  state: 'up' | 'done' | 'fail'
  error?: string
  /** 올리기 시작할 때 칸에 있던 같은 이름 파일 수 — 이보다 많아지면 올린 파일이 목록에 들어온 것 */
  before: number
}

export const uploadPercent = (u: FileUpload) => (u.state === 'done' ? 100 : Math.min(99, Math.round(u.ratio * 100)))

/** 칸 안의 짧은 상태 — 다 보낸 뒤 Monday에 붙이는 동안은 "붙이는 중…"(토스트는 99%) */
export const uploadLabel = (u: FileUpload) =>
  u.state === 'fail'
    ? '올리기 실패'
    : u.state === 'done'
      ? '올렸어요'
      : u.ratio >= 0.999
        ? '붙이는 중…'
        : `${uploadPercent(u)}%`

/**
 * 파일 칸 하나의 상태 — target이 없으면(새 항목) 올리기·비우기가 없다. 올린 파일은 칸 안에 자리(uploads)를 잡고
 * 진행률이 차오르다, 다 올라가 실시간 갱신으로 목록에 들어오면 그 자리가 빠진다(사진 미리보기는 previewOf로
 * 새 썸네일이 Monday 주소를 받을 때까지 이어 쓴다). 실패하면 그 자리에서 다시 시도·닫기 — 실패 토스트의
 * "다시 시도"도 칸이 떠 있으면 이 자리로 돌아온다.
 */
export function useFileColumn(
  target: TechFileTarget | null,
  actions: TechFileActions | undefined,
  files: readonly TechFileRef[],
) {
  const upload = target ? actions?.upload : undefined
  const clear = target ? actions?.clear : undefined
  const [list, setList] = useState<FileUpload[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })
  const previews = useRef(new Map<number, string>())
  const timers = useRef(new Set<number>())
  const mounted = useRef(false)

  // 떼어질 때 — 미리보기 주소를 돌려주고 기다리던 타이머를 끈다(올리기 자체는 뒤에서 끝까지 간다 — 토스트)
  useEffect(() => {
    mounted.current = true
    const urls = previews.current
    const waits = timers.current
    return () => {
      mounted.current = false
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
      waits.forEach((t) => window.clearTimeout(t))
      waits.clear()
    }
  }, [])

  const patch = (id: number, next: Partial<FileUpload>) =>
    setList((l) => l.map((u) => (u.id === id ? { ...u, ...next } : u)))

  const dismiss = (id: number) => {
    const url = previews.current.get(id)
    if (url) URL.revokeObjectURL(url)
    previews.current.delete(id)
    setList((l) => l.filter((u) => u.id !== id))
  }

  // 올리기 한 번(처음·다시 시도) — 같은 자리(id)에서
  const run = (id: number, file: File) => {
    if (!upload || !target) return
    let shown = 0
    // 실패 토스트의 "다시 시도" — 칸이 떠 있으면 이 자리에서, 닫혔으면 토스트만으로 다시 올린다
    const again = () => {
      if (mounted.current) retry(id, file)
      else void upload(target, file, () => {}).catch(() => {})
    }
    const onProgress = (ratio: number) => {
      if (ratio - shown < PROGRESS_STEP && ratio < 1) return
      shown = ratio
      patch(id, { ratio })
    }
    upload(target, file, onProgress, again).then(
      () => {
        patch(id, { ratio: 1, state: 'done' })
        setStatus(`${file.name} 올렸어요`)
        const t = window.setTimeout(() => {
          timers.current.delete(t)
          dismiss(id)
        }, DONE_HOLD_MS)
        timers.current.add(t)
      },
      (e: unknown) => {
        patch(id, { state: 'fail', error: fileErrorMessage(e) })
        setStatus(`${file.name} 올리기에 실패했어요: ${fileErrorMessage(e)}`)
      },
    )
  }

  const retry = (id: number, file: File) => {
    patch(id, { state: 'up', ratio: 0, error: undefined })
    run(id, file)
  }

  const start = (file: File) => {
    const id = nextUploadId++
    const isImage = file.type.startsWith('image/')
    const preview = isImage ? URL.createObjectURL(file) : null
    if (preview) previews.current.set(id, preview)
    const before = files.filter((f) => f.name === file.name).length
    setList((l) => [...l, { id, file, isImage, preview, ratio: 0, state: 'up', before }])
    run(id, file)
  }

  /** 고른·놓은 파일 — 형식·10MB 검사(checkFile)에 걸린 것은 올리지 않고 글로만 알린다 */
  const pick = (picked: FileList | readonly File[] | null) => {
    if (!picked || !upload) return
    const problems: string[] = []
    for (const file of Array.from(picked)) {
      const reason = checkFile(file)
      if (reason) problems.push(reason)
      else start(file)
    }
    setProblem(problems.length ? problems.join(' / ') : null)
  }

  /** "모두 지우기" — 확인창에서 한 번 더 누른 뒤 */
  const runClear = () => {
    setConfirming(false)
    if (!clear || !target) return
    setClearing({ busy: true, error: null })
    const again = () => (mounted.current ? runClear() : void clear(target).catch(() => {}))
    clear(target, again).then(
      () => {
        setClearing({ busy: false, error: null })
        setStatus(`${target.label} 칸을 모두 지웠어요`)
      },
      (e: unknown) => {
        setClearing({ busy: false, error: fileErrorMessage(e) })
        setStatus(`${target.label} 지우기에 실패했어요: ${fileErrorMessage(e)}`)
      },
    )
  }

  // 다 올린 것은 새 파일이 목록에 들어오면 뺀다(같은 이름 파일 수가 시작 때보다 늘면). 늦으면 DONE_HOLD_MS 뒤 지운다
  const counts = new Map<string, number>()
  for (const f of files) counts.set(f.name, (counts.get(f.name) ?? 0) + 1)
  const arrived = (u: FileUpload) => u.state === 'done' && (counts.get(u.file.name) ?? 0) > u.before
  const uploads = list.filter((u) => !arrived(u))
  const previewByName = new Map<string, string>()
  for (const u of list) if (u.preview && arrived(u)) previewByName.set(u.file.name, u.preview)

  return {
    /** 올리기·비우기를 할 수 있는지(일이 있고 항목이 있을 때) */
    canUpload: !!upload,
    canClear: !!clear,
    /** 칸 안에 그릴 올리는 중·실패·아직 목록에 안 들어온 것(올린 차례대로) */
    uploads,
    /** 방금 올려 목록에 들어온 사진의 이 기기 미리보기 — 새 썸네일이 주소를 받기 전까지 */
    previewOf: (name: string) => previewByName.get(name) ?? null,
    pick,
    retry: (u: FileUpload) => retry(u.id, u.file),
    dismiss: (u: FileUpload) => dismiss(u.id),
    /** 검사에 걸린 파일(형식·10MB) */
    problem,
    /** 읽어 주기(role=status) — 올렸어요·실패·지웠어요 */
    status,
    /** 올리는 중이거나 지우는 중(aria-busy) */
    busy: clearing.busy || uploads.some((u) => u.state === 'up'),
    clearing,
    confirming,
    askClear: () => setConfirming(true),
    cancelClear: () => setConfirming(false),
    runClear,
  }
}

const hasFiles = (e: { dataTransfer: DataTransfer | null }) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

/**
 * 끌어다 놓기 — 파일을 끌 때만 받는다(글·링크를 끌면 그대로). dropProps를 놓을 자리에 붙이고, dragging이면 놓을
 * 자리를 띄운다. 안쪽 요소를 지날 때도 켜진 채로 있게 들어오고 나간 횟수를 센다. onDrop이 null이면 꺼진다.
 * 놓을 자리가 떠 있는 동안은 자리 밖에 떨어뜨려도 브라우저가 파일을 열어(화면을 떠나) 버리지 않게 막는다.
 */
export function useFileDrop(onDrop: ((files: FileList, e: ReactDragEvent<HTMLElement>) => void) | null) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const enabled = onDrop !== null

  useEffect(() => {
    if (!enabled) return
    // 놓을 자리가 먼저 받으면(preventDefault) 그대로 둔다 — 밖이면 놓을 수 없음(커서)·떨어뜨려도 아무 일 없음
    const guard = (e: DragEvent) => {
      if (e.defaultPrevented || !hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
      if (e.type === 'drop') {
        depth.current = 0
        setDragging(false)
      }
    }
    window.addEventListener('dragover', guard)
    window.addEventListener('drop', guard)
    return () => {
      window.removeEventListener('dragover', guard)
      window.removeEventListener('drop', guard)
    }
  }, [enabled])

  const dropProps = onDrop
    ? {
        onDragEnter: (e: ReactDragEvent<HTMLElement>) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          depth.current += 1
          setDragging(true)
        },
        onDragOver: (e: ReactDragEvent<HTMLElement>) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        },
        // 나갈 때는 무엇을 끄는지 묻지 않는다 — 끌기를 그만두거나 밖에서 놓아도 놓을 자리가 남지 않게
        onDragLeave: () => {
          if (depth.current === 0) return
          depth.current -= 1
          if (depth.current === 0) setDragging(false)
        },
        onDrop: (e: ReactDragEvent<HTMLElement>) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          depth.current = 0
          setDragging(false)
          onDrop(e.dataTransfer.files, e)
        },
      }
    : {}

  return { dragging: enabled && dragging, dropProps }
}
