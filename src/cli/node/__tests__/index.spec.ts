import { nodeCommand } from '../';

describe('nodeCommand', () => {
  it('should have only two commands', () => {
    expect(nodeCommand.commands.length).toBe(5);
  });

  it.each([['join-test-grid'], ['run'], ['start'], ['view'], ['prune']])(
    'should contain %s command',
    (command) => {
      // @ts-ignore
      expect(nodeCommand.commands.map((command) => command._name)).toContain(
        command,
      );
    },
  );
});
