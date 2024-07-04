import { addressCommand } from '../command';

import { getAddress } from '../action';

jest.mock('../action', () => ({
  getAddress: jest.fn(),
}));

describe('addressCommand', () => {
  const mock_getAddress_action = jest.fn();
  const parseArgs = ['node', 'get', 'run command'];

  beforeEach(() => {
    mock_getAddress_action.mockReset();
    (getAddress as jest.Mock).mockImplementation(mock_getAddress_action);
  });

  it('should call run action', () => {
    addressCommand.parse(parseArgs);
    expect(mock_getAddress_action).toHaveBeenCalledTimes(1);
  });

  it('should set post job args', () => {
    addressCommand.parse(parseArgs);
    expect(addressCommand.args[0]).toBe('run command');
  });

  it('should have 2 options', () => {
    expect(addressCommand.options.length).toBe(2);
  });

  it.each([
    ['--network', '-n', 'mainnet'],
    ['--wallet', '-w', '~/.nosana/nosana_key.json'],
  ])('should have %s option', (long, short, defaultValue) => {
    const option = addressCommand.options.find((i) => i.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
    expect(option?.defaultValue).toBe(defaultValue);
  });
});
