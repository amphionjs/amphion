/**
 * @amphion/core: the kernel of the Amphion framework. Service container, application lifecycle,
 * service providers, typed config and env, request context (AsyncLocalStorage), base exceptions,
 * and the Str, Arr and Collection helpers.
 */

export {
  type AppHook,
  Application,
  ApplicationBuilder,
  type ApplicationOptions,
  type AppState,
} from './application/application.ts'
export { app, config } from './application/helpers.ts'
export {
  type ConfigPath,
  type ConfigRegistry,
  ConfigRepository,
  type ConfigValue,
  type DotPath,
  defineConfig,
  type PathValue,
} from './config/config.ts'
export {
  type Concrete,
  Container,
  type ContextualGive,
  type ContextualNeeds,
  type Lifetime,
  type ResolvingCallback,
  resolve,
} from './container/container.ts'
export {
  type BindingKey,
  type Constructor,
  type Factory,
  type InjectList,
  type Token,
  token,
} from './container/token.ts'
export {
  RequestContext,
  type RequestScopeOptions,
  type RequestStore,
} from './context/request-context.ts'
export { Env, type EnvOptions, EnvRule, type EnvSchema, type EnvValues } from './env/env.ts'
export {
  BindingNotFoundException,
  CircularDependencyException,
  DeferredBindingException,
  InvalidAppStateException,
  InvalidEnvException,
  NoContainerException,
  NoRequestScopeException,
  ScopedInSingletonException,
  UnresolvableDependencyException,
} from './exceptions/errors.ts'
export {
  createError,
  Exception,
  type ExceptionClass,
  type ExceptionOptions,
} from './exceptions/exception.ts'
export {
  type DeferredProvider,
  deferred,
  type ProviderClass,
  type ProviderEntry,
  type ProviderHooks,
  ServiceProvider,
} from './providers/service-provider.ts'
export { Arr, type ArrHelpers } from './support/arr.ts'
export { type Accessor, Collection, collect, type WhereOperator } from './support/collection.ts'
export { LazyCollection } from './support/lazy-collection.ts'
export { type BuiltInStrHelpers, Str, type StrHelpers } from './support/str.ts'
