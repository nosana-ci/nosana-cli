import { Command } from 'commander';
import { DockerProvider } from '../../providers/DockerProvider';
import { JobDefinition } from '../../providers/BaseProvider';
import chalk from 'chalk';

const jobDefinition: JobDefinition = {
  version: '0.1',
  type: 'docker',
  trigger: 'cli',
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
    // first check if there are still unfinished flows
    const flows = provider.getFlowStates();
    let flowId: string | undefined;
    if (flows && flows.length > 0) {
      const flow = flows.find((f) => !f.endTime);
      if (flow) {
        console.log('Found running flow, continue', flow.id);
        provider.continueFlow(flow.id);
        flowId = flow.id;
      }
    }
    if (!flowId) {
      const id: string = provider.run(jobDefinition);
      flowId = id;
    }

    console.log('flow id', flowId);

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
