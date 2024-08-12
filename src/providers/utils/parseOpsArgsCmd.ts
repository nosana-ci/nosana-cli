import { OperationArgsMap } from '../Provider';

export function parseOpArgsCmd(
  cmd: OperationArgsMap['container/run']['cmd'],
): string[] | undefined {
  if (typeof cmd !== 'string') return cmd;
  return ['/bin/sh', '-c', cmd];
}
