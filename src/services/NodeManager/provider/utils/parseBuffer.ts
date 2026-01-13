import { Log, StdOptions } from '@nosana/sdk';

const TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\s/;

export function parseBuffer(buffer: Buffer, index: number = 0): Log {
  const head = buffer.subarray(index, (index += 8));
  const chunkType = head.readUInt8(0);
  const chunkLength = head.readUInt32BE(4);
  const content = buffer.subarray(index, (index += chunkLength));

  const rawLog = content.toString('utf-8');
  const timestampMatch = rawLog.match(TIMESTAMP_REGEX);
  const log = rawLog.replace(TIMESTAMP_REGEX, '');

  let timestamp: string = new Date(Date.now()).toISOString();
  if (timestampMatch) {
    timestamp = timestampMatch[0].trim();
  }

  return {
    log,
    type: chunkType === 1 ? 'stdout' : ('stderr' as StdOptions),
    timestamp,
  };
}
