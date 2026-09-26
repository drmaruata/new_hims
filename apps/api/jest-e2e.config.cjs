/**
 * Jest configuration for the `@hims/api` integration suite (`test/`).
 *
 * Separate from `jest.config.cjs` on purpose. The two suites answer different
 * questions and must not be able to satisfy each other:
 *
 *   - specs under `src`   unit tests, no HTTP server, no container wiring
 *   - specs under `test`  boots a real Nest HTTP application and drives it
 *     over the wire with supertest
 *
 * `testMatch` is narrow so a unit spec dropped in `test/` by mistake is not
 * silently reported as integration coverage, and `roots` keeps the two
 * directories from being scanned by both configs.
 *
 * `.cjs` for the same reason as `jest.config.cjs`: `apps/api` is an ES module
 * package, so a `.js` config would be loaded as ESM and `module.exports` would
 * throw.
 */
module.exports = {
  displayName: 'e2e',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Same compiler options as the unit suite: ts-jest's default preset emits
  // CommonJS, which is what Jest's runtime executes a `.ts` spec as.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@hims/(.*)$': '<rootDir>/../../packages/$1/src',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
};
