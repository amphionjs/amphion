import { Exception } from './exception.ts'

// The errors @amphion/core throws. Each has a stable code; messages say what went wrong and the
// `help` hint says how to fix it.

/** The container cannot build a class: its constructor needs arguments it does not know. */
export class UnresolvableDependencyException extends Exception {
  static override code: string | undefined = 'E_UNRESOLVABLE_DEPENDENCY'
}

/** Two or more bindings depend on each other. The message prints the chain. */
export class CircularDependencyException extends Exception {
  static override code: string | undefined = 'E_CIRCULAR_DEPENDENCY'
}

/** `make()` was called with a symbol token that nothing is bound to. */
export class BindingNotFoundException extends Exception {
  static override code: string | undefined = 'E_BINDING_NOT_FOUND'
}

/** A scoped binding was resolved outside a request scope. */
export class NoRequestScopeException extends Exception {
  static override code: string | undefined = 'E_NO_REQUEST_SCOPE'
}

/** A singleton depends on a scoped binding, which would leak one request's state into the next. */
export class ScopedInSingletonException extends Exception {
  static override code: string | undefined = 'E_SCOPED_IN_SINGLETON'
}

/** `resolve()` was called where no container is active and no application exists. */
export class NoContainerException extends Exception {
  static override code: string | undefined = 'E_NO_CONTAINER'
}

/** A binding comes from a deferred provider that has not loaded yet. */
export class DeferredBindingException extends Exception {
  static override code: string | undefined = 'E_DEFERRED_BINDING'
  /** The token whose provider must be loaded. */
  token: unknown

  constructor(token: unknown, message: string) {
    super(message, {
      help: 'Resolve it with `await app.makeAsync(token)`, which loads the provider first.',
    })
    this.token = token
  }
}

/** One or more environment variables are missing or invalid. Lists names only, never values. */
export class InvalidEnvException extends Exception {
  static override code: string | undefined = 'E_INVALID_ENV'
}

/** An application method was called in the wrong lifecycle state. */
export class InvalidAppStateException extends Exception {
  static override code: string | undefined = 'E_INVALID_APP_STATE'
}
