import { ServiceProvider } from '@amphion/core'
import Greeter from '#app/Services/Greeter.ts'

export default class AppServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton(Greeter)
  }

  shutdown(): void {
    console.log('AppServiceProvider: shut down.')
  }
}
