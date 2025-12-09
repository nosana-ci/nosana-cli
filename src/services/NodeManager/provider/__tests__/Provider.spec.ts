import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Provider } from '../Provider.js';
import type { Flow } from '@nosana/sdk';

const TEST_SERVER_ADDRESS = 'test.frp.server.com';
const TEST_SERVER_PORT = 7000;

vi.mock('../../configs/configs.js', () => ({
  configs: () => ({
    frp: {
      serverAddr: TEST_SERVER_ADDRESS,
      serverPort: TEST_SERVER_PORT,
    },
  }),
}));

vi.mock('../../configs/NodeConfigs.js', () => ({
  NodeConfigsSingleton: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../monitoring/proxy/loggingProxy.js', () => ({
  applyLoggingProxyToClass: vi.fn(),
}));

const TEST_CONTAINER_NAME = 'container-name';
const TEST_FRPC_CONTAINER_NAME = `frpc-${TEST_CONTAINER_NAME}`;
const TEST_FLOW_ID = 'flow-123';
const TEST_DEPLOYMENT_HASH = 'deployment-hash-456';
const TEST_DEPLOYMENT_ID = 'my-deployment-id';
const TEST_PROXY_NAME_1 = 'proxy-1';
const TEST_CONTAINER_NAME_1 = 'container-1';
const TEST_CONTAINER_PORT_1 = '8080';
const TEST_CUSTOM_DOMAIN_1 = 'test1.domain.com';
const TEST_PROXY_NAME_2 = 'proxy-2';
const TEST_CONTAINER_NAME_2 = 'container-2';
const TEST_CONTAINER_PORT_2 = '3000';
const TEST_CUSTOM_DOMAIN_2 = 'test2.domain.com';
const TEST_CUSTOM_FLOW_ID = 'custom-flow-id-789';

