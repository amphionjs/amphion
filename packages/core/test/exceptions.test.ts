import { describe, expect, it } from 'vitest'
import { createError, Exception } from '../src/index.ts'

describe('Exception', () => {
  it('takes its defaults from static fields', () => {
    class PaymentDeclined extends Exception {
      static override status = 402
      static override code: string | undefined = 'E_PAYMENT_DECLINED'
      static override help: string | undefined = 'Ask for another card.'
    }
    const error = new PaymentDeclined('The card was declined.')
    expect(error).toBeInstanceOf(Exception)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('PaymentDeclined')
    expect(error.status).toBe(402)
    expect(error.code).toBe('E_PAYMENT_DECLINED')
    expect(String(error)).toBe('E_PAYMENT_DECLINED: The card was declined. Ask for another card.')
    expect(error.stack?.split('\n')[0]).toBe(String(error))
    expect(error.stack).toContain('exceptions.test.ts')
  })

  it('lets options override the defaults and keeps the cause', () => {
    const cause = new Error('socket closed')
    const error = new Exception('Failed.', { status: 503, code: 'E_DOWN', cause })
    expect(error.status).toBe(503)
    expect(error.code).toBe('E_DOWN')
    expect(error.cause).toBe(cause)
  })

  it('defaults to status 500 and prints like an Error without a code', () => {
    const error = new Exception('Oops')
    expect(error.status).toBe(500)
    expect(error.code).toBeUndefined()
    expect(String(error)).toBe('Exception: Oops')
  })
})

describe('createError', () => {
  it('makes a named exception class with a fixed code, status and message', () => {
    const NotFound = createError('E_ROUTE_NOT_FOUND', 'Route not found.', { status: 404 })
    const error = new NotFound()
    expect(error).toBeInstanceOf(Exception)
    expect(error.name).toBe('RouteNotFoundException')
    expect(error.status).toBe(404)
    expect(error.code).toBe('E_ROUTE_NOT_FOUND')
    expect(error.message).toBe('Route not found.')
    expect(new NotFound('Cannot GET /x.').message).toBe('Cannot GET /x.')
  })
})
