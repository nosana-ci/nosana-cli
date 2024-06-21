import { nodeCommand } from '../';

jest.mock('../joinTestGrid/action.ts', () => ({
  action: () => 'Join test grid action',
}));
jest.mock('../run/action.ts', () => ({
  action: () => 'run node action',
}));
jest.mock('../start/action.ts', () => ({
  action: () => 'Start node action',
}));
jest.mock('../view/action.ts', () => ({
  action: () => 'View node action',
}));

describe('nodeCommand', () => {
  it.each([['join-test-grid'], ['run'], ['start'], ['view']])(
    'should contain %s command',
    (command) => {
      // @ts-ignore
      expect(nodeCommand.commands.map((command) => command._name)).toContain(
        command,
      );
    },
  );
});
