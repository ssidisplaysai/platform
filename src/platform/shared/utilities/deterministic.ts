/**
 * Compares two strings using Unicode code point ordering.
 * This is locale-independent and deterministic across runtimes.
 */
export function compareDeterministicStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  const leftCodePoints = [...left];
  const rightCodePoints = [...right];
  const length = Math.min(leftCodePoints.length, rightCodePoints.length);

  for (let index = 0; index < length; index += 1) {
    const leftCodePoint = leftCodePoints[index].codePointAt(0)!;
    const rightCodePoint = rightCodePoints[index].codePointAt(0)!;

    if (leftCodePoint !== rightCodePoint) {
      return leftCodePoint < rightCodePoint ? -1 : 1;
    }
  }

  return leftCodePoints.length < rightCodePoints.length ? -1 : 1;
}

export function deterministicSort<T>(items: readonly T[], keySelector: (item: T) => string): T[] {
  return [...items].sort((left, right) => compareDeterministicStrings(keySelector(left), keySelector(right)));
}

export function deterministicUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => compareDeterministicStrings(left, right));
}

export function deterministicPairs<TKey extends string, TValue>(mapLike: Record<TKey, TValue>): Array<[TKey, TValue]> {
  return (Object.keys(mapLike) as TKey[])
    .sort((left, right) => compareDeterministicStrings(left, right))
    .map((key) => [key, mapLike[key]]);
}
