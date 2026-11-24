const registered = new WeakMap<object, Set<PropertyKey>>()

/**
 * Adds a method to an object (or a class prototype), like Laravel's `Macroable` trait. Built-in
 * members cannot be replaced: Laravel's macros only fill in methods that do not exist, and
 * silently overwriting a real method would break every caller.
 */
export function addMacro(target: object, name: string, fn: (...args: never[]) => unknown): void {
  if (typeof fn !== 'function') throw new TypeError(`The macro "${name}" must be a function.`)
  const own = registered.get(target) ?? new Set<PropertyKey>()
  if (name in target && !own.has(name)) {
    throw new TypeError(`Cannot add the macro "${name}": a built-in member has that name.`)
  }
  own.add(name)
  registered.set(target, own)
  Object.defineProperty(target, name, {
    value: fn,
    writable: true,
    configurable: true,
    enumerable: false,
  })
}

/** True when `name` was added with {@link addMacro}. */
export function hasMacro(target: object, name: string): boolean {
  return registered.get(target)?.has(name) ?? false
}
