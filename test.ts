import Dockerode from 'dockerode';

const docker = new Dockerode({
  host: 'localhost',
  port: '8080',
  protocol: 'http',
});

const container = await docker.getContainer('c256310bbdd7');

const buffer = await container.logs({
  follow: false,
  stdout: true,
  stderr: true,
});

export type StdOptions = 'stdin' | 'stdout' | 'stderr' | 'nodeerr';

export type OperationResults = {
  [key: string]: string | OperationResult;
};

export type OperationResult = {
  regex: string;
  logType: [StdOptions, StdOptions?, StdOptions?, StdOptions?];
};

function createResultsObject(operationResults: OperationResults): {
  [key: string]: string | string[];
} {
  return Object.keys(operationResults).reduce(
    (obj: { [key: string]: string[] }, key) => ((obj[key] = []), obj),
    {},
  );
}

function extractResultFromLog(
  resultObj: { [key: string]: string | string[] },
  logObj: {
    type: 'stdout' | 'stderr';
    log: string;
  },
  operationResults: OperationResults,
) {
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

function extractLogsAndResultsFromLogBuffer(
  logBuffer: Buffer,
  operationResults: OperationResults | undefined,
  expiryTimeout = 180,
): {
  logs: any[];
  results: {} | undefined;
} {
  const logs: any[] = [];
  const results: {} | undefined = operationResults
    ? createResultsObject(operationResults)
    : undefined;

  let index = 0,
    running = true;

  const timer = setTimeout(() => {
    running = false;
  }, expiryTimeout);

  while (index < logBuffer.length && running) {
    const head = logBuffer.subarray(index, (index += 8));
    const chunkType = head.readUInt8(0);
    const chunkLength = head.readUInt32BE(4);
    const content = logBuffer.subarray(index, (index += chunkLength));
    if (chunkType === 1 || chunkType === 2) {
      const logObj = {
        type: chunkType === 1 ? 'stdout' : 'stderr',
        log: content.toString('utf-8'),
      };
      logs.push(logObj);
      if (results) {
        // @ts-ignore
        extractResultFromLog(results, logObj, operationResults);
      }
    }
  }

  clearTimeout(timer);

  return {
    logs,
    results,
  };
}

const startTime = new Date();
console.log(startTime);

const res = extractLogsAndResultsFromLogBuffer(buffer, {
  test: 'z',
});

console.log(res.logs[res.logs.length - 1]);

console.log(new Date());
console.log(`${(new Date().getTime() - startTime.getTime()) / 1000} secods`);
