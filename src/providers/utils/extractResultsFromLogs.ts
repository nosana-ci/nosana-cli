import { OperationResults, Log, OperationResult } from '@nosana/sdk';

/**
 * Initiates results object to retain order from job definition
 * @param operationResults OperationResults | undefined
 * @returns {Object.<string, string | string[]>} initiated object
 */
export function createResultsObject(operationResults: OperationResults): {
  [key: string]: string | string[];
} {
  return Object.keys(operationResults).reduce(
    (obj: { [key: string]: string[] }, key) => ((obj[key] = []), obj),
    {},
  );
}

/**
 * extracts operation results from log
 * @param resultObj
 * @param logObj
 * @param operationResults OperationResults
 */
export function extractResultFromLog(
  resultObj: { [key: string]: string | string[] },
  logObj: Log,
  operationResults: OperationResults,
): void {
  const { type, log } = logObj;
  for (let [filterName, filter] of Object.entries(operationResults)) {
    let regex: string;
    let logType: OperationResult['logType'] | undefined;

    if (typeof filter === 'string') regex = filter;
    else (regex = filter.regex), (logType = filter.logType);

    if ((logType === undefined || logType?.includes(type)) && log) {
      try {
        const regexExp = new RegExp(regex === '*' ? '/*' : regex);

        resultObj[filterName] = [
          ...resultObj[filterName],
          ...(log.match(regexExp) || []),
        ];
      } catch (err) {
        resultObj[filterName] = `${err}`;
      }
    }
  }
}