describe('Provider', () => {
  let provider: Provider;
  const mockContainerOrchestration = {} as any;
  const mockRepository = {} as any;
  const mockResourceManager = {} as any;

  beforeEach(() => {
    provider = new Provider(
      mockContainerOrchestration,
      mockRepository,
      mockResourceManager,
    );
  });

  describe('generateFrpcContainerConfig', () => {
    const baseFlow: Flow = {
      id: TEST_FLOW_ID,
      jobDefinition: {
        version: '0.1',
        type: 'container',
        ops: [],
      },
      project: 'test-project',
      state: {
        status: 'running',
        startTime: Date.now(),
        endTime: null,
        opStates: [],
      },
    };

    const baseNetworks = { 'network-1': {} };
    const baseProxies = [
      {
        name: TEST_PROXY_NAME_1,
        localIp: TEST_CONTAINER_NAME_1,
        localPorts: TEST_CONTAINER_PORT_1,
        customDomain: TEST_CUSTOM_DOMAIN_1,
      },
    ];

    it('should generate basic config without load balancing', () => {
      const result = provider.generateFrpcContainerConfig(
        TEST_CONTAINER_NAME,
        baseNetworks,
        baseFlow,
        baseProxies,
        false,
        undefined,
      );

      expect(result).toStrictEqual({
        name: TEST_FRPC_CONTAINER_NAME,
        cmd: ['/entrypoint.sh'],
        networks: baseNetworks,
        requires_network_mode: true,
        env: {
          FRP_SERVER_ADDR: TEST_SERVER_ADDRESS,
          FRP_SERVER_PORT: TEST_SERVER_PORT.toString(),
          NOSANA_ID: TEST_FLOW_ID,
          FRP_PROXIES: JSON.stringify(baseProxies),
          DEPLOYMENT_ID: '',
          JOB_ID: TEST_FLOW_ID,
        },
      });
    });

    it('should not include FRP_LB_GROUP_KEY when load balancing is disabled', () => {
      const result = provider.generateFrpcContainerConfig(
        TEST_CONTAINER_NAME,
        baseNetworks,
        baseFlow,
        baseProxies,
        false,
        undefined,
      );

      expect(result.env).not.toHaveProperty('FRP_LB_GROUP_KEY');
    });

    it('should include FRP_LB_GROUP_KEY when load balancing is enabled', () => {
      const result = provider.generateFrpcContainerConfig(
        TEST_CONTAINER_NAME,
        baseNetworks,
        baseFlow,
        baseProxies,
        true,
        TEST_DEPLOYMENT_HASH,
      );

      expect(result.env.FRP_LB_GROUP_KEY).toBe(TEST_DEPLOYMENT_HASH);
    });

    it('should set DEPLOYMENT_ID from flow.jobDefinition.deployment_id when present', () => {
      const flowWithDeployment: Flow = {
        ...baseFlow,
        jobDefinition: {
          ...baseFlow.jobDefinition,
          deployment_id: TEST_DEPLOYMENT_ID,
        },
      };

      const result = provider.generateFrpcContainerConfig(
        TEST_CONTAINER_NAME,
        baseNetworks,
        flowWithDeployment,
        baseProxies,
        false,
        undefined,
      );

      expect(result.env.DEPLOYMENT_ID).toBe(TEST_DEPLOYMENT_ID);
    });

    it('should set DEPLOYMENT_ID to empty string when deployment_id is not present', () => {
      const result = provider.generateFrpcContainerConfig(
        TEST_CONTAINER_NAME,
        baseNetworks,
        baseFlow,
        baseProxies,
        false,
        undefined,
      );

      expect(result.env.DEPLOYMENT_ID).toBe('');
    });

    it('should serialize proxies array to JSON string', () => {
      const multipleProxies = [
        {
          name: TEST_PROXY_NAME_1,
          localIp: TEST_CONTAINER_NAME_1,
          localPorts: TEST_CONTAINER_PORT_1,
          customDomain: TEST_CUSTOM_DOMAIN_1,
        },
        {
          name: TEST_PROXY_NAME_2,
          localIp: TEST_CONTAINER_NAME_2,
          localPorts: TEST_CONTAINER_PORT_2,
          customDomain: TEST_CUSTOM_DOMAIN_2,
        },
      ];

      const result = provider.generateFrpcContainerConfig(
        TEST_CONTAINER_NAME,
        baseNetworks,
        baseFlow,
        multipleProxies,
        false,
        undefined,
      );

      expect(result.env.FRP_PROXIES).toBe(JSON.stringify(multipleProxies));
      expect(JSON.parse(result.env.FRP_PROXIES)).toStrictEqual(multipleProxies);
    });

    it('should use flow.id for both NOSANA_ID and JOB_ID', () => {
      const flowWithCustomId: Flow = {
        ...baseFlow,
        id: TEST_CUSTOM_FLOW_ID,
      };

      const result = provider.generateFrpcContainerConfig(
        TEST_CONTAINER_NAME,
        baseNetworks,
        flowWithCustomId,
        baseProxies,
        false,
        undefined,
      );

      expect(result.env.NOSANA_ID).toBe(TEST_CUSTOM_FLOW_ID);
      expect(result.env.JOB_ID).toBe(TEST_CUSTOM_FLOW_ID);
    });

    it('should prefix container name with frpc-', () => {
      const result = provider.generateFrpcContainerConfig(
        TEST_CONTAINER_NAME,
        baseNetworks,
        baseFlow,
        baseProxies,
        false,
        undefined,
      );

      expect(result.name).toBe(TEST_FRPC_CONTAINER_NAME);
    });

    it('should pass networks through unchanged', () => {
      const customNetworks = {
        'network-a': {},
        'network-b': {},
      };

      const result = provider.generateFrpcContainerConfig(
        TEST_CONTAINER_NAME,
        customNetworks,
        baseFlow,
        baseProxies,
        false,
        undefined,
      );

      expect(result.networks).toBe(customNetworks);
    });
  });
});
