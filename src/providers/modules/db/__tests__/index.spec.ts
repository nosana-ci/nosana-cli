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
      resources: {
        images: {},
        volumes: {},
      },
      flows: {},
      info: {
        country: '',
        network: {
          ip: '',
          ping_ms: 0,
          download_mbps: 0,
          upload_mbps: 0,
        },
        system_environment: '',
        cpu: {
          model: '',
          physical_cores: 0,
          logical_cores: 0,
        },
        disk_gb: 0,
        ram_mb: 0,
        gpus: {
          devices: [],
          runtime_version: 0,
          cuda_driver_version: 0,
          nvml_driver_version: '0.0.0',
        },
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
