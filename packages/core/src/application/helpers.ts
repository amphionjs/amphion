import type { ConfigPath, ConfigRepository, ConfigValue } from '../config/config.ts'
import type { BindingKey } from '../container/token.ts'
import { NoContainerException } from '../exceptions/errors.ts'
import { Application } from './application.ts'

function current(): Application {
  const instance = Application.getInstance()
  if (!instance) {
    throw new NoContainerException('No application exists yet.', {
      help: 'Create it first: Application.configure({ basePath }).create().',
    })
  }
  return instance
}

/** The current application, or a token resolved from it. Laravel's `app()`. */
export function app(): Application
export function app<T>(key: BindingKey<T>): T
export function app<T>(key?: BindingKey<T>): Application | T {
  const instance = current()
  return key === undefined ? instance : instance.make(key)
}

/** The config repository, or one typed value from it. Laravel's `config()`. */
export function config(): ConfigRepository
export function config<P extends ConfigPath>(path: P): ConfigValue<P>
export function config<P extends ConfigPath, D>(
  path: P,
  defaultValue: D,
): NonNullable<ConfigValue<P>> | D
export function config(path?: string, defaultValue?: unknown): unknown {
  const repository = current().config
  if (path === undefined) return repository
  return repository.get(path as ConfigPath, defaultValue)
}
