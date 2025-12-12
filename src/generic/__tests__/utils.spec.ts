import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// Constants
const TEST_ENV_VAR_NAME = 'TEST_CONFIG_VALUE';
const TEST_ENV_VAR_VALUE = 'test-value-123';

const { loadConfigurationValue } = await import('../utils.js');

describe('loadConfigurationValue', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();

    // Clear test env var for clean state
    delete process.env[TEST_ENV_VAR_NAME];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return the value when environment variable is set', async () => {
    process.env[TEST_ENV_VAR_NAME] = TEST_ENV_VAR_VALUE;

    const result = loadConfigurationValue(TEST_ENV_VAR_NAME);

    expect(result).toBe(TEST_ENV_VAR_VALUE);
  });

  it('should throw error when environment variable is not set', async () => {
    delete process.env[TEST_ENV_VAR_NAME];

    expect(() => loadConfigurationValue(TEST_ENV_VAR_NAME)).toThrow(
      `Missing environment variable ${TEST_ENV_VAR_NAME}`,
    );
  });

  it('should throw error when environment variable is empty string', async () => {
    process.env[TEST_ENV_VAR_NAME] = '';

    expect(() => loadConfigurationValue(TEST_ENV_VAR_NAME)).toThrow(
      `Missing environment variable ${TEST_ENV_VAR_NAME}`,
    );
  });

  it('should handle multiple environment variables independently', async () => {
    const varOne = 'VAR_ONE';
    const varTwo = 'VAR_TWO';
    const valueOne = 'value1';
    const valueTwo = 'value2';

    process.env[varOne] = valueOne;
    process.env[varTwo] = valueTwo;

    expect(loadConfigurationValue(varOne)).toBe(valueOne);
    expect(loadConfigurationValue(varTwo)).toBe(valueTwo);
  });
});
