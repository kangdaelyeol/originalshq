export const FRAME_COUNT = 552
export const MOTION_COUNT = 277
export const MOTION_CAPACITY = 48
export const MOTION_COLUMNS = 8
const MOTION_SHEETS = Math.ceil(MOTION_COUNT / MOTION_CAPACITY)

export type SequenceTile<T> = {
  image: T
  frame: number
  cell: number
  detail: boolean
}
type Options<T> = {
  loadMotion: (sheet: number) => Promise<T>
  loadDetail: (sheet: number) => Promise<T>
  paint: (tile: SequenceTile<T>) => void
  status?: (motion: number, detail: number) => void
}

/** The complete lightweight sequence remains resident. Detail requests never block motion. */
export function createScrollSequence<T>(options: Options<T>) {
  const motion = new Map<number, T>(),
    detail = new Map<number, T>()
  const pending = new Set<number>(),
    failed = new Map<number, number>()
  let target = 0,
    wantsDetail = false,
    detailPending = false,
    disposed = false
  let lastFrame = -1,
    lastDetail = false
  const motionIndex = () =>
    target === 551 ? 276 : Math.min(275, Math.round(target / 2))
  const report = () => options.status?.(motion.size, detail.size)

  const present = () => {
    if (disposed) return
    const detailed = wantsDetail && detail.get(Math.floor(target / 4))
    if (detailed) {
      if (lastFrame === target && lastDetail) return
      options.paint({
        image: detailed,
        frame: target,
        cell: target % 4,
        detail: true,
      })
      lastFrame = target
      lastDetail = true
      return
    }
    const index = motionIndex(),
      sheet = Math.floor(index / MOTION_CAPACITY)
    const image = motion.get(sheet)
    if (!image) return // Keep the last complete picture during initial preparation only.
    const frame = index === 276 ? 551 : index * 2
    if (lastFrame === frame && !lastDetail) return
    options.paint({
      image,
      frame,
      cell: index % MOTION_CAPACITY,
      detail: false,
    })
    lastFrame = frame
    lastDetail = false
  }

  const pump = () => {
    if (disposed) return
    const first = Math.floor(motionIndex() / MOTION_CAPACITY)
    const order = [
      first,
      ...Array.from({ length: MOTION_SHEETS }, (_, i) => i).filter(
        (i) => i !== first,
      ),
    ]
    for (const index of order) {
      if (pending.size >= 3) break
      if (
        motion.has(index) ||
        pending.has(index) ||
        Date.now() - (failed.get(index) ?? 0) < 2500
      )
        continue
      pending.add(index)
      options
        .loadMotion(index)
        .then((image) => {
          if (disposed) return
          motion.set(index, image)
          report()
          present()
        })
        .catch(() => {
          failed.set(index, Date.now())
        })
        .finally(() => {
          pending.delete(index)
          if (!disposed) pump()
        })
    }
  }

  const refine = () => {
    if (disposed || !wantsDetail) return
    present()
    const sheet = Math.floor(target / 4)
    if (
      detail.has(sheet) ||
      detailPending ||
      Date.now() - (failed.get(sheet + 1000) ?? 0) < 2500
    )
      return
    detailPending = true
    options
      .loadDetail(sheet)
      .then((image) => {
        if (disposed) return
        detail.delete(sheet)
        detail.set(sheet, image)
        while (detail.size > 2) detail.delete(detail.keys().next().value!)
        report()
        present()
      })
      .catch(() => {
        failed.set(sheet + 1000, Date.now())
      })
      .finally(() => {
        detailPending = false
        // Resolve an obsolete request without ever painting its old scroll position.
        if (!disposed && wantsDetail && Math.floor(target / 4) !== sheet)
          refine()
      })
  }

  return {
    seek(frame: number) {
      const next = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(frame)))
      if (next !== target) wantsDetail = false
      target = next
      present()
      pump()
    },
    refine() {
      wantsDetail = true
      refine()
    },
    resume() {
      failed.clear()
      pump()
      if (wantsDetail) refine()
    },
    dispose() {
      disposed = true
      motion.clear()
      detail.clear()
      pending.clear()
    },
  }
}
