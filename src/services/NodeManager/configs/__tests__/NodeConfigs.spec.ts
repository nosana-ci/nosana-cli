import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Read .env files directly to avoid duplicating values
const modulePath = path.dirname(fileURLToPath(import.meta.url));
const envBase = dotenv.parse(
  fs.readFileSync(path.resolve(modulePath, '../../../../../.env')),
);
const envDev = dotenv.parse(
  fs.readFileSync(path.resolve(modulePath, '../../../../../.env.dev')),
);
const envProd = dotenv.parse(
  fs.readFileSync(path.resolve(modulePath, '../../../../../.env.prd')),
);

// Test constants for env variable names
const ENV_VAR_BACKEND_SOLANA_ADDRESS = 'BACKEND_SOLANA_ADDRESS';
const ENV_VAR_BACKEND_URL = 'BACKEND_URL';
const ENV_VAR_MIN_DISK_SPACE = 'MIN_DISK_SPACE';
const DEVNET = 'devnet';
const MAINNET = 'mainnet';

describe('NodeConfigs', () => {
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
    delete process.env.FRP_SERVER_IMAGE;
    delete process.env.TUNNEL_CONTAINER_IMAGE;
    delete process.env.API_PORT;
    delete process.env.MIN_DISK_SPACE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('dotenv file merging', () => {
    it('should load common variables from base .env file', async () => {
      const { NodeConfigs } = await import('../NodeConfigs.js');

      const nodeConfigs = new NodeConfigs({ network: MAINNET });
      nodeConfigs.loadVariablesToEnv();

      expect(process.env[ENV_VAR_BACKEND_SOLANA_ADDRESS]).toBe(
        envBase[ENV_VAR_BACKEND_SOLANA_ADDRESS],
      );
    });

    it('should load environment-specific variables', async () => {
      const { NodeConfigs } = await import('../NodeConfigs.js');

      const nodeConfigs = new NodeConfigs({ network: DEVNET });
      nodeConfigs.loadVariablesToEnv();

      expect(process.env[ENV_VAR_BACKEND_URL]).toBe(
        envDev[ENV_VAR_BACKEND_URL],
      );
    });

    it('should override common values with environment-specific values', async () => {
      const { NodeConfigs } = await import('../NodeConfigs.js');

      const nodeConfigs = new NodeConfigs({ network: DEVNET });
      nodeConfigs.loadVariablesToEnv();

      // MIN_DISK_SPACE exists in both .env (base) and .env.dev
      // With override:true and env-specific file loaded last, development value should win
      expect(process.env[ENV_VAR_MIN_DISK_SPACE]).toBe(
        envDev[ENV_VAR_MIN_DISK_SPACE],
      );
    });

    it('should use common value when environment-specific file does not override it', async () => {
      const { NodeConfigs } = await import('../NodeConfigs.js');

      const nodeConfigs = new NodeConfigs({ network: MAINNET });
      nodeConfigs.loadVariablesToEnv();

      // MIN_DISK_SPACE only has override in .env.dev, not in .env.prd
      // So production should use the base .env value
      expect(process.env[ENV_VAR_MIN_DISK_SPACE]).toBe(
        envBase[ENV_VAR_MIN_DISK_SPACE],
      );
    });
  });

  describe('network to environment mapping', () => {
    it('should use prd environment for mainnet network', async () => {
      const { NodeConfigs } = await import('../NodeConfigs.js');

      const nodeConfigs = new NodeConfigs({ network: MAINNET });
      nodeConfigs.loadVariablesToEnv();

      expect(process.env[ENV_VAR_BACKEND_URL]).toBe(
        envProd[ENV_VAR_BACKEND_URL],
      );
    });

    it('should use dev environment for devnet network', async () => {
      const { NodeConfigs } = await import('../NodeConfigs.js');

      const nodeConfigs = new NodeConfigs({ network: DEVNET });
      nodeConfigs.loadVariablesToEnv();

      expect(process.env[ENV_VAR_BACKEND_URL]).toBe(
        envDev[ENV_VAR_BACKEND_URL],
      );
    });

    it('should use dev environment when network is not mainnet', async () => {
      const { NodeConfigs } = await import('../NodeConfigs.js');

      const nodeConfigs = new NodeConfigs({ network: 'testnet' });
      nodeConfigs.loadVariablesToEnv();

      expect(process.env[ENV_VAR_BACKEND_URL]).toBe(
        envDev[ENV_VAR_BACKEND_URL],
      );
    });

    it('should default to mainnet (prd) when network is not specified', async () => {
      const { NodeConfigs } = await import('../NodeConfigs.js');

      const nodeConfigs = new NodeConfigs({});
      nodeConfigs.loadVariablesToEnv();

      expect(process.env[ENV_VAR_BACKEND_URL]).toBe(
        envProd[ENV_VAR_BACKEND_URL],
      );
    });
  });

  describe('NodeConfigsSingleton', () => {
    it('should only call loadVariablesToEnv once across multiple getInstance calls', async () => {
      const { NodeConfigsSingleton, NodeConfigs } = await import(
        '../NodeConfigs.js'
      );

      const loadSpy = vi.spyOn(NodeConfigs.prototype, 'loadVariablesToEnv');

      NodeConfigsSingleton.getInstance({ network: DEVNET });
      NodeConfigsSingleton.getInstance({ network: MAINNET });
      NodeConfigsSingleton.getInstance();

      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('should use options from first getInstance call', async () => {
      const { NodeConfigsSingleton } = await import('../NodeConfigs.js');

      // First call with devnet
      NodeConfigsSingleton.getInstance({ network: DEVNET });

      // Subsequent calls with different options should not change the config
      NodeConfigsSingleton.getInstance({ network: MAINNET });

      // Should still have dev environment values from first call
      expect(process.env[ENV_VAR_BACKEND_URL]).toBe(
        envDev[ENV_VAR_BACKEND_URL],
      );
    });
  });

  describe('startup without exceptions', () => {
    it('should load configs for mainnet without throwing when all required variables have defaults', async () => {
      // Clear all config-related environment variables to test defaults
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
      delete process.env.FRP_SERVER_IMAGE;
      delete process.env.TUNNEL_CONTAINER_IMAGE;
      delete process.env.API_PORT;
      delete process.env.MIN_DISK_SPACE;

      // Attempt to load configs - should not throw
      const { configs } = await import('../configs.js');

      const config = configs({ network: MAINNET });
      // Verify config object exists and has expected properties
      expect(config).toBeDefined();
      expect(config.network).toBe(MAINNET);
    });

    it('should load configs for devnet without throwing when all required variables have defaults', async () => {
      // Clear all config-related environment variables to test defaults
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
      delete process.env.FRP_SERVER_IMAGE;
      delete process.env.TUNNEL_CONTAINER_IMAGE;
      delete process.env.API_PORT;
      delete process.env.MIN_DISK_SPACE;

      // Attempt to load configs - should not throw
      const { configs } = await import('../configs.js');

      const config = configs({ network: DEVNET });
      // Verify config object exists and has expected properties
      expect(config).toBeDefined();
      expect(config.network).toBe(DEVNET);
    });
  });
});
