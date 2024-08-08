import { createNosanaCLI } from '../createNosanaCli';

describe('createNosanaCLI', () => {
  const CLI = createNosanaCLI('0.0.1');

  it('should set name, description and version', () => {
    // @ts-ignore
    const { _name, _description, _version } = CLI;

    expect(_name).toBe('nosana');
    expect(_description).toBe('Nosana CLI');
    expect(_version).toBe('0.0.1');
  });

  it('should have only two commands', () => {
    expect(CLI.commands.length).toBe(4);
  });

  it.each([['job', 'node', 'wallet', 'market']])(
    'should have %s command',
    (command) => {
      // @ts-ignore
      expect(CLI.commands.map((command) => command._name)).toContain(command);
    },
  );

  it('should have only two options', () => {
    expect(CLI.options.length).toBe(2);
  });

  it.each([
    ['--version', '-V', undefined, true],
    ['--log', undefined, 'debug', true],
  ])('should have %s option', (long, short, defaultValue, optional) => {
    const option = CLI.options.find((i) => i.long === long);

    expect(optional).toEqual(optional);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
    expect(defaultValue).toBe(defaultValue);
  });
});
