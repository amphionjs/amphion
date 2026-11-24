import { ConfigRepository } from '@amphion/core'

/** Builds the playground's greeting. Shows constructor injection with `static inject`. */
export default class Greeter {
  static inject = [ConfigRepository] as const

  config: ConfigRepository

  constructor(config: ConfigRepository) {
    this.config = config
  }

  greet(): string {
    return `Hello from ${this.config.get('app.name')}.`
  }
}
