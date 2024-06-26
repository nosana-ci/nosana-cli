import { nodeCommand } from '../';

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
