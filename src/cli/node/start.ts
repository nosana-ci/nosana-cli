import { Command } from 'commander';
import { DockerProvider } from '../../providers/DockerProvider';
import { JobDefinition } from '../../providers/BaseProvider';

const jobDefinition: JobDefinition = {
  version: "0.1",
  type: "docker",
  trigger: "cli",
  ops: [{
    type: 'container/run',
    id: 'run-from-cli',
    args: {
      cmds: ['/bin/bash', '-c', 'echo Hello World!'],
      image: 'ubuntu',
    },
  }]
};

export async function startNode(
  market: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
) {
  let provider;
  switch (options.provider) {
    case "docker":
      provider = new DockerProvider();
      break;
    default:
      provider = new DockerProvider();
  }

  if (await provider.healthy()) {
    await provider.run(jobDefinition);
  } else {
    console.log('abort');
  }
}