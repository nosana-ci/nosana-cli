// import { Operation, OperationType, OperationArgsMap } from '@nosana/sdk';
import { randomBytes } from 'crypto';
import {
  JobDefinition,
  Operation,
  OperationArgsMap,
} from '../services/NodeManager/provider/types.js';
import { isPrivate } from './ops-util.js';
import { configs } from '../services/NodeManager/configs/configs.js';
import {
  createHash,
  ExposedPort,
  getExposeIdHash,
  getExposePorts,
  isOpExposed,
} from '@nosana/sdk';

export const generateExposeId = (
  flowId: string,
  opId: string,
  port: string,
  isPrivate?: boolean,
): string => {
  const idLength = 45;

  if (isPrivate) {
    const randomData = randomBytes(45).toString('hex');
    return createHash(randomData, idLength);
  } else {
    return getExposeIdHash(flowId, opId, port);
  }
};

export const getJobUrls = (job: JobDefinition, flowId: string): string[] => {
  const urls: string[] = [];
  const privateMode = isPrivate(job);

  if (privateMode) {
    return ['private'];
  }

  Object.entries(job.ops).forEach(([, op]) => {
    if (isOpExposed(op as Operation<'container/run'>)) {
      const exposePorts = getExposePorts(op as Operation<'container/run'>);

      exposePorts.forEach((port) => {
        const exposeId = getExposeIdHash(flowId, op.id, port.port.toString());
        const url = `${exposeId}.${configs().frp.serverAddr}`;
        urls.push(url);
      });
    }
  });

  return urls;
};

export const generateProxies = (
  flowId: string,
  op: any,
  ports: ExposedPort[],
  name: string,
  operationId: string | null,
) => {
  const proxies = [];

  const idMap: Map<string, ExposedPort> = new Map();

  for (let exosedport of ports) {
    const generatedId = generateExposeId(
      flowId,
      op.id,
      exosedport.port.toString(),
      op.args.private,
    );

    proxies.push({
      name: `${generatedId}-${operationId}`,
      localIp: name,
      localPort: exosedport.port.toString(),
      customDomain: generatedId + '.' + configs().frp.serverAddr,
    });

    idMap.set(generatedId, exosedport);
  }

  return { proxies, idMap };
};

export const generateUrlSecretObject = (idMap: Map<string, ExposedPort>) =>
  Object.fromEntries(
    Array.from(idMap, ([id, port]) => [
      id,
      {
        type: port.type,
        port: port.port,
        url: `https://${id + '.' + configs().frp.serverAddr}`,
      },
    ]),
  );
