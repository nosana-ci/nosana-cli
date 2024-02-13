import { Command } from 'commander';
const Docker = require('dockerode');

const jobDefinition = {
  state: {
    'nosana/type': 'docker',
    'nosana/trigger': 'cli',
  },
  ops: [
    {
      op: 'container/run',
      id: 'run-from-cli',
      args: {
        cmds: [{ cmd: 'echo Hello World!' }],
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
  const docker = new Docker();

  try {
    await new Promise((resolve, reject) => {
      docker.pull(jobDefinition.ops[0].args.image, (err:any, stream:any) => {
        if (err) {
          return reject(err);
        }
        docker.modem.followProgress(stream, (err: any, res: any) =>
          err ? reject(err) : resolve(res),
        );
      });
    });

    const name = jobDefinition.ops[0].args.image + '-' + (Math.random() + 1).toString(36).substring(7);
    const container = await docker.createContainer({
      Image: jobDefinition.ops[0].args.image,
      name,
      AttachStderr: true,
      AttachStdin: true,
      AttachStdout: true,
      OpenStdin: true,
      StdinOnce: true,
      Tty: false,
    });
    console.log('created: ', name)

    console.log('start attach stream');
    const stream = await container.attach({
      hijack: true,
      stderr: true,
      stdin: true,
      stdout: true,
      stream: true,
    });
    console.log('finish attach stream');

    // Create a promise that resolves to the container's stdout
    const stdout = new Promise((resolve) => {
      stream.on('data', (data: any) => {
        const response = data && data.slice(8).toString();
        resolve(response);
      });
    });

    // Start the container
    await container.start();
    const output = await runCommandInContainer(container, ['/bin/bash', '-c', 'echo Hello World from exec']);
    console.log('output', output);

    // const allContainerInfos = await docker.listContainers();
    // console.log('allContainerInfos', allContainerInfos);
    stream.end();
    await container.wait();
    container.remove();
    
    const result = await stdout;
    console.log('result', result);
  } catch (error) {
    console.log(error);
  }

}
async function runCommandInContainer(container: any, command: string[]): Promise<string> {
  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ hijack: true, stdin: true });
  let output = "";
  output = await readStream(stream);
  await waitForStreamEnd(stream);
  return output;
}

const readStream = (stream: any) => {
  let output: string = "";
  return new Promise<string>((resolve, reject) => {
    stream.on("data", (chunk: string) => {
      output += chunk;
    });

    stream.on("end", () => {
      resolve(output.trim().split("\n").map(processString).join("\n"));
    });
  });
  
  function processString(str: string): string {
    const out = Buffer.from(str, "binary");
    if (out.readUInt8(0) === 1) {
      return out.toString("utf8", 8);
    } else {
      return out.toString("utf8", 0);
    }
  }
};

async function waitForStreamEnd(stream: NodeJS.ReadableStream): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      stream.on('end', async () => {
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}