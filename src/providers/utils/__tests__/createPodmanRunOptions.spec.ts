import { createPodmanRunOptions } from '../createPodmanRunOptions';

describe('createPodmanRunOptions', () => {
  it('should return podman run options from given image and args', () => {
    expect(
      createPodmanRunOptions('ubuntu', {
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
      }),
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
          Options: [],
        },
      ],
      work_dir: 'TEST_DIR',
    });
  });
});
