import { randomBytes } from 'crypto';
import { JobDefinition } from '../services/NodeManager/provider/types.js';
import { isPrivate } from './ops-util.js';
import { configs } from '../services/NodeManager/configs/configs.js';
import {
  createHash,
  ExposedPort,
  getExposeIdHash,
  getExposePorts,
  HttpHealthCheck,
  isOpExposed,
  Operation,
} from '@nosana/sdk';

export const generateExposeId = (
  flowId: string,
  op: number | string,
  port: number | string,
  isPrivate?: boolean,
): string => {
  const idLength = 45;

  if (isPrivate) {
    const randomData = randomBytes(45).toString('hex');
    return createHash(randomData, idLength);
  } else {
    return getExposeIdHash(flowId, op, port);
  }
};

export const getJobUrls = (job: JobDefinition, flowId: string): string[] => {
  const urls: string[] = [];
  const privateMode = isPrivate(job);

  if (privateMode) {
    return ['private'];
  }

  Object.entries(job.ops).forEach(([, op], index) => {
    if (isOpExposed(op as Operation<'container/run'>)) {
      const exposePorts = getExposePorts(op as Operation<'container/run'>);

      exposePorts.forEach((port) => {
        const exposeId = getExposeIdHash(flowId, index, port.port);
        const url = `${exposeId}.${configs().frp.serverAddr}`;
        urls.push(url);
      });
    }
  });

  return urls;
};

export function generateProxyConfig(
  generatedId: string,
  operationId: string | null,
  name: string,
  exposedPort: ExposedPort,
  op: Operation<'container/run'>,
  generatedDeploymentId: string | undefined,
  proxyHTTPHealthCheckPath: undefined | string,
) {
  return {
    name: `${generatedId}-${operationId}`,
    localIp: name,
    localPorts: exposedPort.port.toString(),
    opId: op.id,
    customDomain: generatedId + '.' + configs().frp.serverAddr,
    ...(generatedDeploymentId && {
      deploymentDomain: generatedDeploymentId + '.' + configs().frp.serverAddr,
      deploymentLoadBalancerGroup: `${generatedDeploymentId}-${exposedPort.port}`,
      ...(exposedPort.health_checks && {
        deploymentHealthCheckPath: proxyHTTPHealthCheckPath,
      }),
    }),
  };
}

export const generateProxies = (
  flowId: string,
  op: Operation<'container/run'>,
  opIndex: number,
  ports: ExposedPort[],
  name: string,
  operationId: string | null,
  deploymentId?: string | undefined,
) => {
  const proxies = [];

  const idMap: Map<string, ExposedPort> = new Map();

  for (let exposedPort of ports) {
    // TODO: use ids generated in the taskmanager to make secerts
    const generatedId = generateExposeId(
      flowId,
      opIndex,
      exposedPort.port,
      op.args.private,
    );

    const generatedDeploymentId = deploymentId
      ? generateExposeId(deploymentId, op.id, 0, false)
      : undefined;

    let proxyHTTPHealthCheckPath: string | undefined = undefined;

    if (exposedPort.health_checks && exposedPort.health_checks.length > 0) {
      const http_checks = exposedPort.health_checks.filter(
        (healthCheck) =>
          healthCheck.type === 'http' &&
          healthCheck.method === 'GET' &&
          healthCheck.expected_status === 200,
      );
      if (http_checks.length > 0) {
        proxyHTTPHealthCheckPath = (http_checks[0] as HttpHealthCheck).path;
      }
    }

    proxies.push(
      generateProxyConfig(
        generatedId,
        operationId,
        name,
        exposedPort,
        op,
        generatedDeploymentId,
        proxyHTTPHealthCheckPath,
      ),
    );

    idMap.set(generatedId, exposedPort);
  }

  return { proxies, idMap };
};

export const generateUrlSecretObject = (
  idMap: Map<string, ExposedPort>,
  operationId: string,
): Record<
  string,
  {
    opID: string;
    port: number | string;
    url: string;
    status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  }
> =>
  Object.fromEntries(
    Array.from(idMap, ([id, exposedPort]) => {
      const hasHealthChecks = Array.isArray(exposedPort.health_checks)
        ? exposedPort.health_checks.length > 0
        : false;
      const initialStatus: 'OFFLINE' | 'UNKNOWN' = hasHealthChecks
        ? 'OFFLINE'
        : 'UNKNOWN';

      return [
        id,
        {
          opID: operationId,
          port: exposedPort.port,
          url: `https://${id + '.' + configs().frp.serverAddr}`,
          status: initialStatus,
        },
      ];
    }),
  );
