import chalk from 'chalk';
import {
  JobDefinition,
  Operation,
  OperationResult,
  BaseProvider,
  Result,
  RunState,
} from './BaseProvider';
import ora from 'ora';
import Docker from 'dockerode';
import stream from 'stream';
import streamPromises from 'stream/promises';
import { parse } from 'shell-quote';

export class DockerProvider implements BaseProvider {
  docker: Docker;
  constructor(host: string, port: number) {
    this.docker = new Docker({
      host,
      port,
    });
  }
  async run(jobDefinition: JobDefinition): Promise<Result> {
    const spinner = ora(chalk.cyan('Running job \n')).start();
    const result: Result = {
      status: 'success',
      ops: [],
    };

    // run operations
    for (let i = 0; i < jobDefinition.ops.length; i++) {
      const op = jobDefinition.ops[i];
      try {
        if (op.type === 'container/run') {
          const opResult = await this.runOperation(
            op as Operation<'container/run'>,
          );
          result.ops.push(opResult);
        }
      } catch (error) {
        console.log(chalk.red(error));
        result.status = 'failed';
      }
    }
    const checkStatus = (op: OperationResult) => op.status === 'failed';
    result.status = result.ops.some(checkStatus) ? 'failed' : result.status;

    spinner.stop();

    console.log('----------------------------------');
    console.log('Job done');
    console.log('result:', result);

    return result;
  }

  /**
   * Check if DockerProvider is healthy by checking if podman is running
   * @returns boolean
   */
  async healthy(): Promise<Boolean> {
    try {
      await this.docker.ping();
      console.log(chalk.green('Podman is running'));
      return true;
    } catch (error) {
      console.error(chalk.red('Cannot connect to Podman: ', error));
      return false;
    }
  }

  /**
   * Pull image and create & start container
   * @param op Operation specs
   * @returns Docker.Container
   */
  private async setupContainer(
    op: Operation<'container/run'>,
  ): Promise<Docker.Container> {
    await new Promise((resolve, reject) => {
      this.docker.pull(op.args.image, (err: any, stream: any) => {
        if (err) {
          return reject(err);
        }
        this.docker.modem.followProgress(stream, (err: any, res: any) =>
          err ? reject(err) : resolve(res),
        );
      });
    });
    console.log(chalk.green('- Pulled image ', op.args.image));

    const name =
      op.args?.image + '-' + (Math.random() + 1).toString(36).substring(7);
    const container = await this.docker.createContainer({
      Image: op.args?.image,
      name,
      AttachStderr: true,
      AttachStdin: true,
      AttachStdout: true,
      OpenStdin: true,
      StdinOnce: true,
      Tty: false,
      // --gpus all
      HostConfig: {
        DeviceRequests: [
          {
            Count: -1,
            Driver: 'nvidia',
            Capabilities: [['gpu']],
          },
        ],
      },
    });
    console.log(chalk.green('- Created container ', name));

    await container.start();

    // TODO: how to stop this?
    this.docker.getEvents(
      {
        filters: {
          container: [name],
          event: [],
        },
      },
      this.handleDockerEvents,
    );

    console.log(chalk.green('- Started container '));

    return container;
  }

  /**
   * Run operation and return results
   * @param op Operation specs
   * @returns OperationResult
   */
  private async runOperation(
    op: Operation<'container/run'>,
  ): Promise<OperationResult> {
    const startTime = Date.now();
    const container = await this.setupContainer(op);

    const outputs = [];
    let exitCode = 0;
    let status = 'success';

    // exec commands in op
    for (let i = 0; i < op.args?.cmds.length; i++) {
      try {
        const cmd = op.args?.cmds[i];
        const exec = await this.exec(container, cmd);
        status = exec.exitCode ? 'failed' : 'success';
        exitCode = exec.exitCode || exitCode;

        let type: 'stdin' | 'stdout' | 'stderr' =
          status === 'failed' ? 'stderr' : 'stdout';
        outputs.push({
          type,
          log: status === 'failed' ? exec.stderr : exec.stdout,
        });
      } catch (e: any) {
        status = 'failed';
        outputs.push({
          type: 'stderr' as const,
          log: e.toString(),
        });
      }
    }

    await container.stop();
    container.remove();

    return {
      id: op.id,
      startTime,
      endTime: Date.now(),
      status,
      exitCode,
      logs: outputs,
    };
  }

  /**
   * Execute a command in a running Docker container.
   *
   * @param container container to execute the command in
   * @param cmd command to execute
   * @param opts options
   */
  private async exec(
    container: Docker.Container,
    cmd: string,
    opts?: Docker.ExecCreateOptions,
  ): Promise<{
    exitCode: number | null;
    stderr: string | undefined;
    stdout: string | undefined;
  }> {
    const parsedcmd = parse(cmd);
    const dockerExec = await container.exec({
      ...opts,
      AttachStderr: true,
      AttachStdout: true,
      Cmd: parsedcmd as string[],
    });

    const dockerExecStream = await dockerExec.start({});
    const stdoutStream = new stream.PassThrough();
    const stderrStream = new stream.PassThrough();

    this.docker.modem.demuxStream(dockerExecStream, stdoutStream, stderrStream);

    dockerExecStream.resume();

    dockerExecStream.on('data', (chunk: any) => {
      console.log(chunk.toString());
    });

    await streamPromises.finished(dockerExecStream);

    const stderr = stderrStream.read() as Buffer | undefined;
    const stdout = stdoutStream.read() as Buffer | undefined;

    const dockerExecInfo = await dockerExec.inspect();

    return {
      exitCode: dockerExecInfo.ExitCode,
      stderr: stderr?.toString(),
      stdout: stdout?.toString(),
    };
  }

  /**
   *
   * @param err
   * @param stream
   */
  private handleDockerEvents(err: any, stream: any) {
    if (err) {
      console.log('docker event error: ', err.message);
    } else {
      stream.on('data', (chunk: any) => {
        try {
          // TODO: sometimes two events come in at the same time, then json.parse doesnt work
          // find workaround
          const data = JSON.parse(chunk.toString('utf8'));
          if (
            data &&
            data.Actor.Attributes &&
            parseInt(data.Actor.Attributes.containerExitCode)
          ) {
            console.log(
              'container exited with code: ',
              data.Actor.Attributes.containerExitCode,
            );
          }
        } catch (e) {}
      });
      stream.on('end', function () {
        console.log('STREAM END');
      });
      stream.on('close', function () {
        console.log('STREAM CLOSE');
      });
    }
  }
}
