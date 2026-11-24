// Plain object: this fixture lives in a package, where isolatedDeclarations is on. Apps use
// defineConfig().
export default {
  name: 'Fixture App',
  env: 'production',
  features: { search: { enabled: true, driver: 'memory' } },
}
