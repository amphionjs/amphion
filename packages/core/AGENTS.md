# @amphion/core: rules for agents

The kernel every other package builds on. The repository-wide rules in the root `AGENTS.md` apply; these add to them.

1. **No internal dependencies.** Core is the bottom of the layer map. Its only runtime dependency is `pluralize`; add another only with the reason the root rules ask for.
2. **Keep the container's fast path.** `Container.make()` checks the `instances` Map first and returns. Do not put alias, contextual or swap checks before that lookup. `swap()` writes into the same Map on purpose. Check with `pnpm bench container`: a cached singleton should stay within a few ns of `Map.get`.
3. **Factories are synchronous.** `make()` and `resolve()` must stay synchronous, because `resolve()` runs in field initializers and default parameters. Async work belongs in a provider's `boot()`. Deferred providers load through `makeAsync()`.
4. **Two injection styles, one canonical.** Framework code uses `static inject` (constructor) and `static methods` (method injection through `call()`). `resolve()` is for app code. It relies on the module-level `active` container being set around every build and `call()`.
5. **Request data never reaches a singleton.** Keep the `E_SCOPED_IN_SINGLETON` check; it walks every frame on the build stack, not only the direct parent.
6. **Core must type-check under app augmentation.** Apps augment `ConfigRegistry`, `StrHelpers` and `Collection`, and the monorepo type-checks core's source inside the playground. Internal calls use `as ConfigPath` for runtime strings, and built-in objects are typed by `BuiltIn*` interfaces that augmentation never touches.
7. **Optional hooks are not declared on base classes.** `ServiceProvider` and `Exception` do not declare `register()`, `boot()`, `report()` or `render()`, so user subclasses need no `override`. Callers check for them with `?.()`.
8. **Errors.** Use the classes in `src/exceptions/errors.ts`, each with a stable `E_*` code and a `help` hint. Never put a secret or an env value in a message.
