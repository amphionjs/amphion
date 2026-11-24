// Dot-path access to nested plain objects, shared by Arr and the config repository.

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function segmentsOf(path: string): string[] {
  return path === '' ? [] : path.split('.')
}

/** Reads `a.b.c` from a nested object. Returns `fallback` when any step is missing. */
export function dataGet(target: unknown, path: string, fallback?: unknown): unknown {
  let current = target
  for (const segment of segmentsOf(path)) {
    if (!isObject(current) || !Object.hasOwn(current, segment)) return fallback
    current = current[segment]
  }
  return current === undefined ? fallback : current
}

/** True when `a.b.c` exists in a nested object. */
export function dataHas(target: unknown, path: string): boolean {
  let current = target
  for (const segment of segmentsOf(path)) {
    if (!isObject(current) || !Object.hasOwn(current, segment)) return false
    current = current[segment]
  }
  return true
}

/**
 * Writes `a.b.c` into a nested object, creating plain objects for missing steps. Refuses
 * `__proto__`, `prototype` and `constructor` so a path can never pollute a prototype.
 */
export function dataSet(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = segmentsOf(path)
  if (segments.length === 0) throw new TypeError('The path must not be empty.')
  for (const segment of segments) {
    if (UNSAFE_KEYS.has(segment)) throw new TypeError(`Unsafe path segment "${segment}".`)
  }
  let current: Record<string, unknown> = target
  for (const segment of segments.slice(0, -1)) {
    const next = Object.hasOwn(current, segment) ? current[segment] : undefined
    if (!isObject(next)) {
      const created: Record<string, unknown> = {}
      current[segment] = created
      current = created
    } else {
      current = next
    }
  }
  current[segments.at(-1) as string] = value
}
