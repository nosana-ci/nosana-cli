import { createPodmanRunOptions } from '../createPodmanRunOptions';

describe('createPodmanRunOptions', () => {
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
        'all',
      ),
    ).toEqual({
      Networks: {
        NOSANA_GATEWAY: {},
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
      hostadd: [
        'host.docker.internal:8.8.8.8',
        'host.containers.internal:8.8.8.8',
      ],
      image: 'ubuntu',
      name: 'ubuntu-test',
      netns: {
        nsmode: 'bridge',
      },
      volumes: [
        {
          dest: 'testDest',
          name: 'testDestName',
          Options: [],
        },
      ],
      work_dir: 'TEST_DIR',
    });
  });

  test('when setting gpu device index, should list of nvidia devices', () => {
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
        '0,2',
      ).devices,
    ).toEqual([
      {
        path: 'nvidia.com/gpu=0',
      },
      {
        path: 'nvidia.com/gpu=2',
      },
    ]);
  });
});
