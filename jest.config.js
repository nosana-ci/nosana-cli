/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.[jt]s$': [
      'ts-jest',
      {
        useESM: true,
        supportsDynamicImport: true,
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!@nosana|ora|cli-cursor|restore-cursor|log-symbols|is-unicode-supported|strip-ansi|ansi-regex|string-width|get-east-asian-width|is-interactive|stdin-discarder|lowdb|steno|chalk/.*)',
  ],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['text', 'text-summary'],
  coveragePathIgnorePatterns: ['src/types/*'],
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      lines: 0,
      functions: 0,
    },
  },
};
