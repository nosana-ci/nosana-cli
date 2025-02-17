import { Operation, OperationType, OperationArgsMap } from '@nosana/sdk';
import { createHash, randomBytes } from 'crypto';
import { JobDefinition } from "../services/NodeManager/provider/types.js";
import { configType } from "./config.js";
import { isPrivate } from "./ops-util.js";

export const getExposePorts = (op: Operation<'container/run'>): number[] => {
  const expose = (op.args as OperationArgsMap['container/run']).expose;

  if (typeof expose === 'number') return [expose];
  if (Array.isArray(expose)) return expose;

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

export const getJobUrls = (job: JobDefinition, flowId: string, config: configType): string[] => {
  const urls: string[] = [];
  const privateMode = isPrivate(job);

  Object.entries(job.ops).forEach(([, op]) => {
    if (isOpExposed(op as Operation<'container/run'>)) {
      const exposePorts = getExposePorts(op as Operation<'container/run'>);

      exposePorts.forEach(port => {
        const exposeId = generateExposeId(flowId, op.id, port.toString(), privateMode);
        const url = `${exposeId}.${config.frp.serverAddr}`;
        urls.push(url);
      });
    }
  });

  return urls;
};
