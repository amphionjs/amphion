# Exceptions

`Exception` is the base class for framework and application errors. It adds a stable `code`, an HTTP `status` and a `help` hint to `Error`.

```ts
import { Exception } from '@amphion/core'

export class PaymentDeclined extends Exception {
  static override status = 402
  static override code: string | undefined = 'E_PAYMENT_DECLINED'
  static override help: string | undefined = 'Ask the customer for another card.'
}

throw new PaymentDeclined('The card was declined.')
```

Printed (and as the first line of the stack trace):

```text
E_PAYMENT_DECLINED: The card was declined. Ask the customer for another card.
```

Each static default can be overridden per throw, and `cause` is kept:

```ts
throw new PaymentDeclined('Card expired.', { help: 'Update the card.', cause: error })
```

For short one-off errors, `createError()` builds the class for you:

```ts
import { createError } from '@amphion/core'

export const QuotaExceeded = createError('E_QUOTA_EXCEEDED', 'You have used your quota.', {
  status: 429,
})

throw new QuotaExceeded()
```

## Reporting and rendering

Like Laravel, an exception may decide how it is logged and what HTTP response it produces by defining `report()` and `render(ctx)`. The HTTP exception handler (Phase 2) calls them when they exist. They are not declared on the base class, so you write them without `override`.

## Error codes

Every framework error has a code that starts with `E_`, a message that says what went wrong, and a hint that says how to fix it. The core codes are listed on the [service container](./container#errors) page, plus:

| Code | Meaning |
| --- | --- |
| `E_INVALID_ENV` | Environment variables are missing or invalid ([configuration](./configuration)) |
| `E_INVALID_APP_STATE` | An application method was called in the wrong lifecycle state, such as `boot()` after `terminate()` |
