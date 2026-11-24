// Service providers, in the order they register and boot.
import type { ProviderEntry } from '@amphion/core'
import AppServiceProvider from '#app/Providers/AppServiceProvider.ts'

export default [AppServiceProvider] satisfies ProviderEntry[]
