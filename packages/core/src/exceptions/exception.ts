/** Options accepted by every {@link Exception}. Each one overrides the class's static default. */
export interface ExceptionOptions {
  /** Stable machine-readable code, for example `E_MISSING_APP_KEY`. */
  code?: string
  /** HTTP status the exception maps to. */
  status?: number
  /** A short hint that tells the developer how to fix the problem. */
  help?: string
  /** The error that caused this one. */
  cause?: unknown
}

/**
 * Base class for framework and application errors, like Laravel's exceptions.
 *
 * Subclasses set their defaults as static fields:
 *
 * ```ts
 * export class PaymentDeclined extends Exception {
 *   static status = 402
 *   static code = 'E_PAYMENT_DECLINED'
 * }
 * ```
 *
 * An exception may also define `report()` (how it is logged) and `render(ctx)` (the HTTP
 * response it produces). The HTTP exception handler (Phase 2) calls them when they exist, so
 * they are not declared here and subclasses do not need `override`.
 */
export class Exception extends Error {
  static status = 500
  static code: string | undefined = undefined
  static help: string | undefined = undefined

  status: number
  code: string | undefined
  help: string | undefined

  constructor(message?: string, options: ExceptionOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    const defaults = new.target as typeof Exception
    this.name = defaults.name
    this.status = options.status ?? defaults.status
    this.code = options.code ?? defaults.code
    this.help = options.help ?? defaults.help

    // Rebuild the first stack line so uncaught errors print as `E_CODE: message. hint`.
    if (this.code !== undefined && typeof this.stack === 'string') {
      const firstFrame = this.stack.indexOf('\n    at ')
      this.stack = this.toString() + (firstFrame === -1 ? '' : this.stack.slice(firstFrame))
    }
  }

  /** `E_CODE: message hint`, or `Name: message` when the exception has no code. */
  override toString(): string {
    const head = `${this.code ?? this.name}: ${this.message}`
    return this.help ? `${head} ${this.help}` : head
  }
}

/** A subclass of {@link Exception} made by {@link createError}. */
export type ExceptionClass = new (message?: string, options?: ExceptionOptions) => Exception

/**
 * Makes an exception class with a fixed code, status, message and hint:
 *
 * ```ts
 * export const PaymentDeclined = createError('E_PAYMENT_DECLINED', 'The card was declined.', {
 *   status: 402,
 * })
 * throw new PaymentDeclined()
 * ```
 */
export function createError(
  code: string,
  message: string,
  options: { status?: number; help?: string; name?: string } = {},
): ExceptionClass {
  const created = class extends Exception {
    static override status = options.status ?? 500
    static override code: string | undefined = code
    static override help: string | undefined = options.help

    constructor(customMessage?: string, customOptions?: ExceptionOptions) {
      super(customMessage ?? message, customOptions)
    }
  }
  Object.defineProperty(created, 'name', { value: options.name ?? nameFromCode(code) })
  return created
}

/** `E_PAYMENT_DECLINED` → `PaymentDeclinedException`. */
function nameFromCode(code: string): string {
  const words = code.replace(/^E_/, '').toLowerCase().split('_').filter(Boolean)
  return `${words.map((word) => word[0]?.toUpperCase() + word.slice(1)).join('')}Exception`
}
