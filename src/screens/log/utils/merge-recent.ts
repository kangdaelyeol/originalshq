/**
 * 이어 받은 기록(?since= — 지난번 뒤에 바뀐 것만)을 가진 목록에 합친다. 같은
 * id는 새 것으로 바꾸고, 기간(from) 밖으로 밀려난 것은 빼고, 최근 것부터
 * 세운다. 바뀐 게 없으면 원래 배열을 그대로 돌려줘서 그걸로 만든 값(useMemo)을
 * 다시 계산하지 않게 한다.
 */
export const mergeRecent = <T>(
  prev: readonly T[],
  next: readonly T[],
  idOf: (item: T) => string,
  timeOf: (item: T) => number,
  from: number,
): T[] => {
  const kept = prev.filter((item) => timeOf(item) >= from)
  if (next.length === 0 && kept.length === prev.length) return prev as T[]
  const byId = new Map(kept.map((item) => [idOf(item), item]))
  for (const item of next) byId.set(idOf(item), item)
  return [...byId.values()]
    .filter((item) => timeOf(item) >= from)
    .sort((a, b) => timeOf(b) - timeOf(a))
}
