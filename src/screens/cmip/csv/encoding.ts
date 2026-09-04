/**
 * 인코딩 감지 — functions-cmip `src/csv/encoding.ts` 이관 (브라우저용).
 *
 * 절대 규칙(과거 버그): UTF-16 BOM CSV를 CP949가 "그럴듯하게" 디코딩해 오탐한다.
 * 따라서 BOM을 먼저 본다. cp949/euc-kr 는 브라우저 내장 TextDecoder('euc-kr')로 처리
 * (WHATWG 'euc-kr' 디코더가 CP949/UHC 상위집합을 커버).
 */
export function readText(raw: Uint8Array | ArrayBuffer): string {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
  let txt: string

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    txt = new TextDecoder('utf-16le').decode(bytes.subarray(2))
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    txt = new TextDecoder('utf-16be').decode(bytes.subarray(2))
  } else if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    txt = new TextDecoder('utf-8').decode(bytes.subarray(3))
  } else {
    // utf-8 → utf-16le → euc-kr(cp949) → latin-1
    const order: readonly string[] = ['utf-8', 'utf-16le', 'euc-kr']
    let decoded: string | null = null
    for (const enc of order) {
      try {
        decoded = new TextDecoder(enc, { fatal: true }).decode(bytes)
        break
      } catch {
        // 다음 인코딩 시도
      }
    }
    txt = decoded ?? new TextDecoder('windows-1252').decode(bytes) // latin-1 대체(비-fatal)
  }

  return (
    txt
      .replace(/\uFEFF/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/\u0000/g, '')
      .replace(/\r\n?/g, '\n')
  )
}
