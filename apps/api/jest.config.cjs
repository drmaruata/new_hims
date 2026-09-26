/**
 * Jest configuration for @hims/api.
 *
 * This file is `.cjs` on purpose: `apps/api/package.json` sets
 * `"type": "module"`, so a `jest.config.js` would be loaded as ESM and its
 * `module.exports` would fail with "module is not defined in ES module scope".
 * Jest reads `jest.config.cjs` first, so the CommonJS form below is correct.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // `apps/api/tsconfig.json` targets `module: NodeNext` for the real build,
  // which emits ESM. The default ts-jest preset compiles to CommonJS, so the
  // spec run needs its own compiler options rather than the build's.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/test-setup.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Resolve a workspace package to its source so specs do not need a build
  // artifact, and so a failing spec points at the line that actually broke.
  // Relative imports carry the `.js` extension that `module: NodeNext` requires
  // for the ESM build; Jest resolves specifiers literally, so the extension is
  // mapped away and `moduleFileExtensions` finds the `.ts` source instead.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@hims/(.*)$': '<rootDir>/../../packages/$1/src',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
};
