import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test file patterns
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'build'],

    // Environment
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.{js,ts}',
        'src/types/**',
        'src/api/schema.d.ts',
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },

    // Test isolation and performance
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporter configuration
    reporters: ['verbose'],

    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
  },
});
