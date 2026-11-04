/** items를 limit개씩 동시에 돌린다. */
export async function mapLimit<T>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      await run(items[index], index)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )
}
