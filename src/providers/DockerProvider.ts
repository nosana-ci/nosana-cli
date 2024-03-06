import chalk from 'chalk';
import { Operation, Provider, OpState, Flow } from './Provider';
import Docker from 'dockerode';
import stream from 'stream';
import { parse } from 'shell-quote';
import { BasicProvider } from './BasicProvider';

export class DockerProvider extends BasicProvider implements Provider {
  private docker: Docker;
  protected supportedOps: { [key: string]: string } = {
    'container/run': this.runOperation.name,
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
  private async runOperation(
    op: Operation<'container/run'>,
    flowId: string,
  ): Promise<OpState> {
    const startTime = Date.now();
    let run: { logs: OpState['logs']; exitCode: number } = {
      logs: [],
      exitCode: 0,
    };

    const updateOpState: Partial<OpState> = {
      startTime,
      endTime: null,
      status: 'running',
    };
    const opStateIndex = this.db.data.flows[flowId].state.findIndex(
      (opState) => op.id === opState.operation.id,
    );
    this.db.data.flows[flowId].state[opStateIndex] = {
      ...this.db.data.flows[flowId].state[opStateIndex],
      ...updateOpState,
    };
    this.db.write();

    try {
      const cmd = op.args?.cmds;
      run = await this.executeCmd(cmd, op.args.image, flowId, opStateIndex);
      updateOpState.status = run.exitCode ? 'failed' : 'success';
      updateOpState.exitCode = run.exitCode;
    } catch (e: any) {
      updateOpState.status = 'failed';
      run.logs.push({
        type: 'stderr' as const,
        log: e.toString(),
      });
    }

    updateOpState.logs = run?.logs;
    updateOpState.endTime = Date.now();
    this.db.data.flows[flowId].state[opStateIndex] = {
      ...this.db.data.flows[flowId].state[opStateIndex],
      ...updateOpState,
    };
    this.db.write();

    return this.db.data.flows[flowId].state[opStateIndex];
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
   * @param flowStateIndex
   * @param opIndex
   * @returns
   */
  private async executeCmd(
    cmds: string[],
    image: string,
    flowId: string,
    opStateIndex: number,
  ): Promise<{
    exitCode: number;
    logs: OpState['logs'];
  }> {
    let cmd = '';
    for (let i = 0; i < cmds.length; i++) {
      if (i === 0) {
        cmd += cmds[i];
      } else {
        cmd += "'" + cmds[i] + "'";
      }
    }
    const parsedcmd = parse(cmd);

    try {
      await this.pullImage(image);
    } catch (error: any) {
      chalk.red(console.log('Cannot pull image', { error }));
      return {
        exitCode: 2,
        logs: [
          {
            type: 'stderr',
            log: error.message.toString(),
          },
        ] as OpState['logs'],
      };
    }

    const name =
      image +
      '-' +
      [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    this.db.data.flows[flowId].state[opStateIndex].id = name;
    this.db.write();

    const stdoutStream = new stream.PassThrough();
    const stderrStream = new stream.PassThrough();

    stdoutStream.on('data', (chunk) => {
      this.eventEmitter.emit('newLog', { opStateIndex, log: chunk.toString() });
      this.db.data.flows[flowId].state[opStateIndex].logs.push({
        type: 'stdout',
        log: chunk.toString(),
      });
      this.db.write();
    });

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
      .then(([res, container]) => {
        const stderr = stderrStream.read() as Buffer | undefined;
        container.remove();

        const logs = this.db.data.flows[flowId].state[opStateIndex].logs;
        if (stderr) {
          logs.push({
            type: 'stderr',
            log: stderr.toString(),
          });
        }

        return {
          exitCode: res.StatusCode,
          logs,
        };
      })
      .catch((error) => {
        chalk.red(console.log('Docker run failed', { error }));
        // TODO: document error codes
        return {
          exitCode: 1,
          logs: [
            {
              type: 'stderr',
              log: error.message.toString(),
            },
          ] as OpState['logs'],
        };
      });
  }

  public async clearFlow(flowId: string): Promise<void> {
    const flow = this.db.data.flows[flowId];
    // for every op in flow, stop & remove container
    for (let j = 0; j < flow.state.length; j++) {
      const op = flow.state[j];
      if (op.id) {
        try {
          const c = await this.getContainerByName(op.id);
          if (c) {
            const container = this.docker.getContainer(c.Id);
            const containerInfo = await container.inspect();
            if (containerInfo.State.Running) {
              await container.stop();
            }
            await container.remove();
          }
        } catch (err: any) {
          console.error(`couldnt stop container ${op.id} - ${err}`);
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
}
