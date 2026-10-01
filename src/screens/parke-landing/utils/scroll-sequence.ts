export const FRAME_COUNT = 552
export const MOTION_COUNT = 277
export const MOTION_CAPACITY = 48
export const MOTION_COLUMNS = 8
const MOTION_SHEETS = Math.ceil(MOTION_COUNT / MOTION_CAPACITY)

/** Frames packed into one detail sheet, and the grid they sit in. */
export const DETAIL_CAPACITY = 4
export const DETAIL_COLUMNS = 2

/* Sliding detail window.
 *
 * Detail sheets carry one frame per canvas pixel; motion sheets carry a
 * quarter of that, stretched. All 138 detail sheets would be ~2GB decoded, so
 * only a window around the playhead is kept, biased towards the scroll
 * direction because that is where the playhead is about to be. Anything the
 * window cannot supply in time falls back to the resident motion tier, which
 * is why fast scrolling is soft and deliberate scrolling is sharp. */
const DETAIL_AHEAD = 16
const DETAIL_BEHIND = 4
/** Decoded sheets held at once. The window spans exactly 6 sheets, so this
 * leaves one of hysteresis — a reversal does not immediately refetch. Costs
 * ~14.7MB per sheet on desktop, ~8.3MB on mobile. */
const DETAIL_BUDGET = 7
/** Detail fetches in flight. Kept low so they never crowd out motion sheets. */
const DETAIL_PARALLEL = 3
/** Frames the playhead must travel against the current direction before the
 * window turns around. Without it a trackpad wobble flips the window every
 * frame, and each flip asks for the sheets on the other side. */
const DIRECTION_FLIP = 8
/** Detail keys share the `failed` map with motion keys; offset keeps them apart. */
const DETAIL_FAIL_KEY = 1000
const RETRY_AFTER = 2500

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
  /** Called the moment a sheet stops being needed, so the caller can free the
   * decoded buffer deterministically instead of waiting for GC. */
  release?: (image: T) => void
}

