import { marketCommand } from '../';

describe('marketCommand', () => {
  it('should only have two commands', () => {
    expect(marketCommand.commands.length).toBe(2);
  });

  it.each([['list'], ['get']])('should contain %s command', (command) => {
    // @ts-ignore
    expect(marketCommand.commands.map((command) => command._name)).toContain(
      command,
    );
  });
});
