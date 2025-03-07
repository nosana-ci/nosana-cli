// import { Operation, OperationType, OperationArgsMap } from '@nosana/sdk';
import { createHash, randomBytes } from 'crypto';
import { JobDefinition, Operation, OperationArgsMap } from '../services/NodeManager/provider/types.js';
import { configType } from './config.js';
import { isPrivate } from './ops-util.js';
import { configs } from '../services/NodeManager/configs/configs.js';
import { ExposedPort } from '@nosana/sdk';

export const getExposePorts = (op: Operation<'container/run'>): ExposedPort[] => {
  const expose = (op.args as OperationArgsMap['container/run']).expose;

  if (!expose) return [];

  if (typeof expose === 'number') {
    return [{ port: expose, type: 'none' }]; // Convert single number to ExposedPort
  }

  if (Array.isArray(expose)) {
    return expose.map(e => (typeof e === 'number' ? { port: e, type: 'none' } : e)); // Convert numbers to ExposedPort
  }

  return [];
};

export const isOpExposed = (op: Operation<'container/run'>): boolean => {
  const exposePorts = getExposePorts(op);
  return exposePorts.length > 0; // Returns true if any ports exist
};

const hashString = (input: string, length: number): string => {
  return createHash('sha256').update(input).digest('hex').substring(0, length);
};

export const getExposeIdHash = (
  flowId: string,
  opId: string,
  port: string,
): string => {
  const idLength = 45;
  const inputString = `${flowId}:${opId}:${port}`;
  return hashString(inputString, idLength);
};

export const generateExposeId = (
  flowId: string,
  opId: string,
  port: string,
  isPrivate?: boolean,
): string => {
  const idLength = 45;

  if (isPrivate) {
    const randomData = randomBytes(45).toString('hex');
    return hashString(randomData, idLength);
  } else {
    return getExposeIdHash(flowId, opId, port);
  }
};

export const getJobUrls = (
  job: JobDefinition,
  flowId: string,
): string[] => {
  const urls: string[] = [];
  const privateMode = isPrivate(job);

  Object.entries(job.ops).forEach(([, op]) => {
    if (isOpExposed(op as Operation<'container/run'>)) {
      const exposePorts = getExposePorts(op as Operation<'container/run'>);

      exposePorts.forEach((port) => {
        const exposeId = generateExposeId(
          flowId,
          op.id,
          port.toString(),
          privateMode,
        );
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
  operationId: string | null
) => {

  const proxies = [];

  const idMap: Map<string, ExposedPort> = new Map();

  for (let exosedport of ports) {
    const generatedId = generateExposeId(
      flowId,
      op.id,
      exosedport.port.toString(),
      op.args.private
    );

    proxies.push({
      name: `${generatedId}-${operationId}`,
      localIp: name,
      localPort: exosedport.port.toString(),
      customDomain: generatedId + '.' + configs().frp.serverAddr
    });

    idMap.set(generatedId, exosedport);
  }

  return { proxies, idMap };
}

export const generateUrlSecretObject = (idMap: Map<string, ExposedPort>) => 
  Object.fromEntries(
    Array.from(idMap, ([id, port]) => [id, { type: port.type, port: port.port, url: `https://${id + '.' + configs().frp.serverAddr}` }])
  );