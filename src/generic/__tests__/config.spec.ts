import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Read .env files directly to avoid duplicating values
const modulePath = path.dirname(fileURLToPath(import.meta.url));
const envBase = dotenv.parse(
  fs.readFileSync(path.resolve(modulePath, '../../../.env')),
);
const envDev = dotenv.parse(
  fs.readFileSync(path.resolve(modulePath, '../../../.env.dev')),
);
const envProd = dotenv.parse(
  fs.readFileSync(path.resolve(modulePath, '../../../.env.production')),
);

// Test constants for env variable names
const ENV_VAR_BACKEND_SOLANA_ADDRESS = 'BACKEND_SOLANA_ADDRESS';
const ENV_VAR_BACKEND_URL = 'BACKEND_URL';
const ENV_VAR_MIN_DISK_SPACE = 'MIN_DISK_SPACE';

describe('config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();

    // Clear all relevant env vars to ensure clean state
    delete process.env.APP_ENV;
    delete process.env.NODE_ENV;
    delete process.env.BACKEND_URL;
    delete process.env.BACKEND_SOLANA_ADDRESS;
    delete process.env.BACKEND_AUTHORIZATION_ADDRESS;
    delete process.env.EXPLORER_URL;
    delete process.env.SIGN_MESSAGE;
    delete process.env.FRP_SERVER_ADDRESS;
    delete process.env.FRP_SERVER_PORT;
    delete process.env.FRPC_CONTAINER_IMAGE;
    delete process.env.TUNNEL_CONTAINER_IMAGE;
    delete process.env.API_PORT;
    delete process.env.MIN_DISK_SPACE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('dotenv file merging', () => {
    it('should load common variables from base .env file', async () => {
      process.env.APP_ENV = 'production';

      const { config } = await import('../config.js');

      expect(config.backendSolanaAddress).toBe(
        envBase[ENV_VAR_BACKEND_SOLANA_ADDRESS],
      );
    });

    it('should load environment-specific variables from .env.{env}', async () => {
      process.env.APP_ENV = 'dev';

      const { config } = await import('../config.js');

      expect(config.backendUrl).toBe(envDev[ENV_VAR_BACKEND_URL]);
    });

    it('should prioritize environment-specific values over common values when using dev environment', async () => {
      process.env.APP_ENV = 'dev';

      const { config } = await import('../config.js');

      // MIN_DISK_SPACE exists in both .env (base) and .env.dev
      // With override:false and env-specific file loaded first, dev value should win
      expect(config.minDiskSpace).toBe(parseInt(envDev[ENV_VAR_MIN_DISK_SPACE]));
    });

    it('should use common value when environment-specific file does not override it', async () => {
      process.env.APP_ENV = 'production';

      const { config } = await import('../config.js');

      // MIN_DISK_SPACE only has override in .env.dev, not in .env.production
      // So production should use the base .env value
      expect(config.minDiskSpace).toBe(parseInt(envBase[ENV_VAR_MIN_DISK_SPACE]));
    });
  });

  describe('environment detection', () => {
    it('should use APP_ENV for environment detection when set', async () => {
      process.env.APP_ENV = 'dev';
      process.env.NODE_ENV = 'production';

      const { config } = await import('../config.js');

      // Should use dev values because APP_ENV takes precedence
      expect(config.backendUrl).toBe(envDev[ENV_VAR_BACKEND_URL]);
    });

    it('should fall back to NODE_ENV when APP_ENV is not set', async () => {
      delete process.env.APP_ENV;
      process.env.NODE_ENV = 'dev';

      const { config } = await import('../config.js');

      expect(config.backendUrl).toBe(envDev[ENV_VAR_BACKEND_URL]);
    });

    it('should default to production when neither APP_ENV nor NODE_ENV is set', async () => {
      delete process.env.APP_ENV;
      delete process.env.NODE_ENV;

      const { config } = await import('../config.js');

      expect(config.backendUrl).toBe(envProd[ENV_VAR_BACKEND_URL]);
    });
  });

  describe('production environment', () => {
    it('should load production-specific variables when APP_ENV is production', async () => {
      process.env.APP_ENV = 'production';

      const { config } = await import('../config.js');

      expect(config.backendUrl).toBe(envProd[ENV_VAR_BACKEND_URL]);
    });
  });
});
