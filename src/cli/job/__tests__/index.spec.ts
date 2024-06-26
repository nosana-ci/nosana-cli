import { jobCommand } from '../';

describe('jobCommand', () => {
  it.each([['download'], ['get'], ['post'], ['upload']])(
    'should contain %s command',
    (command) => {
      // @ts-ignore
      expect(jobCommand.commands.map((command) => command._name)).toContain(
        command,
      );
    },
  );
});
