export function deterministicSort<T>(items: readonly T[], keySelector: (item: T) => string): T[] {
  return [...items].sort((left, right) => keySelector(left).localeCompare(keySelector(right)));
}

export function deterministicUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function deterministicPairs<TKey extends string, TValue>(mapLike: Record<TKey, TValue>): Array<[TKey, TValue]> {
  return (Object.keys(mapLike) as TKey[])
    .sort((left, right) => left.localeCompare(right))
    .map((key) => [key, mapLike[key]]);
}
