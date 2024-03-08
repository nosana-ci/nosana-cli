import chalk from 'chalk';
import { Operation, Provider, OpState, Flow } from './Provider';
import Docker from 'dockerode';
import stream from 'stream';
import { parse } from 'shell-quote';
import { BasicProvider } from './BasicProvider';
import { sleep } from '../generic/utils.js';

export class DockerProvider extends BasicProvider implements Provider {
  private docker: Docker;
  protected supportedOps: { [key: string]: string } = {
    'container/run': this.opContainerRun.name,
  };

  constructor(podman: string) {
    super();
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

  /**
   * Check if DockerProvider is healthy by checking if podman is running
   * @returns boolean
   */
  public async healthy(throwError: Boolean = true): Promise<Boolean> {
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

  /**
   * Run operation and return results
   * @param op Operation specs
   * @returns OpState
   */
  private async opContainerRun(
    op: Operation<'container/run'>,
    flowId: string,
  ): Promise<OpState> {
    const flow = this.getFlow(flowId) as Flow;
    const opStateIndex = flow.state.opStates.findIndex(
      (opState) => op.id === opState.operationId,
    );
    const opState = flow.state.opStates[opStateIndex];

    if (opState.providerId && !opState.endTime) {
      await new Promise<void>(async (resolve, reject) => {
        const c = await this.getContainerByName(opState.providerId as string);

        // when node is shutted down before the container started, it won't find the container
        // clear providerId so that it will be ran again
        if (!c) {
          opState.providerId = null;
          this.db.write();
          resolve();
        } else {
          const container = this.docker.getContainer(c.Id);
          const containerInfo = await container.inspect();

          // Create streams and wait for it to finish
          if (containerInfo.State.Running) {
            const stdoutStream = new stream.PassThrough();
            const stderrStream = new stream.PassThrough();
            opState.logs = [];

            // wait for log streams to finish, handle new logs with callback
            await this.handleLogStreams(
              container,
              stdoutStream,
              stderrStream,
              (data: { log: string; type: 'stdin' | 'stdout' | 'stderr' }) => {
                this.eventEmitter.emit('newLog', {
                  type: data.type,
                  log: data.log,
                });
                opState.logs.push({
                  type: data.type,
                  log: data.log,
                });
              },
            );
            await this.finishOpContainerRun(container, opState, containerInfo);
            stdoutStream.end();
            stderrStream.end();
            resolve();
          } else if (containerInfo.State.Status === 'exited') {
            await this.finishOpContainerRun(container, opState, containerInfo);
            resolve();
          }
        }
      });
    }

    if (!opState.endTime) {
      flow.state.opStates[opStateIndex] = {
        ...flow.state.opStates[opStateIndex],
        startTime: Date.now(),
        status: 'running',
      };
      this.db.write();
      try {
        const cmd = op.args?.cmds;
        await this.executeCmd(cmd, op.args.image, flowId, opStateIndex);
      } catch (e: any) {
        opState.status = 'failed';
        opState.logs.push({
          type: 'stderr' as const,
          log: e.toString(),
        });
      }
      this.db.write();
    }
    return opState;
  }

  /**
   * Pull docker image
   * @param image
   * @returns
   */
  private async pullImage(image: string) {
    return await new Promise((resolve, reject): any =>
      this.docker.pull(image, (err: any, stream: any) => {
        this.docker.modem.followProgress(stream, onFinished);
        function onFinished(err: any, output: any) {
          if (!err) {
            resolve(true);
            return;
          }
          reject(err);
        }
      }),
    );
  }

  /**
   * Perform docker.run for given cmd, return logs
   * @param cmd
   * @param image
   * @param flowId
   * @param opStateIndex
   * @returns
   */
  private async executeCmd(
    cmds: string[],
    image: string,
    flowId: string,
    opStateIndex: number,
  ): Promise<OpState> {
    let cmd = '';
    for (let i = 0; i < cmds.length; i++) {
      if (i === 0) {
        cmd += cmds[i];
      } else {
        cmd += "'" + cmds[i] + "'";
      }
    }
    const flow = this.getFlow(flowId) as Flow;
    const parsedcmd = parse(cmd);

    try {
      await this.pullImage(image);
    } catch (error: any) {
      chalk.red(console.log('Cannot pull image', { error }));
      flow.state.opStates[opStateIndex].exitCode = 2;
      flow.state.opStates[opStateIndex].status = 'failed';
      flow.state.opStates[opStateIndex].endTime = Date.now();
      flow.state.opStates[opStateIndex].logs = [
        {
          type: 'stderr',
          log: error.message.toString(),
        },
      ];
      this.db.write();
      return flow.state.opStates[opStateIndex];
    }

    const name =
      image +
      '-' +
      [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    flow.state.opStates[opStateIndex].providerId = name;
    this.db.write();

    const stdoutStream = new stream.PassThrough();
    const stderrStream = new stream.PassThrough();

    // wait for log streams to finish, handle new logs with callback
    this.handleLogStreams(
      name,
      stdoutStream,
      stderrStream,
      (data: { log: string; type: 'stdin' | 'stdout' | 'stderr' }) => {
        this.eventEmitter.emit('newLog', {
          type: data.type,
          log: data.log,
        });
        flow.state.opStates[opStateIndex].logs.push({
          type: data.type,
          log: data.log,
        });
        this.db.write();
      },
    );

    return await this.docker
      .run(image, parsedcmd as string[], [stdoutStream, stderrStream], {
        name,
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
      })
      .then(async ([res, container]) => {
        await this.finishOpContainerRun(
          container,
          flow.state.opStates[opStateIndex],
        );

        stdoutStream.end();
        stderrStream.end();
        return flow.state.opStates[opStateIndex];
      })
      .catch((error) => {
        chalk.red(console.log('Docker run failed', { error }));
        // TODO: document error codes
        flow.state.opStates[opStateIndex].exitCode = 2;
        flow.state.opStates[opStateIndex].status = 'failed';
        flow.state.opStates[opStateIndex].endTime = Date.now();
        flow.state.opStates[opStateIndex].logs = [
          {
            type: 'stderr',
            log: error.message.toString(),
          },
        ];
        this.db.write();
        return flow.state.opStates[opStateIndex];
      });
  }

  /**
   * Finish container run, extract results and update opState
   * @param container
   * @param opState
   * @param containerInfo optional
   */
  async finishOpContainerRun(
    container: Docker.Container,
    opState: OpState,
    containerInfo?: Docker.ContainerInspectInfo,
  ): Promise<void> {
    if (!containerInfo) containerInfo = await container.inspect();

    // op is done, get logs from container and save them in the flow
    const log = await container.logs({
      follow: false,
      stdout: true,
      stderr: true,
    });

    // parse output
    const output = this.demuxOutput(log);
    opState.logs = [];
    this.db.write();

    for (let i = 0; i < output.length; i++) {
      opState.logs.push({
        type: output[i].type as "stderr" | "stdin" | "stdout",
        log: output[i].log,
      });
    }

    opState.exitCode = containerInfo.State.ExitCode;
    opState.status = containerInfo.State.ExitCode ? 'failed' : 'success';
    opState.endTime = Math.floor(
      new Date(containerInfo.State.FinishedAt).getTime(),
    );
    this.db.write();
  }

  async handleLogStreams(
    container: Docker.Container | string,
    stdoutStream: any,
    stderrStream: any,
    callback: Function,
  ) {
    console.log('handleLogStreams');
    await new Promise<void>(async (resolve, reject) => {
      // TODO: FIX THIS:
      await sleep(1);
      if (typeof container === 'string') {
        console.log('container', container);
        const c = await this.getContainerByName(container);
        if (c) {
          container = this.docker.getContainer(c.Id);
        } else {
          console.log(
            chalk.red(
              `Couldn't find container ${container} to handle log streams`,
            ),
          );
          return;
        }
      }
      stderrStream.on('data', (chunk: Buffer) => {
        callback({
          type: 'stderr',
          log: chunk.toString(),
        });
      });

      stdoutStream.on('data', (chunk: Buffer) => {
        console.log('new chunk');
        callback({
          type: 'stdout',
          log: chunk.toString(),
        });
      });

      const logStream = await container.logs({
        stdout: true,
        stderr: true,
        follow: true,
      });
      container.modem.demuxStream(logStream, stdoutStream, stderrStream);

      logStream.on('end', async () => {
        resolve();
      });
    });
  }

  public async clearFlow(flowId: string): Promise<void> {
    const flow = this.getFlow(flowId) as Flow;
    // for every op in flow, stop & remove container
    for (let j = 0; j < flow.state.opStates.length; j++) {
      const op = flow.state.opStates[j];
      if (op.providerId) {
        try {
          const c = await this.getContainerByName(op.providerId);
          if (c) {
            const container = this.docker.getContainer(c.Id);
            const containerInfo = await container.inspect();
            if (containerInfo.State.Running) {
              await container.stop();
            }
            await container.remove();
          }
        } catch (err: any) {
          console.error(`couldnt stop container ${op.providerId} - ${err}`);
        }
      }
    }
    super.clearFlow(flowId);
  }

  /****************
   *   Getters   *
   ****************/
  private async getContainerByName(
    name: string,
  ): Promise<Docker.ContainerInfo | undefined> {
    const opts = {
      limit: 1,
      filters: `{"name": ["${name}"]}`,
    };

    return new Promise(async (resolve, reject) => {
      await this.docker.listContainers(opts, (err, containers) => {
        if (err) {
          reject(err);
        } else {
          resolve(containers && containers[0]);
        }
      });
    });
  }

  /****************
   *   Helpers   *
   ****************/
  /**
   * input: log Buffer, output stdout & stderr strings
   * @param buffer
   * @returns
   */
  private demuxOutput = (buffer: Buffer): { type: string; log: string }[] => {
    const stdouts: Buffer[] = [];
    const stderrs: Buffer[] = [];
    const output = [];

    function bufferSlice(end: number) {
      const out = buffer.slice(0, end);
      buffer = Buffer.from(buffer.slice(end, buffer.length));
      return out;
    }

    while (buffer.length > 0) {
      const header = bufferSlice(8);
      const nextDataType = header.readUInt8(0);
      const nextDataLength = header.readUInt32BE(4);
      const content = bufferSlice(nextDataLength);
      switch (nextDataType) {
        case 1:
          output.push({
            type: 'stdout',
            log: Buffer.concat([content]).toString('utf8'),
          });
          // stdouts.push(content);
          break;
        case 2:
          output.push({
            type: 'stderr',
            log: Buffer.concat([content]).toString('utf8'),
          });
          // stderrs.push(content);
          break;
        default:
        // ignore
      }
    }

    return output;
  };
}
