import { log } from 'console';
import { Log, OperationResults, StdOptions } from '../Provider';
import {
  createResultsObject,
  extractResultFromLog,
} from './extractResultsFromLogs.js';

export function extractLogsAndResultsFromLogBuffer(
  logBuffer: Buffer,
  operationResults: OperationResults | undefined,
  expiryTimeout = 180,
): {
  logs: Log[];
  results: {} | undefined;
} {
  const logs: Log[] = [];
  const results: {} | undefined = operationResults
    ? createResultsObject(operationResults)
    : undefined;

  let index = 0,
    running = true;

  const timer = setTimeout(() => {
    running = false;
    logs.push({
      type: 'nodeerr',
      log: 'Took too long to retrive all logs',
    });
  }, expiryTimeout);

  while (index < logBuffer.length && running) {
    const head = logBuffer.subarray(index, (index += 8));
    const chunkType = head.readUInt8(0);
    const chunkLength = head.readUInt32BE(4);
    const content = logBuffer.subarray(index, (index += chunkLength));
    if (chunkType === 1 || chunkType === 2) {
      const logObj = {
        type: chunkType === 1 ? 'stdout' : ('stderr' as StdOptions),
        log: content.toString('utf-8'),
      };
      logs.push(logObj);
      if (results && operationResults) {
        extractResultFromLog(results, logObj, operationResults);
      }

      if (logs.length >= 24999) {
        running = false;
        logs.push({
          type: 'nodeerr',
          log: 'Found too many logs...',
        });
      }
    }
  }

  clearTimeout(timer);

  return { logs, results };
}
