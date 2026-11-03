/** className 합치기 — 거짓 값은 건너뛴다. */
export const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ')
