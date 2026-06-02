import { jobCommand } from '../';

describe('jobCommand', () => {
  it('should have nine commands', () => {
    expect(jobCommand.commands.length).toBe(9);
  });

  it.each([
    ['download'],
    ['get'],
    ['post'],
    ['serve'],
    ['upload'],
    ['stop'],
    ['extend'],
    ['validate'],
    ['list'],
  ])('should contain %s command', (command) => {
    // @ts-ignore
    expect(jobCommand.commands.map((command) => command._name)).toContain(
      command,
    );
  });
});
