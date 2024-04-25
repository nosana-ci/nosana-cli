import { OpState, OperationResult, OperationResults } from '../Provider.js';

/**
 * Initiates results object to retain order from job definition
 * @param operationResults OperationResults | undefined
 * @returns {Object.<string, string | string[]>} initiated object
 */
function createResultsObject(operationResults: OperationResults): {
  [key: string]: string | string[];
} {
  return Object.keys(operationResults).reduce(
    (obj: { [key: string]: string[] }, key) => ((obj[key] = []), obj),
    {},
  );
}

/**
 * extracts operation results from logs
 * @param logs OpState['logs']
 * @param operationResults OperationResults | undefined
 * @returns extractedResults | undefined
 */
export function extractResultsFromLogs(
  logs: OpState['logs'],
  operationResults: OperationResults | undefined,
): OpState['results'] {
  if (!operationResults || logs.length === 0) return undefined;

  let extractedResults = createResultsObject(operationResults);

  if (operationResults) {
    for (let { type, log } of logs) {
      for (let [filterName, filter] of Object.entries(operationResults)) {
        let regex: string;
        let logType: OperationResult['logType'] | undefined;

        if (typeof filter === 'string') regex = filter;
        else (regex = filter.regex), (logType = filter.logType);

        if ((logType === undefined || logType?.includes(type)) && log) {
          try {
            const regexExp = new RegExp(regex === '*' ? '/*' : regex);

            extractedResults[filterName] = [
              ...extractedResults[filterName],
              ...(log.match(regexExp) || []),
            ];
          } catch (err) {
            extractedResults[filterName] = `${err}`;
          }
        }
      }
    }
  }

  return extractedResults;
}
