export function keywiseJoin<K extends string | number | symbol, V>(
  a: Partial<Record<K, V>>,
  b: Partial<Record<K, V>>,
  joiner: (a?: V, b?: V) => V
): Partial<Record<K, V>> {
  const keys: Set<K> = new Set([...Object.keys(a), ...Object.keys(b)] as K[]);
  const ret: Partial<Record<K, V>> = {};
  for (const key of keys) {
    ret[key] = joiner(a[key], b[key]);
  }
  return ret;
}

export function keywiseAdd<K extends string | number | symbol>(
  a: Partial<Record<K, number>>,
  b: Partial<Record<K, number>>
): Partial<Record<K, number>> {
  return keywiseJoin(a, b, (a, b) => (a ?? 0) + (b ?? 0));
}

export function keywiseSubtract<K extends string | number | symbol>(
  a: Partial<Record<K, number>>,
  b: Partial<Record<K, number>>
): Partial<Record<K, number>> {
  return keywiseJoin(a, b, (a, b) => (a ?? 0) - (b ?? 0));
}

export function keywiseMin<K extends string | number | symbol>(
  a: Partial<Record<K, number>>,
  b: Partial<Record<K, number>>
): Partial<Record<K, number>> {
  return keywiseJoin(a, b, (a, b) => Math.min(a ?? 0, b ?? 0));
}

export function keywiseFilter<K extends string | number | symbol>(
  a: Partial<Record<K, number>>,
  filter: (value: number) => boolean
): Partial<Record<K, number>> {
  const ret: Partial<Record<K, number>> = {};
  for (const key in a) {
    const value = a[key];
    if (value != null && filter(value)) {
      ret[key] = value;
    }
  }
  return ret;
}

export function keywiseMap<K extends string | number | symbol, V>(
  a: Partial<Record<K, V>>,
  mapper: (value: V) => V
): Partial<Record<K, V>> {
  const ret: Partial<Record<K, V>> = {};
  for (const key in a) {
    const value = a[key];
    if (value != null) {
      ret[key] = mapper(value);
    }
  }
  return ret;
}
