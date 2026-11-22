// How should the container (Phase 1) cache resolved singletons? Classes are their own tokens,
// so the lookup key is a constructor. This compares the candidate storage strategies against
// the Phase 1 target of under 1 µs per cached resolve.
import { bench, do_not_optimize, group, summary } from 'mitata'

const tokens = Array.from({ length: 200 }, (_, index) => {
  const token = class {}
  Object.defineProperty(token, 'name', { value: `Service${index}` })
  return token
})
const symbolTokens = tokens.map((token) => Symbol(token.name))

const map = new Map<unknown, object>()
const weakMap = new WeakMap<object, object>()
const record: Record<symbol, object> = {}
const instanceKey = Symbol('amphion.instance')

for (const [index, token] of tokens.entries()) {
  const instance = new token()
  map.set(token, instance)
  weakMap.set(token, instance)
  record[symbolTokens[index] as symbol] = instance
  Object.defineProperty(token, instanceKey, { value: instance })
}

let cursor = 0
const next = (): number => {
  cursor = (cursor + 1) % tokens.length
  return cursor
}

group('resolve a cached singleton by class token', () => {
  summary(() => {
    bench('Map.get(class)', () => do_not_optimize(map.get(tokens[next()])))
    bench('WeakMap.get(class)', () => do_not_optimize(weakMap.get(tokens[next()] as object)))
    bench('record[symbol]', () => do_not_optimize(record[symbolTokens[next()] as symbol]))
    bench('class[symbol] property', () =>
      do_not_optimize((tokens[next()] as unknown as Record<symbol, object>)[instanceKey]),
    )
  })
})
