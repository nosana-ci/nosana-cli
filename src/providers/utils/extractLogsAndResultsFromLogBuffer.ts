import {
  createResultsObject,
  extractResultFromLog,
} from './extractResultsFromLogs.js';
import { OperationResults, Log, StdOptions } from '@nosana/sdk';

export function extractLogsAndResultsFromLogBuffer(
  logBuffer: Buffer,
  operationResults: OperationResults | undefined,
  expiryTimeout = 180,
): {
  logs: Log[];
  results: {} | undefined;
} {
  const allLogs: Log[] = [];
  const results: {} | undefined = operationResults
    ? createResultsObject(operationResults)
    : undefined;

  let index = 0,
    running = true;

  const timer = setTimeout(() => {
    running = false;
    allLogs.push({
      type: 'nodeerr',
      log: 'Took too long to retrieve all logs',
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
      allLogs.push(logObj);

      if (results && operationResults) {
        extractResultFromLog(results, logObj, operationResults);
      }
    }
  }

  clearTimeout(timer);

  // only return the last 25k logs
  const logs = allLogs.slice(-25000);

  return { logs, results };
}
