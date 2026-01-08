import { parseBuffer } from '../../services/NodeManager/provider/utils/parseBuffer.js';
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
      timestamp: new Date().toISOString(),
    });
  }, expiryTimeout);

  while (index < logBuffer.length && running) {
    const log = parseBuffer(logBuffer, index);

    logs.push(log);
    if (results && operationResults) {
      extractResultFromLog(results, log, operationResults);
    }

    if (logs.length >= 25000) {
      running = false;
      logs.push({
        type: 'nodeerr',
        log: 'Found too many logs...',
        timestamp: new Date().toISOString(),
      });
    }
  }

  clearTimeout(timer);

  return { logs, results };
}
