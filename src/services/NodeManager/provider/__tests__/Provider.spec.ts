import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Provider } from '../Provider.js';
import type { Flow, Operation } from '@nosana/sdk';
import { isOpExposed, getExposePorts } from '@nosana/sdk';
import {
  generateProxies,
  generateUrlSecretObject,
} from '../../../../generic/expose-util.js';
import EventEmitter from 'events';

const TEST_SERVER_ADDRESS = 'test.frp.server.com';
const TEST_SERVER_PORT = 7000;
const TEST_FRPC_IMAGE = 'test-frpc-image:latest';
const TEST_TUNNEL_IMAGE = 'test-tunnel-image:latest';

vi.mock('../../configs/configs.js', () => ({
  configs: () => ({
    frp: {
      serverAddr: TEST_SERVER_ADDRESS,
      serverPort: TEST_SERVER_PORT,
      containerImage: TEST_FRPC_IMAGE,
    },
    tunnel: {
      containerImage: TEST_TUNNEL_IMAGE,
    },
  }),
}));

vi.mock('../../configs/NodeConfigs.js', () => ({
  NodeConfigsSingleton: {
    getInstance: vi.fn().mockReturnValue({ options: { isNodeRun: false } }),
  },
}));

vi.mock('../../monitoring/proxy/loggingProxy.js', () => ({
  applyLoggingProxyToClass: vi.fn(),
}));

vi.mock('@nosana/sdk', async () => {
  const actual = await vi.importActual('@nosana/sdk');
  return {
    ...actual,
    isOpExposed: vi.fn(),
    getExposePorts: vi.fn().mockReturnValue([]),
  };
});

vi.mock('../../../../generic/expose-util.js', () => ({
  generateProxies: vi.fn().mockReturnValue({ proxies: [], idMap: new Map() }),
  generateUrlSecretObject: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../../generic/timeoutPromiseWrapper.js', () => ({
  promiseTimeoutWrapper: vi.fn((promise) => promise),
}));

const TEST_CONTAINER_ID = 'container-id';
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

const TEST_ADDRESS = 'test-address';
const TEST_JOB_DEFINITION_TYPE = 'container';
const TEST_JOB_DEFINITION_VERSION = '0.1';
const TEST_PROJECT = 'test-project';
const TEST_STATE_RUNNING = 'running';
const TEST_NOW = Date.now();
const TEST_OP_ID = 'op-1';
const TEST_OP_TYPE = 'container/run';
const TEST_OP_CONTAINER_IMAGE = 'test-image:latest';

