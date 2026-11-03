import type { KeyboardEvent } from 'react'

/**
 * 한글 등을 조합하는 중에 누른 키인지 — 조합 중 엔터는 브라우저가 두 번 보낸다(조합 중 한 번,
 * 마지막 글자가 확정된 뒤 한 번). 첫 번째를 처리하면 칸을 비운 뒤 확정된 마지막 글자로 한 번 더
 * 만들어져서("홍길동" + "동"), 엔터로 무언가 하는 칸은 조합 중 키를 건너뛴다. Safari는
 * isComposing 대신 keyCode 229를 준다.
 */
export const isComposing = (e: KeyboardEvent): boolean => e.nativeEvent.isComposing || e.keyCode === 229