/** The complete lightweight sequence remains resident. Detail requests never block motion. */
export function createScrollSequence<T>(options: Options<T>) {
  const motion = new Map<number, T>(),
    detail = new Map<number, T>()
  const pending = new Set<number>(),
    detailPending = new Set<number>(),
    failed = new Map<number, number>()
  let target = 0,
    direction = 1,
    /** Furthest frame reached since the direction last turned. */
    pivot = 0,
    disposed = false
  let lastFrame = -1,
    lastDetail = false
  const motionIndex = () =>
    target === 551 ? 276 : Math.min(275, Math.round(target / 2))
  const report = () => options.status?.(motion.size, detail.size)
  const drop = (store: Map<number, T>, key: number) => {
    const image = store.get(key)
    if (image === undefined) return
    store.delete(key)
    options.release?.(image)
  }
  const detailSheet = (frame: number) => Math.floor(frame / DETAIL_CAPACITY)
  const reach = () =>
    direction >= 0
      ? { ahead: DETAIL_AHEAD, behind: DETAIL_BEHIND }
      : { ahead: DETAIL_BEHIND, behind: DETAIL_AHEAD }
  /** How badly this sheet is wanted: 0 covers the playhead, <= 1 is inside the
   * window, > 1 is outside it. Distance is divided by the runway the window
   * allows on that side, so the measure is as lopsided as the window itself.
   * A plain frame distance is not usable here — it rates a sheet 16 frames
   * ahead (inside the window) worse than one 9 frames behind (outside it), so
   * eviction would throw away the sheet the playhead is heading for and
   * refetch it forever. */
  const cost = (sheet: number) => {
    const first = sheet * DETAIL_CAPACITY,
      last = first + DETAIL_CAPACITY - 1
    if (target >= first && target <= last) return 0
    const { ahead, behind } = reach()
    return target < first
      ? (first - target) / ahead
      : (target - last) / behind
  }
  /** Sheets the window wants right now, most wanted first. The window spans at
   * most 6 sheets, one under DETAIL_BUDGET, so trim always has something
   * outside the window to drop. */
  const wanted = () => {
    const { ahead, behind } = reach()
    const first = detailSheet(Math.max(0, target - behind))
    const last = detailSheet(Math.min(FRAME_COUNT - 1, target + ahead))
    const sheets: number[] = []
    for (let sheet = first; sheet <= last; sheet += 1) sheets.push(sheet)
    return sheets.sort((a, b) => cost(a) - cost(b))
  }

  const present = () => {
    if (disposed) return
    // Whatever the window has for this exact frame wins; otherwise the motion
    // tier, which is always resident, carries the scroll.
    const detailed = detail.get(detailSheet(target))
    if (detailed) {
      if (lastFrame === target && lastDetail) return
      options.paint({
        image: detailed,
        frame: target,
        cell: target % DETAIL_CAPACITY,
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
        Date.now() - (failed.get(index) ?? 0) < RETRY_AFTER
      )
        continue
      pending.add(index)
      options
        .loadMotion(index)
        .then((image) => {
          if (disposed) {
            options.release?.(image)
            return
          }
          motion.set(index, image)
          report()
          present()
          pumpDetail()
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

  /** Evict the least wanted sheet, not the oldest: after a reversal the sheet
   * just scrolled past is the one most likely to be needed again. */
  const trim = () => {
    while (detail.size > DETAIL_BUDGET) {
      let worst = -1,
        worstCost = -1
      for (const sheet of detail.keys()) {
        const c = cost(sheet)
        if (c > worstCost) {
          worstCost = c
          worst = sheet
        }
      }
      if (worst < 0) break
      drop(detail, worst)
    }
  }

  const pumpDetail = () => {
    if (disposed) return
    // Detail never competes with the motion tier for the frame on screen:
    // until this position's motion sheet is resident the canvas has nothing
    // to fall back on, so that download gets the bandwidth to itself.
    if (!motion.has(Math.floor(motionIndex() / MOTION_CAPACITY))) return
    for (const sheet of wanted()) {
      if (detailPending.size >= DETAIL_PARALLEL) break
      if (
        detail.has(sheet) ||
        detailPending.has(sheet) ||
        Date.now() - (failed.get(sheet + DETAIL_FAIL_KEY) ?? 0) < RETRY_AFTER
      )
        continue
      detailPending.add(sheet)
      options
        .loadDetail(sheet)
        .then((image) => {
          // The window may have moved past this sheet while it was in flight.
          if (disposed || cost(sheet) > 1) {
            options.release?.(image)
            return
          }
          drop(detail, sheet)
          detail.set(sheet, image)
          trim()
          report()
          present()
        })
        .catch(() => {
          failed.set(sheet + DETAIL_FAIL_KEY, Date.now())
        })
        .finally(() => {
          detailPending.delete(sheet)
          if (!disposed) pumpDetail()
        })
    }
  }

  return {
    seek(frame: number) {
      const next = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(frame)))
      if ((next - pivot) * direction > 0) pivot = next
      else if (Math.abs(next - pivot) >= DIRECTION_FLIP) {
        direction = -direction
        pivot = next
      }
      target = next
      present()
      pump()
      pumpDetail()
      trim()
    },
    /** Called once scrolling rests. The window is already being filled during
     * the scroll; this tops it up now that the direction bias no longer
     * matters, and retries anything that was skipped while in flight. */
    refine() {
      if (disposed) return
      present()
      pumpDetail()
    },
    resume() {
      failed.clear()
      pump()
      pumpDetail()
    },
    dispose() {
      disposed = true
      for (const key of [...motion.keys()]) drop(motion, key)
      for (const key of [...detail.keys()]) drop(detail, key)
      pending.clear()
      detailPending.clear()
    },
  }
}
