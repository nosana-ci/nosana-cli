import { Command } from 'commander';
import { ContainerProvider } from '../../providers/ContainerProvider';
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
        cmds: "/bin/bash -c 'for i in {1..10}; do echo $i; sleep 1; done;'",
        image: 'ubuntu',
      },
    },
    {
      type: 'container/run',
      id: 'run-from-cli-2',
      args: {
        cmds: "/bin/bash -c 'echo Hello World'",
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
  let provider: ContainerProvider;
  switch (options.provider) {
    case 'container':
      provider = new ContainerProvider(options.podman);
      break;
    default:
      provider = new ContainerProvider(options.podman);
  }

  if (await provider.healthy()) { 
    const flowId: string = provider.run(jobDefinition);
    console.log('flowId: ', flowId);
    const flowResult = await provider.waitForFlowFinish(flowId, (log: {
      log: string;
      opIndex: number;
    }) => {
      console.log('new log', log);
    });
    console.log('flowResult: ', flowResult);
    // await provider.continueFlow('lq0340nbudsm0wnk0i9qi4q8pw2hzsyr')
  } else {
    console.log('abort');
  }
}
