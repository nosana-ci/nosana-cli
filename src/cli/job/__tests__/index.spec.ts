import { jobCommand } from '../';

describe('jobCommand', () => {
  it('should only have two commands', () => {
    expect(jobCommand.commands.length).toBe(5);
  });

  it.each([['download'], ['get'], ['post'], ['upload'], ['stop']])(
    'should contain %s command',
    (command) => {
      // @ts-ignore
      expect(jobCommand.commands.map((command) => command._name)).toContain(
        command,
      );
    },
  );
});
