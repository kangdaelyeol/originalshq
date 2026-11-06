import { cx } from '../../../../lib/cx'
import { SPEECH_TAGS, type SpeechTag, type VoiceSpeaker } from './voice-script'

interface SpeechBubbleProps {
  /** 글 — typed가 있으면 앞에서부터 그만큼만 보인다 */
  text: string
  /** 보이는 글자 수(없으면 전부) */
  typed?: number
  /** 꼬리표를 고른다(tags가 없을 때). null이면 꼬리표 없음 */
  speaker: VoiceSpeaker | null
  /** 꼬리표를 직접 줄 때 */
  tags?: readonly SpeechTag[]
  /** 블록 커서 — 영상에선 깜박이지 않고 늘 켜져 있다(F289~F679). 기본 true */
  caret?: boolean
  className?: string
}

/**
 * 구슬 위 말풍선 — 너비 고정(33.6em), 글이 길면 위로 자란다(아래 끝이 제자리). 글은 가운데 맞춤에
 * text-wrap: pretty(크롬 — 마지막 줄 외톨이 단어를 한 단어 내려 줄이 바뀐다, F429 "I ran / our bi").
 * 커서는 글 덩어리 오른쪽의 flex 칸이라 한 줄이면 글 끝에 붙고, 줄이 넘치면 오른쪽 가운데에 선다(F429·F503·F584).
 * 높이는 줄 수대로 바로 바뀌고(F428 → F429 한 프레임) 턴이 바뀌어도 넘어가는 움직임 없이 비었다 다시 친다.
 * 꼬리표 줄은 상자 아래 테두리에 가운데가 걸린다. 요소의 아래 끝 = 상자 아래 끝 — 부모가 그 자리를 잡는다.
 */
export function SpeechBubble({ text, typed, speaker, tags, caret = true, className }: SpeechBubbleProps) {
  const shown = typed === undefined ? text : text.slice(0, Math.max(0, typed))
  const list = tags ?? (speaker ? SPEECH_TAGS[speaker] : [])
  return (
    <div className={cx('d14v-bubble', className)}>
      <div className="d14v-bubble__box">
        <p className="d14v-bubble__text" lang="en">
          {shown}
        </p>
        {caret && <span className="d14v-bubble__caret" aria-hidden />}
      </div>
      {list.length > 0 && (
        <div className="d14v-bubble__tags" lang="en">
          {list.map((tag) => (
            <span key={tag.label} className={cx('d14v-tag', `d14v-tag--${tag.tone}`)}>
              {tag.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
