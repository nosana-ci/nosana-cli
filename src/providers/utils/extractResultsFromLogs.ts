/**
 * extracts operation results from logs
 * @param logs OpState['logs']
 * @param operationResults OperationResults | undefined
 * @returns extractedResults | undefined
 */

import { OpState, OperationResults } from '../Provider';

export function extractResultsFromLogs(
  logs: OpState['logs'],
  operationResults: OperationResults | undefined,
): OpState['results'] {
  if (!operationResults || logs.length === 0) return undefined;

  let extractedResults: { [key: string]: string | string[] } = {};

  if (operationResults) {
    for (let { type, log } of logs) {
      for (let [filterName, { logType, regex }] of Object.entries(
        operationResults,
      )) {
        if (logType.includes(type) && log) {
          try {
            const regexExp = new RegExp(regex === '*' ? '/*' : regex);

            if (regexExp.test(log)) {
              if (extractedResults[filterName]) {
                if (typeof extractedResults[filterName] === 'string') {
                  extractedResults[filterName] = [
                    extractedResults[filterName] as string,
                  ];
                }
                (extractedResults[filterName] as string[]).push(log);
              } else {
                extractedResults[filterName] = log;
              }
            }
          } catch (err) {
            extractedResults[filterName] = `${err}`;
          }
        }
      }
    }
  }

  return extractedResults;
}
