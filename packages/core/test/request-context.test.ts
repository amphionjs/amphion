import { setTimeout as sleep } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { Container, NoRequestScopeException, RequestContext, resolve } from '../src/index.ts'

class CurrentUser {
  id: number | undefined
}

describe('RequestContext', () => {
  it('is empty outside a scope', () => {
    expect(RequestContext.get()).toBeUndefined()
    expect(RequestContext.active()).toBe(false)
    expect(() => RequestContext.getOrFail()).toThrow(NoRequestScopeException)
  })

  it('gives each scope an id and its own data, across awaits', async () => {
    const result = await RequestContext.run(
      async () => {
        RequestContext.getOrFail().data.set('step', 1)
        await sleep(1)
        return [RequestContext.getOrFail().id, RequestContext.getOrFail().data.get('step')]
      },
      { id: 'req-1' },
    )
    expect(result).toEqual(['req-1', 1])
  })

  it('keeps 1,000 concurrent scopes isolated', async () => {
    const container = new Container()
    container.scoped(CurrentUser)

    const handle = async (userId: number): Promise<number[]> => {
      // "Log in" the user for this request only.
      container.make(CurrentUser).id = userId
      const seen: number[] = []
      for (let step = 0; step < 3; step++) {
        // Yield to other requests at random points, as real I/O would.
        await sleep(Math.floor(Math.random() * 3))
        seen.push(resolve(CurrentUser).id as number)
      }
      return seen
    }

    const results = await Promise.all(
      Array.from({ length: 1000 }, (_, userId) =>
        RequestContext.run(() => handle(userId), { container }),
      ),
    )
    results.forEach((seen, userId) => {
      expect(seen).toEqual([userId, userId, userId])
    })
  })
})
