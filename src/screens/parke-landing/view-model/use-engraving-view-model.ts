import { useState } from 'react'

/** Longest text the lettering area holds at full size, in the units below. */
const LETTERING_CAPACITY = 26
const LETTERING_MAX_SIZE = 3.1

/*
 * Engraving preview controller.
 *
 * Holds the phrase being typed and works out how large it can be drawn on the
 * product render. The size is in `cqw`, so it scales with the render itself.
 */
export const useEngravingViewModel = (initial: string) => {
  const [engraving, setEngraving] = useState(initial)
  const preview = engraving.trim() || 'Parké'
  // Full-width Korean characters need more room than Latin letters. Keep the
  // preview inside the logo area even at the longest accepted input length.
  const textUnits = Array.from(preview).reduce(
    (sum, char) =>
      sum +
      (/\s/u.test(char) ? 0.36 : /[ -ɏ]/u.test(char) ? 0.78 : 1.08),
    0,
  )

  return {
    state: {
      engraving,
      preview,
      letteringSize: `${Math.min(LETTERING_MAX_SIZE, LETTERING_CAPACITY / textUnits)}cqw`,
    },
    actions: { setEngraving },
  }
}
