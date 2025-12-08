import { describe, expect, it, vi } from 'vitest';
import { generateProxyConfig } from '../expose-util.js';
import type { ExposedPort, Operation } from '@nosana/sdk';

const TEST_SERVER_ADDRESS = `test.node.example.com`;
const TEST_OP_ID = 'test-op-id';
const TEST_GENERATED_ID = 'generated-id-123';
const TEST_OPERATION_ID = 'operation-456';
const TEST_PROXY_NAME = `${TEST_GENERATED_ID}-${TEST_OPERATION_ID}`;
const TEST_CONTAINER_NAME = 'container-name';
const TEST_DEPLOYMENT_ID = 'deployment-id-789';
const TEST_PROXY_CUSTOM_FQDN = `${TEST_GENERATED_ID}.${TEST_SERVER_ADDRESS}`;
const TEST_PROXY_DEPLOYMENT_FQDN = `${TEST_DEPLOYMENT_ID}.${TEST_SERVER_ADDRESS}`;
const TEST_PORT_3000 = 3000;
const TEST_PORT_8080 = 8080;
const TEST_PORT_RANGE_8000_8010 = '8000-8010';
const TEST_DEPLOYMENT_PORT_3000_LB_GROUP = `${TEST_DEPLOYMENT_ID}-${TEST_PORT_3000}`;
const TEST_DEPLOYMENT_PORT_8080_LB_GROUP = `${TEST_DEPLOYMENT_ID}-${TEST_PORT_8080}`;
const TEST_HEALTH_CHECK_PATH = '/health';

vi.mock('../../services/NodeManager/configs/configs.js', () => ({
  configs: () => ({
    frp: {
      serverAddr: TEST_SERVER_ADDRESS,
      serverPort: 7000,
    },
  }),
}));

describe('generateProxyConfig', () => {
  const baseOp: Operation<'container/run'> = {
    type: 'container/run',
    id: TEST_OP_ID,
    args: {
      image: 'nginx:latest',
    },
  };

  const baseExposedPort: ExposedPort = {
    port: TEST_PORT_8080,
  };

  it('should generate basic proxy config without deployment', () => {
    const result = generateProxyConfig(
      TEST_GENERATED_ID,
      TEST_OPERATION_ID,
      TEST_CONTAINER_NAME,
      baseExposedPort,
      baseOp,
      undefined,
      undefined,
    );

    expect(result).toStrictEqual({
      name: TEST_PROXY_NAME,
      localIp: TEST_CONTAINER_NAME,
      localPorts: TEST_PORT_8080.toString(),
      opId: TEST_OP_ID,
      customDomain: TEST_PROXY_CUSTOM_FQDN,
    });
  });

  it('should handle null operationId', () => {
    const result = generateProxyConfig(
      TEST_GENERATED_ID,
      null,
      TEST_CONTAINER_NAME,
      baseExposedPort,
      baseOp,
      undefined,
      undefined,
    );

    expect(result.name).toBe(`${TEST_GENERATED_ID}-null`);
  });

  it('should include deployment fields when generatedDeploymentId is provided', () => {
    const exposedPortWithoutHealthChecks: ExposedPort = {
      port: TEST_PORT_3000,
    };

    const result = generateProxyConfig(
      TEST_GENERATED_ID,
      TEST_OPERATION_ID,
      TEST_CONTAINER_NAME,
      exposedPortWithoutHealthChecks,
      baseOp,
      TEST_DEPLOYMENT_ID,
      undefined,
    );

    expect(result).toStrictEqual({
      name: TEST_PROXY_NAME,
      localIp: TEST_CONTAINER_NAME,
      localPorts: TEST_PORT_3000.toString(),
      opId: TEST_OP_ID,
      customDomain: TEST_PROXY_CUSTOM_FQDN,
      deploymentDomain: TEST_PROXY_DEPLOYMENT_FQDN,
      deploymentLoadBalancerGroup: TEST_DEPLOYMENT_PORT_3000_LB_GROUP,
    });
  });

  it('should include deploymentHealthCheckPath when deployment has health checks', () => {
    const exposedPortWithHealthChecks: ExposedPort = {
      port: TEST_PORT_8080,
      health_checks: [
        {
          type: 'http',
          path: TEST_HEALTH_CHECK_PATH,
          method: 'GET',
          expected_status: 200,
          continuous: false,
        },
      ],
    };

    const result = generateProxyConfig(
      TEST_GENERATED_ID,
      TEST_OPERATION_ID,
      TEST_CONTAINER_NAME,
      exposedPortWithHealthChecks,
      baseOp,
      TEST_DEPLOYMENT_ID,
      TEST_HEALTH_CHECK_PATH,
    );

    expect(result).toStrictEqual({
      name: TEST_PROXY_NAME,
      localIp: TEST_CONTAINER_NAME,
      localPorts: TEST_PORT_8080.toString(),
      opId: TEST_OP_ID,
      customDomain: TEST_PROXY_CUSTOM_FQDN,
      deploymentDomain: TEST_PROXY_DEPLOYMENT_FQDN,
      deploymentLoadBalancerGroup: TEST_DEPLOYMENT_PORT_8080_LB_GROUP,
      deploymentHealthCheckPath: TEST_HEALTH_CHECK_PATH,
    });
  });

  it('should not include deploymentHealthCheckPath when exposedPort has no health_checks', () => {
    const exposedPortWithoutHealthChecks: ExposedPort = {
      port: TEST_PORT_8080,
    };

    const result = generateProxyConfig(
      TEST_GENERATED_ID,
      TEST_OPERATION_ID,
      TEST_CONTAINER_NAME,
      exposedPortWithoutHealthChecks,
      baseOp,
      TEST_DEPLOYMENT_ID,
      TEST_HEALTH_CHECK_PATH,
    );

    expect(result).not.toHaveProperty('deploymentHealthCheckPath');
  });

  it('should convert port number to string in localPorts', () => {
    const exposedPort: ExposedPort = {
      port: 443,
    };

    const result = generateProxyConfig(
      TEST_GENERATED_ID,
      TEST_OP_ID,
      TEST_CONTAINER_NAME,
      exposedPort,
      baseOp,
      undefined,
      undefined,
    );

    expect(result.localPorts).toBe('443');
    expect(typeof result.localPorts).toBe('string');
  });

  it('should handle port range string', () => {
    const exposedPortWithRange: ExposedPort = {
      port: TEST_PORT_RANGE_8000_8010 as ExposedPort['port'],
    };

    const result = generateProxyConfig(
      TEST_GENERATED_ID,
      TEST_OP_ID,
      TEST_CONTAINER_NAME,
      exposedPortWithRange,
      baseOp,
      undefined,
      undefined,
    );

    expect(result.localPorts).toBe(TEST_PORT_RANGE_8000_8010);
  });
});
