import { jobCommand } from '../';

describe('jobCommand', () => {
  it('should only have two commands', () => {
    expect(jobCommand.commands.length).toBe(6);
  });

  it.each([['download'], ['get'], ['post'], ['serve'], ['upload'], ['stop']])(
    'should contain %s command',
    (command) => {
      // @ts-ignore
      expect(jobCommand.commands.map((command) => command._name)).toContain(
        command,
      );
    },
  );
});
