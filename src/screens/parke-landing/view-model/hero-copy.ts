/*
 * Intro headline timeline.
 *
 * Three headline blocks sit over the hero canvas and hand off to each other as
 * the scroll sequence plays. Everything that decides *what* they say and
 * *when* they are on screen lives here; the hero component only reads it.
 *
 * Times are in **film-time seconds**, the same clock the sprite sequence runs
 * on: `time = frame / 24`, and the whole film is 552 frames (0 - 22.96s). So
 * `at: 6.35` means "6.35 seconds into the sequence", which the reader reaches
 * by scrolling, not by waiting.
 *
 * To retime a block, change `enter` / `exit`. To add one, add an entry and a
 * matching gap in its neighbours — nothing else needs to know.
 */

/** A crossfade: start at `at` seconds, take `over` seconds to finish. */
export type Fade = { at: number; over: number }

export type HeroCue = {
  /** Small caps line above the headline. */
  label: string
  /** Headline, rendered as two lines with a <br/> between. */
  heading: [string, string]
  /** Supporting sentence under the headline. */
  description: string
  /** Fade in. `null` means it is already on screen at frame 0. */
  enter: Fade | null
  /** Fade out. `null` means it stays until the end of the sequence. */
  exit: Fade | null
}

export const HERO_COPY: HeroCue[] = [
  {
    label: 'Parké · 파르케',
    heading: ['앱을 열지 않아도.', '연락 대상은 알아서.'],
    description:
      '등록된 운전자를 인식해 주차 연락 대상을 자동으로 바꾸는 주차번호판.',
    enter: { at: 4, over: 1.6 },
    exit: { at: 6.35, over: 0.6 },
  },
  {
    label: '한 대의 차를 함께 쓰는 가족에게',
    heading: ['QR은 그대로.', '운전자는 바뀌어도.'],
    description: '번호판을 바꿔 끼우지 않아도, 지금 차를 사용하는 사람에게.',
    enter: { at: 8.95, over: 0.6 },
    exit: { at: 16.1, over: 0.6 },
  },
  {
    label: '우리 차의 주차 연락',
    heading: ['차를 가져간 사람에게.', '연락이 닿도록.'],
    description: '차에서 내려도 마지막으로 인식된 연락 대상은 유지됩니다.',
    enter: { at: 19.7, over: 0.7 },
    exit: null,
  },
]

/** Smoothstep: 0 before the fade, 1 after it, eased in between. */
const smoothstep = (x: number) => {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}

const progressThrough = (fade: Fade | null, time: number, idle: number) =>
  fade ? smoothstep((time - fade.at) / fade.over) : idle

/** How opaque this cue is at the given film time, 0 - 1. */
export const heroCueOpacity = (cue: HeroCue, time: number) =>
  progressThrough(cue.enter, time, 1) * (1 - progressThrough(cue.exit, time, 0))

/**
 * Film time at which the opening cue starts to fade.
 *
 * The intro autoplay stops here, so the reader is handed control while the
 * first headline is still fully legible rather than watching it dissolve on
 * its own. Retiming the first cue's `exit` moves the autoplay with it.
 */
export const OPENING_FADE_S = HERO_COPY[0].exit?.at ?? 0
