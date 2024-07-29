import fs from 'fs';
import { LowSync } from 'lowdb/lib';

import { DockerodeMock } from '../../../tests/MockDockerode';
import { createResourceManager } from '../../modules/resourceManager';
import { createPodmanRunOptions } from '../createPodmanRunOptions';
import { NodeDb } from '../../BasicProvider';
import { DB } from '../../modules/db';

jest.mock('fs');

describe('createPodmanRunOptions', () => {
  const mock_dockerode = new DockerodeMock();
  const mock_db: LowSync<NodeDb> = new DB('').db;
  const mock_resourceManager = createResourceManager(mock_db, mock_dockerode);

  beforeAll(() => {
    (fs.mkdirSync as jest.Mock).mockImplementation(jest.fn());
  });

  it('should return podman run options from given image and args', () => {
    expect(
      createPodmanRunOptions(
        'ubuntu',
        {
          name: 'ubuntu-test',
          cmd: ['echo test'],
          volumes: [{ dest: 'testDest', name: 'testDestName' }],
          entrypoint: ['sh'],
          env: {
            ENV: 'TEST',
          },
          gpu: true,
          networks: {
            testNet: 'TEST_NET',
          },
          work_dir: 'TEST_DIR',
        },
        mock_resourceManager,
      ),
    ).toEqual({
      Networks: {
        testNet: 'TEST_NET',
      },
      cgroups_mode: 'disabled',
      command: ['echo test'],
      create_working_dir: true,
      devices: [
        {
          path: 'nvidia.com/gpu=all',
        },
      ],
      entrypoint: ['sh'],
      env: {
        ENV: 'TEST',
      },
      image: 'ubuntu',
      name: 'ubuntu-test',
      netns: {
        nsmode: 'bridge',
      },
      volumes: [
        {
          dest: 'testDest',
          name: 'testDestName',
        },
      ],
      work_dir: 'TEST_DIR',
    });
  });
});
