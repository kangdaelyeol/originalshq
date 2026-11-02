import type { MorphShapeName } from './morph-shapes'

// 영상 속 카드 네 장의 글. 줄바꿈도 영상 그대로(제목이 두 줄로 꺾이는 자리).

export interface MotionCardText {
  no: string
  /** 한글 제목 — 줄마다 */
  title: string[]
  /** 영문 제목 — 줄마다 */
  titleEn: string[]
  caption: string
  captionEn: string
}

export const D10_CARDS = {
  squash: {
    no: '01',
    title: ['스퀴시 앤', '스트레치'],
    titleEn: ['Squash &', 'Stretch'],
    caption: '눌리고 늘어나는 탄성',
    captionEn: 'Squash, stretch, spring back',
  },
  bounce: {
    no: '02',
    title: ['바운스'],
    titleEn: ['Bounce'],
    caption: '공처럼 통통 튀는 움직임',
    captionEn: 'Bounce like a ball',
  },
  scramble: {
    no: '03',
    title: ['텍스트', '스크램블'],
    titleEn: ['Text', 'Scramble'],
    caption: '뒤섞인 문자가 하나씩 완성',
    captionEn: 'Shuffled letters reveal a word',
  },
  morph: {
    no: '04',
    title: ['모핑'],
    titleEn: ['Morphing'],
    caption: '하나의 모양이 다른 모양으로',
    captionEn: 'One shape turns into another',
  },
} satisfies Record<string, MotionCardText>

/** 스크램블로 맞춰지는 단어(영상: DOYOUNG) */
export const D10_SCRAMBLE_WORD = 'DOYOUNG'

/** 부품 견본 — 모양 두 개만 오가는 모핑(1초씩) */
export const D10_PART_MORPH: { shapes: readonly MorphShapeName[]; stops: readonly number[] } = {
  shapes: ['star', 'circle'],
  stops: [0, 1],
}
