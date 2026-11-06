import { DIGIT_ROLL_MS, EASE_OUT_QUART } from './d15-motion'

interface Slot {
  strip: HTMLSpanElement
  ch: string
  anim: Animation | null
}

const glyph = (ch: string) => {
  const s = document.createElement('span')
  s.textContent = ch
  return s
}

/**
 * 숫자 굴림 — 바뀐 자리만 옛 숫자와 새 숫자를 한 띠로 붙여 위로 한 줄 올린다(F166~F176: 띠 간격 = 글자 높이
 * 1.72배, easeOutQuart 0.42초). 자리는 root 안에 직접 만든다(root에는 React 자식이 없다).
 */
export class DigitRoller {
  #root: HTMLElement
  #slots: Slot[] = []

  constructor(root: HTMLElement) {
    this.#root = root
  }

  set(text: string, animate: boolean) {
    if (this.#slots.length !== text.length) this.#build(text)
    for (let i = 0; i < text.length; i++) {
      const slot = this.#slots[i]
      const ch = text[i]
      if (slot.ch === ch) continue
      const old = slot.ch
      slot.ch = ch
      slot.anim?.cancel()
      if (!animate || !/\d/.test(ch)) {
        slot.strip.replaceChildren(glyph(ch))
        continue
      }
      slot.strip.replaceChildren(glyph(old), glyph(ch))
      const anim = slot.strip.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-50%)' }], {
        duration: DIGIT_ROLL_MS,
        easing: EASE_OUT_QUART,
      })
      slot.anim = anim
      anim.onfinish = () => {
        if (slot.anim !== anim) return
        slot.anim = null
        slot.strip.replaceChildren(glyph(slot.ch))
      }
    }
  }

  #build(text: string) {
    this.#slots.forEach((s) => s.anim?.cancel())
    this.#slots = []
    const nodes: HTMLElement[] = []
    for (const ch of text) {
      const box = document.createElement('span')
      box.className = /\d/.test(ch) ? 'd15-roll' : 'd15-roll is-sep'
      const strip = document.createElement('span')
      strip.className = 'd15-roll__strip'
      strip.append(glyph(ch))
      box.append(strip)
      nodes.push(box)
      this.#slots.push({ strip, ch, anim: null })
    }
    this.#root.replaceChildren(...nodes)
  }
}
