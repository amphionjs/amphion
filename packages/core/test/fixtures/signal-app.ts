// Started as a child process by application.test.ts to check signal handling for real.
// Mode (argv[2]): "clean" shuts down normally; "slow" never finishes shutting down.
import { Application, ServiceProvider } from '../../src/index.ts'

const mode = process.argv[2] ?? 'clean'

class DatabaseProvider extends ServiceProvider {
  async shutdown(): Promise<void> {
    if (mode === 'slow') await new Promise(() => {})
    console.log('provider shutdown')
  }
}

const app = Application.configure({ basePath: import.meta.dirname, handleSignals: true })
  .withProviders([DatabaseProvider])
  .create()
app.shutdownTimeout = mode === 'slow' ? 300 : 5000

const keepAlive = setInterval(() => {}, 1000)
app.terminating(() => {
  clearInterval(keepAlive)
  console.log('terminating')
})

await app.start()
console.log('ready')
