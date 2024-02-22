import chalk from 'chalk';
import {
  JobDefinition,
  Operation,
  OperationResult,
  BaseProvider,
  Result,
  OpState,
  RunState,
} from './BaseProvider';
import ora from 'ora';
import Docker from 'dockerode';
import stream from 'stream';
import streamPromises from 'stream/promises';
import { parse } from 'shell-quote';

export class DockerProvider implements BaseProvider {
  docker: Docker;
  runStates: Array<RunState> = [];

  constructor(podman: string) {
    const podmanUri = new URL(
      podman.startsWith('http') || podman.startsWith('ssh')
        ? podman
        : `http://${podman}`,
    );
    const protocol = podmanUri.protocol.replace(':', '');
    if (
      !['https', 'http', 'ssh'].includes(protocol) &&
      typeof protocol !== 'undefined'
    ) {
      throw new Error(`Protocol ${protocol} not supported`);
    }

    this.docker = new Docker({
      host: podmanUri.hostname,
      port: podmanUri.port,
      protocol: protocol as 'https' | 'http' | 'ssh' | undefined,
    });
  }
  run(jobDefinition: JobDefinition): string {
    const id = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    const state: RunState = {
      id,
      status: 'running',
      ops: []
    }
    this.runStates.push(state);
    this.runOps(jobDefinition, id);
    return id;
  }

  async runOps(jobDefinition: JobDefinition, runStateId: string): Promise<void> {
    const spinner = ora(chalk.cyan('Running job \n')).start();
    const runStateIndex = this.runStates.findIndex((o) => o.id === runStateId);
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
            runStateId
          );
          result.ops.push(opResult);
          const opIndex = this.runStates[runStateIndex].ops.findIndex((o) => op.id === o.result.id);
          this.runStates[runStateIndex].ops[opIndex].result = opResult;
        }
      } catch (error) {
        console.log(chalk.red(error));
        result.status = 'failed';
      }
    }
    const checkStatus = (op: OperationResult) => op.status === 'failed';
    this.runStates[runStateIndex].status = result.ops.some(checkStatus) ? 'failed' : result.status;

    spinner.stop();

    console.log('----------------------------------');
    console.log('Job done');
    console.log('run states:', this.runStates);
  }

  /**
   * Check if DockerProvider is healthy by checking if podman is running
   * @returns boolean
   */
  async healthy(throwError: Boolean = true): Promise<Boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      if (throwError) {
        throw error;
      }
      console.error(error);
      return false;
    }
  }

  getRunState (id: string): RunState | undefined {
    return this.runStates.find((o) => o.id === id);
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
    runStateId: string,
  ): Promise<OperationResult> {
    const startTime = Date.now();
    const container = await this.setupContainer(op);
    const outputs = [];
    let exitCode = 0;

    const result: OperationResult  = {
      id: op.id,
      startTime,
      endTime: 0,
      status: 'running',
      exitCode,
      logs: [],
    }

    const runStateIndex = this.runStates.findIndex((o) => o.id === runStateId);
    this.runStates[runStateIndex].ops.push({
      op: op.id,
      containerId: container.id,
      result
    });
    const opIndex = this.runStates[runStateIndex].ops.findIndex((o) => op.id === o.result.id);

    // exec commands in op
    for (let i = 0; i < op.args?.cmds.length; i++) {
      try {
        const cmd = op.args?.cmds[i];
        const exec = await this.exec(container, cmd, op.id, runStateId);
        result.status = exec.exitCode ? 'failed' : 'success';
        result.exitCode = exec.exitCode || result.exitCode;

        let type: 'stdin' | 'stdout' | 'stderr' =
          result.status === 'failed' ? 'stderr' : 'stdout';
        outputs.push({
          type,
          log: result.status === 'failed' ? exec.stderr : exec.stdout,
        });
      } catch (e: any) {
        result.status = 'failed';
        outputs.push({
          type: 'stderr' as const,
          log: e.toString(),
        });
      }
    }

    await container.stop();
    container.remove();

    result.logs = outputs;
    result.endTime = Date.now();
    this.runStates[runStateIndex].ops[opIndex].result = result;

    return this.runStates[runStateIndex].ops[opIndex].result;
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
    opId: string,
    runStateId: string,
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
    const runStateIndex = this.runStates.findIndex((o) => o.id === runStateId);
    const opIndex = this.runStates[runStateIndex].ops.findIndex((o) => opId === o.result.id);

    this.docker.modem.demuxStream(dockerExecStream, stdoutStream, stderrStream);

    dockerExecStream.resume();

    dockerExecStream.on('data', (chunk: any) => {
      // console.log(chunk.toString());
      this.runStates[runStateIndex].ops[opIndex].result.logs.push({
        type: 'stdout',
        log: chunk.toString(),
      })
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
