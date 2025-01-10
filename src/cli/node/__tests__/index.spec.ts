import { nodeCommand } from '../';

describe('nodeCommand', () => {
  it('should have only two commands', () => {
    expect(nodeCommand.commands.length).toBe(6);
  });

  it.each([['join'], ['run'], ['start'], ['view'], ['prune'], ['migrate']])(
    'should contain %s command',
    (command) => {
      // @ts-ignore
      expect(nodeCommand.commands.map((command) => command._name)).toContain(
        command,
      );
    },
  );
});
