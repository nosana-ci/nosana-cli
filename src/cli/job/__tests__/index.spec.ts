import { jobCommand } from '../';

describe('jobCommand', () => {
  it('should have eleven commands', () => {
    expect(jobCommand.commands.length).toBe(11);
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
    ['ssh-proxy'],
  ])('should contain %s command', (command) => {
    // @ts-ignore
    expect(jobCommand.commands.map((command) => command._name)).toContain(
      command,
    );
  });
});
