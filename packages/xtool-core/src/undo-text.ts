// 되돌리기 알림 글(tech-outbox 되돌리기) — "상태를 '수리 중'으로 수정했어요"처럼 무엇을 무엇으로 바꿨는지. 받침에 따라
// 을/를·(으)로를 고른다(숫자는 읽는 소리로, 영어는 대강).

export type UndoChange =
  | { kind: 'name'; to: string }
  | { kind: 'group'; to: string }
  /** to — 바꾼 값의 글자(미리 보기가 없으면 null, 비웠으면 '') */
  | { kind: 'column'; title: string; to: string | null }
  | { kind: 'subitem'; sub: string; title: string; to: string | null }
  | { kind: 'subitemAdd'; name: string }
  | { kind: 'create' }

export interface UndoSummary {
  itemName: string
  changes: UndoChange[]
}

// 숫자 끝자리의 받침(0 영·1 일·3 삼·6 육·7 칠·8 팔) — 종성 번호(ㄹ 8)
const DIGIT_FINAL: Record<string, number> = { '0': 21, '1': 8, '3': 16, '6': 1, '7': 8, '8': 8 }
const RIEUL = 8

/** 마지막 글자의 받침(종성 번호, 없으면 0) — 따옴표·괄호·빈칸은 건너뛴다 */
function finalSound(word: string): number {
  const ch = [...word.replace(/[\s'"’”)\]…·.]+$/u, '')].pop()
  if (!ch) return 0
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28
  if (/[0-9]/.test(ch)) return DIGIT_FINAL[ch] ?? 0
  if (/[lr]/i.test(ch)) return RIEUL
  if (/[mn]/i.test(ch)) return 4
  return 0
}

/** 조사 — '을/를' · '(으)로' */
export function josa(word: string, kind: '을/를' | '(으)로'): string {
  const final = finalSound(word)
  if (kind === '을/를') return final ? '을' : '를'
  return final && final !== RIEUL ? '으로' : '로'
}

const MAX_VALUE = 30
const quote = (text: string) => `'${text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text}'`

/** 고친 칸 이름 — 여럿일 때 "상태 외 2개"에 쓴다 */
function changeLabel(change: UndoChange): string {
  switch (change.kind) {
    case 'name':
      return '이름'
    case 'group':
      return '그룹'
    case 'column':
      return change.title
    case 'subitem':
      return `${quote(change.sub)} ${change.title}`
    case 'subitemAdd':
      return `하위 아이템 ${quote(change.name)}`
    case 'create':
      return '새 항목'
  }
}

/** 바꾼 것 하나 — "상태를 '수리 중'으로 수정했어요" */
export function describeChange(change: UndoChange): string {
  switch (change.kind) {
    case 'name':
      return `이름을 ${quote(change.to)}${josa(change.to, '(으)로')} 수정했어요`
    case 'group':
      return `${quote(change.to)} 그룹으로 옮겼어요`
    case 'subitemAdd':
      return `하위 아이템 ${quote(change.name)}${josa(change.name, '을/를')} 추가했어요`
    case 'create':
      return '새 항목을 추가했어요'
    case 'column':
    case 'subitem': {
      const label = changeLabel(change)
      const object = `${label}${josa(change.title, '을/를')}`
      if (change.to === null) return `${object} 수정했어요`
      if (change.to.trim() === '') return `${object} 비웠어요`
      return `${object} ${quote(change.to)}${josa(change.to, '(으)로')} 수정했어요`
    }
  }
}

/** 되돌리기 알림의 제목·글 — 항목 하나면 그 이름, 여럿이면 "3개 항목" */
export function undoText(entries: readonly UndoSummary[]): { title: string; message: string } {
  if (entries.length !== 1) {
    const groups = new Set(entries.flatMap((e) => e.changes.map((c) => (c.kind === 'group' ? c.to : null))))
    const allMoved = entries.every((e) => e.changes.length === 1 && e.changes[0].kind === 'group')
    const to = [...groups][0]
    return {
      title: `${entries.length}개 항목`,
      message:
        allMoved && groups.size === 1 && to
          ? `${quote(to)} 그룹으로 옮겼어요`
          : `${entries.length}개 항목을 수정했어요`,
    }
  }
  const { itemName, changes } = entries[0]
  if (changes.length === 1) return { title: itemName, message: describeChange(changes[0]) }
  if (changes.every((c) => c.kind === 'subitemAdd')) {
    return { title: itemName, message: `하위 아이템 ${changes.length}개를 추가했어요` }
  }
  const first = changeLabel(changes[0])
  return { title: itemName, message: `${first} 외 ${changes.length - 1}개를 수정했어요` }
}

/** 되돌린 뒤 알림 글 — "홍길동 · 상태를 되돌렸어요" */
export function revertText(entries: readonly UndoSummary[]): string {
  if (entries.length !== 1) return `${entries.length}개 항목을 되돌렸어요`
  const { itemName, changes } = entries[0]
  const first = changeLabel(changes[0])
  const what = changes.length > 1 ? `${first} 외 ${changes.length - 1}개` : first
  const word =
    changes.length > 1
      ? `${changes.length - 1}개`
      : changes[0].kind === 'column' || changes[0].kind === 'subitem'
        ? changes[0].title
        : first
  return `${itemName} · ${what}${josa(word, '을/를')} 되돌렸어요`
}