describe('Provider', () => {
  let provider: Provider;
  let mockContainerOrchestration: any;
  let mockRepository: any;
  let mockResourceManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContainerOrchestration = {
      pullImage: vi.fn().mockResolvedValue(undefined),
      runFlowContainer: vi.fn().mockResolvedValue({
        id: TEST_CONTAINER_ID,
        logs: vi.fn().mockResolvedValue({
          on: vi.fn(),
          removeAllListeners: vi.fn(),
        }),
        wait: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({ State: { ExitCode: 0 } }),
      }),
      doesContainerExist: vi.fn().mockResolvedValue(false),
      isContainerExited: vi.fn().mockResolvedValue(false),
      stopAndDeleteContainer: vi.fn().mockResolvedValue(undefined),
      createNetwork: vi.fn().mockResolvedValue(undefined),
      deleteNetwork: vi.fn().mockResolvedValue(undefined),
      hasNetwork: vi.fn().mockResolvedValue(false),
      getContainer: vi.fn().mockReturnValue({
        id: TEST_CONTAINER_ID,
        logs: vi.fn().mockResolvedValue({
          on: vi.fn(),
          removeAllListeners: vi.fn(),
        }),
        wait: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({ State: { ExitCode: 0 } }),
      }),
      getContainersByName: vi.fn().mockResolvedValue([]),
    };

    mockRepository = {
      updateflowStateSecret: vi.fn(),
      getFlowSecret: vi.fn().mockReturnValue({}),
    };

    mockResourceManager = {
      images: {
        setImage: vi.fn(),
      },
      getResourceVolumes: vi.fn().mockResolvedValue([]),
    };

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
        version: TEST_JOB_DEFINITION_VERSION,
        type: TEST_JOB_DEFINITION_TYPE,
        ops: [],
      },
      project: TEST_PROJECT,
      state: {
        status: TEST_STATE_RUNNING,
        startTime: TEST_NOW,
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

  describe('setUpReverseProxyApi', () => {
    const testAddress = TEST_ADDRESS;

    it('should pull the frpcImage', async () => {
      await provider.setUpReverseProxyApi(testAddress);

      expect(mockContainerOrchestration.pullImage).toHaveBeenCalledWith(
        TEST_FRPC_IMAGE,
        undefined,
        expect.any(AbortController),
      );
    });

    it('should register frpcImage with resource manager', async () => {
      await provider.setUpReverseProxyApi(testAddress);

      expect(mockResourceManager.images.setImage).toHaveBeenCalledWith(
        TEST_FRPC_IMAGE,
      );
    });

    it('should run frpc container with frpcImage when container does not exist', async () => {
      mockContainerOrchestration.doesContainerExist.mockResolvedValue(false);

      await provider.setUpReverseProxyApi(testAddress);

      const runFlowContainerCalls =
        mockContainerOrchestration.runFlowContainer.mock.calls;
      const frpcContainerCall = runFlowContainerCalls.find(
        (call: any[]) => call[0] === TEST_FRPC_IMAGE,
      );

      expect(frpcContainerCall).toBeDefined();
      expect(frpcContainerCall[0]).toBe(TEST_FRPC_IMAGE);
    });

    it('should run frpc container with frpcImage when container has exited', async () => {
      mockContainerOrchestration.doesContainerExist
        .mockResolvedValueOnce(false) // tunnel check
        .mockResolvedValueOnce(true); // frpc check
      mockContainerOrchestration.isContainerExited.mockResolvedValue(true);

      await provider.setUpReverseProxyApi(testAddress);

      const runFlowContainerCalls =
        mockContainerOrchestration.runFlowContainer.mock.calls;
      const frpcContainerCall = runFlowContainerCalls.find(
        (call: any[]) => call[0] === TEST_FRPC_IMAGE,
      );

      expect(frpcContainerCall).toBeDefined();
      expect(frpcContainerCall[0]).toBe(TEST_FRPC_IMAGE);
    });

    it('should pull the tunnelImage', async () => {
      await provider.setUpReverseProxyApi(testAddress);

      expect(mockContainerOrchestration.pullImage).toHaveBeenCalledWith(
        TEST_TUNNEL_IMAGE,
        undefined,
        expect.any(AbortController),
      );
    });

    it('should register tunnelImage with resource manager', async () => {
      await provider.setUpReverseProxyApi(testAddress);

      expect(mockResourceManager.images.setImage).toHaveBeenCalledWith(
        TEST_TUNNEL_IMAGE,
      );
    });

    it('should run tunnel container with tunnelImage when container does not exist', async () => {
      mockContainerOrchestration.doesContainerExist.mockResolvedValue(false);

      await provider.setUpReverseProxyApi(testAddress);

      const runFlowContainerCalls =
        mockContainerOrchestration.runFlowContainer.mock.calls;
      const tunnelContainerCall = runFlowContainerCalls.find(
        (call: any[]) => call[0] === TEST_TUNNEL_IMAGE,
      );

      expect(tunnelContainerCall).toBeDefined();
      expect(tunnelContainerCall[0]).toBe(TEST_TUNNEL_IMAGE);
    });

    it('should run tunnel container with tunnelImage when container has exited', async () => {
      mockContainerOrchestration.doesContainerExist
        .mockResolvedValueOnce(true) // tunnel check
        .mockResolvedValueOnce(false); // frpc check
      mockContainerOrchestration.isContainerExited.mockResolvedValue(true);

      await provider.setUpReverseProxyApi(testAddress);

      const runFlowContainerCalls =
        mockContainerOrchestration.runFlowContainer.mock.calls;
      const tunnelContainerCall = runFlowContainerCalls.find(
        (call: any[]) => call[0] === TEST_TUNNEL_IMAGE,
      );

      expect(tunnelContainerCall).toBeDefined();
      expect(tunnelContainerCall[0]).toBe(TEST_TUNNEL_IMAGE);
    });
  });

  describe('taskManagerContainerRunOperation', () => {
    const baseFlow: Flow = {
      id: TEST_FLOW_ID,
      jobDefinition: {
        version: TEST_JOB_DEFINITION_VERSION,
        type: TEST_JOB_DEFINITION_TYPE,
        ops: [
          {
            id: TEST_OP_ID,
            type: TEST_OP_TYPE,
            args: {
              image: TEST_OP_CONTAINER_IMAGE,
            },
          },
        ],
      },
      project: TEST_PROJECT,
      state: {
        status: TEST_STATE_RUNNING,
        startTime: TEST_NOW,
        endTime: null,
        opStates: [],
      },
    };

    const baseOp: Operation<'container/run'> = {
      id: TEST_OP_ID,
      type: TEST_OP_TYPE,
      args: {
        image: TEST_OP_CONTAINER_IMAGE,
      },
    };

    describe('when operation is exposed', () => {
      beforeEach(() => {
        vi.mocked(isOpExposed).mockReturnValue(true);
        vi.mocked(getExposePorts).mockReturnValue([
          { port: parseInt(TEST_CONTAINER_PORT_1), type: 'http' },
        ]);
        vi.mocked(generateProxies).mockReturnValue({
          proxies: [],
          idMap: new Map(),
        });
      });

      it('should pull the frpcImage', async () => {
        const emitter = new EventEmitter();
        const controller = new AbortController();

        const operationPromise = provider.taskManagerContainerRunOperation(
          baseFlow,
          baseOp,
          controller,
          emitter,
        );

        await operationPromise;

        expect(mockContainerOrchestration.pullImage).toHaveBeenCalledWith(
          TEST_FRPC_IMAGE,
          undefined,
          controller,
        );
      });

      it('should register frpcImage with resource manager', async () => {
        const emitter = new EventEmitter();
        const controller = new AbortController();

        const operationPromise = provider.taskManagerContainerRunOperation(
          baseFlow,
          baseOp,
          controller,
          emitter,
        );

        await operationPromise;

        expect(mockResourceManager.images.setImage).toHaveBeenCalledWith(
          TEST_FRPC_IMAGE,
        );
      });

      it('should run frpc container with frpcImage', async () => {
        const emitter = new EventEmitter();
        const controller = new AbortController();

        const operationPromise = provider.taskManagerContainerRunOperation(
          baseFlow,
          baseOp,
          controller,
          emitter,
        );

        await operationPromise;

        const runFlowContainerCalls =
          mockContainerOrchestration.runFlowContainer.mock.calls;
        const frpcContainerCall = runFlowContainerCalls.find(
          (call: any[]) => call[0] === TEST_FRPC_IMAGE,
        );
        expect(frpcContainerCall).toBeDefined();
        expect(frpcContainerCall[0]).toBe(TEST_FRPC_IMAGE);
      });
    });

    describe('when operation is NOT exposed', () => {
      beforeEach(() => {
        vi.mocked(isOpExposed).mockReturnValue(false);
        vi.mocked(getExposePorts).mockReturnValue([]);
      });

      it('should NOT pull or use frpcImage', async () => {
        const emitter = new EventEmitter();
        const controller = new AbortController();

        const operationPromise = provider.taskManagerContainerRunOperation(
          baseFlow,
          baseOp,
          controller,
          emitter,
        );

        await operationPromise;

        const pullImageCalls = mockContainerOrchestration.pullImage.mock.calls;
        const frpcPullCall = pullImageCalls.find(
          (call: any[]) => call[0] === TEST_FRPC_IMAGE,
        );
        expect(frpcPullCall).toBeUndefined();

        const setImageCalls = mockResourceManager.images.setImage.mock.calls;
        const frpcSetImageCall = setImageCalls.find(
          (call: any[]) => call[0] === TEST_FRPC_IMAGE,
        );
        expect(frpcSetImageCall).toBeUndefined();

        const runFlowContainerCalls =
          mockContainerOrchestration.runFlowContainer.mock.calls;
        const frpcContainerCall = runFlowContainerCalls.find(
          (call: any[]) => call[0] === TEST_FRPC_IMAGE,
        );
        expect(frpcContainerCall).toBeUndefined();
      });
    });
  });
});
