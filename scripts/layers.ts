/**
 * The dependency layers of the monorepo, from the bottom up.
 * A package may depend only on packages in its own layer or a lower one.
 * Every folder in `packages/` must be listed in PACKAGE_LAYERS (the repo tests check this).
 */
export const LAYERS = [
  'kernel',
  'transport',
  'data',
  'security',
  'presentation',
  'services',
  'tooling',
] as const

export type Layer = (typeof LAYERS)[number]

/** Folder name in `packages/` → layer. */
export const PACKAGE_LAYERS: Record<string, Layer> = {
  core: 'kernel',
  encryption: 'kernel',
  hash: 'kernel',
  logger: 'kernel',

  http: 'transport',
  validator: 'transport',
  cli: 'transport',

  database: 'data',
  orm: 'data',

  session: 'security',
  auth: 'security',
  authorization: 'security',

  view: 'presentation',
  vite: 'presentation',
  inertia: 'presentation',

  events: 'services',
  cache: 'services',
  queue: 'services',
  scheduler: 'services',
  mail: 'services',
  notifications: 'services',
  storage: 'services',
  broadcast: 'services',
  mcp: 'services',

  testing: 'tooling',
  ai: 'tooling',
  dock: 'tooling',
  'create-amphion': 'tooling',
}

/** Position of a layer, 0 for the lowest. */
export function layerRank(layer: Layer): number {
  return LAYERS.indexOf(layer)
}
