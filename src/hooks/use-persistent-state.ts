import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

const read = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    // 비공개 창·저장소 차단 등 — 저장값이 없는 것으로 본다.
    return undefined
  }
}

const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장이 안 돼도 화면은 그대로 동작한다(다음 방문 때 기본값).
  }
}

/**
 * useState인데 값이 이 브라우저(localStorage)에 남는다 — 화면 설정(필터,
 * 표시할 지표 등)을 다음에 들어와도 그대로 쓰기 위해.
 *
 * 저장값은 parse가 검사한다. 모양이 맞지 않으면(예전 버전의 값, 손으로
 * 고친 값) undefined를 돌려주면 initial을 쓴다. Set처럼 JSON으로 바로 못
 * 바꾸는 값은 serialize로 바꿔 저장한다.
 */
export const usePersistentState = <T>(
  key: string,
  initial: T | (() => T),
  parse: (stored: unknown) => T | undefined,
  serialize: (value: T) => unknown = (value) => value,
): [T, Dispatch<SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    const stored = read(key)
    const parsed = stored === undefined ? undefined : parse(stored)
    if (parsed !== undefined) return parsed
    return initial instanceof Function ? initial() : initial
  })

  useEffect(() => {
    write(key, serialize(value))
    // serialize는 매 렌더 새로 만들어질 수 있어 값이 바뀔 때만 저장한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value])

  return [value, setValue]
}

/** 저장값 검사 도우미 — 허용된 문자열 중 하나면 그 값. */
export const oneOf =
  <T extends string>(allowed: readonly T[]) =>
  (stored: unknown): T | undefined =>
    typeof stored === 'string' &&
    (allowed as readonly string[]).includes(stored)
      ? (stored as T)
      : undefined

/** 저장값 검사 도우미 — true/false면 그 값. */
export const boolean = (stored: unknown): boolean | undefined =>
  typeof stored === 'boolean' ? stored : undefined

/** 저장값 검사 도우미 — 허용된 문자열들의 배열이면 그 Set(모르는 값은 버린다). */
export const setOf =
  <T extends string>(allowed: readonly T[]) =>
  (stored: unknown): ReadonlySet<T> | undefined =>
    Array.isArray(stored)
      ? new Set(
          stored.filter((each): each is T =>
            (allowed as readonly string[]).includes(each),
          ),
        )
      : undefined

/** 저장값 검사 도우미 — 정해진 키마다 parse를 통과한 값만 모은 객체.
 * 빠진 키는 fallback 값으로 채운다. */
export const recordOf =
  <K extends string, V>(
    fallback: Record<K, V>,
    parse: (v: unknown) => V | undefined,
  ) =>
  (stored: unknown): Record<K, V> | undefined => {
    if (typeof stored !== 'object' || stored === null) return undefined
    const out = { ...fallback }
    for (const key of Object.keys(fallback) as K[]) {
      const parsed = parse((stored as Record<string, unknown>)[key])
      if (parsed !== undefined) out[key] = parsed
    }
    return out
  }
