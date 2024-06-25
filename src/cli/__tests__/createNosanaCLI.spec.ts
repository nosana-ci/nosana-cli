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
});
