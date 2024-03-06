import { Command } from 'commander';
import { DockerProvider } from '../../providers/DockerProvider';
import { Flow, JobDefinition } from '../../providers/BaseProvider';
import chalk from 'chalk';

const jobDefinition: JobDefinition = {
  version: '0.1',
  type: 'container',
  meta: {
    trigger: 'cli',
  },
  ops: [
    {
      type: 'container/run',
      id: 'run-from-cli',
      args: {
        cmds: ['/bin/bash -c ', 'for i in {1..10}; do echo $i; sleep 1; done;'],
        image: 'ubuntu',
      },
    },
    {
      type: 'container/run',
      id: 'run-from-cli-2',
      args: {
        cmds: ['/bin/bash -c ', 'sleep 1;', 'ls;', 'sleep 1;'],
        image: 'debian',
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
    const flow: Flow = provider.run(jobDefinition);
    const flowId = flow.id;

    const flowResult = await provider.waitForFlowFinish(
      flowId,
      (log: { log: string; opIndex: number }) => {
        // console.log('new log', log);
      },
    );
    console.log('flowResult: ', flowResult);
  } else {
    console.log(chalk.red('provider not healthy'));
  }
}
