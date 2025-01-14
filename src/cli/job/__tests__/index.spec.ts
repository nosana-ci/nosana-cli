import { jobCommand } from '../';

describe('jobCommand', () => {
  it('should only have two commands', () => {
    expect(jobCommand.commands.length).toBe(7);
  });

  it.each([
    ['download'],
    ['get'],
    ['post'],
    ['serve'],
    ['upload'],
    ['stop'],
    ['extend'],
  ])('should contain %s command', (command) => {
    // @ts-ignore
    expect(jobCommand.commands.map((command) => command._name)).toContain(
      command,
    );
  });
});
