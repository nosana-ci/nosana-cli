import { jobCommand } from '../';

describe('jobCommand', () => {
  it('should have ten commands', () => {
    expect(jobCommand.commands.length).toBe(10);
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
    ['ssh'],
  ])('should contain %s command', (command) => {
    // @ts-ignore
    expect(jobCommand.commands.map((command) => command._name)).toContain(
      command,
    );
  });
});
