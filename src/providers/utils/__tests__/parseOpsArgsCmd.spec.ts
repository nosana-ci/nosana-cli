import { parseOpArgsCmd } from '../parseOpsArgsCmd';

describe('parseOpsArgsCmd', () => {
  test('when called with string array, should return matching string array', () => {
    expect(parseOpArgsCmd(['example', 'test command'])).toStrictEqual([
      'example',
      'test command',
    ]);
  });

  test('when called with string, should return a string array with /bin/sh -c', () => {
    expect(parseOpArgsCmd('test command')).toStrictEqual([
      '/bin/sh',
      '-c',
      'test command',
    ]);
  });

  test('when called with undefined, should return undefined', () => {
    expect(parseOpArgsCmd(undefined)).toBe(undefined);
  });
});
