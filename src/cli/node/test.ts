import { Command } from 'commander';
import { DockerProvider } from '../../providers/DockerProvider';
import { JobDefinition } from '../../providers/BaseProvider';

const jobDefinition: JobDefinition = {
  version: '0.1',
  type: 'container',
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
    const flow = provider.getFlowStates().find((flow) => !flow.endTime);
    let flowId;
    if (flow) {
      console.log('Found running flow, continue', flow.id);
      provider.continueFlow(flow.id);
      flowId = flow.id;
    } else {
      const id: string = provider.run(jobDefinition);
      flowId = id;
    }

    const flowResult = await provider.waitForFlowFinish(
      flowId,
      (log: { log: string; opIndex: number }) => {
        console.log('new log', log);
      },
    );
    console.log('flowResult: ', flowResult);
  } else {
    console.log('abort');
  }
}
