import { Command } from 'commander';
import { DockerProvider } from '../../providers/DockerProvider';
import { JobDefinition } from '../../providers/BaseProvider';

const jobDefinition: JobDefinition = {
  version: '0.1',
  type: 'docker',
  trigger: 'cli',
  ops: [
    {
      type: 'container/run',
      id: 'run-from-cli',
      args: {
        cmds: ["/bin/bash -c 'for i in {1..3}; do echo $i; sleep 1; done'"],
        image: 'ubuntu',
      },
    },
  ],
};

export async function startNode(
  market: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
) {
  let provider: DockerProvider;
  switch (options.provider) {
    case 'docker':
      provider = new DockerProvider(options.podman);
      break;
    default:
      provider = new DockerProvider(options.podman);
  }

  if (await provider.healthy()) {
    const flowId: string = provider.run(jobDefinition);
    console.log('flowId: ', flowId);
    const flowResult = await provider.waitForFlowFinish(flowId);
    console.log('flowResult: ', flowResult);
  } else {
    console.log('abort');
  }
}
