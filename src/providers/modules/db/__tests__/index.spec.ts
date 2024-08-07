import fs from 'fs';

import { DB } from '../';

jest.mock('fs');
jest.mock('os', () => ({
  homedir: () => 'homedir',
}));

describe('DB', () => {
  const mock_mkdirSync = jest.fn();

  beforeEach(() => {
    (fs.mkdirSync as jest.Mock).mockImplementation((args1, args2) =>
      mock_mkdirSync(args1, args2),
    );
  });

  afterEach(() => {
    mock_mkdirSync.mockReset();
  });

  it('should create db directory and return a DB instance', () => {
    const result = new DB('test');

    expect(mock_mkdirSync).toHaveBeenCalledTimes(1);
    expect(mock_mkdirSync).toHaveBeenCalledWith('test', { recursive: true });

    expect(result.db.data).toEqual({
      flows: {},
      resources: {
        images: {},
        volumes: {},
      },
    });
  });

  test('when configLocation starts with ~ should replace with os.homedir', () => {
    new DB('~/test');

    expect(mock_mkdirSync).toHaveBeenCalledWith('homedir/test', {
      recursive: true,
    });
  });
});
