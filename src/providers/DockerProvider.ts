import chalk from 'chalk';
import {
  JobDefinition,
  Operation,
  BaseProvider,
  OpState,
  Flow,
} from './BaseProvider';
import Docker from 'dockerode';
import stream from 'stream';
import { parse } from 'shell-quote';
import EventEmitter from 'events';
import { JSONFileSyncPreset } from 'lowdb/node';
import { LowSync } from 'lowdb/lib';

type FlowsDb = {
  flows: { [key: string]: Flow };
};

export class DockerProvider implements BaseProvider {
  private docker: Docker;
  private db: LowSync<FlowsDb>;
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor(podman: string) {
    this.db = JSONFileSyncPreset<FlowsDb>('db/flows.json', {
      flows: {},
    });
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
   * Main run
   * @param jobDefinition
   * @param flowStateId
   * @returns
   */
  public run(jobDefinition: JobDefinition, flowId?: string): Flow {
    const id =
      flowId ||
      [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    if (this.db.data.flows[id]) {
      throw new Error(
        `flow ${flowId} already exists, please continue that flow`,
      );
    }

    // Create a new flow
    const flow: Flow = {
      id,
      status: 'running',
      jobDefinition,
      startTime: Date.now(),
      endTime: null,
      state: [],
    };
    // Add ops from job definition to flow
    for (let i = 0; i < jobDefinition.ops.length; i++) {
      const op = jobDefinition.ops[i];
      const opState: OpState = {
        id: null,
        startTime: null,
        endTime: null,
        status: 'pending',
        exitCode: null,
        operation: op,
        logs: [],
      };
      flow.state.push(opState);
    }
    this.db.update(({ flows }) => (flows[id] = flow));

    // Start running this flow
    this.runFlow(id);
    return flow;
  }

  /**
   * Run operations form job definition
   * @param jobDefinition
   * @param flowStateId
   */
  private async runFlow(flowId: string): Promise<void> {
    console.log(chalk.cyan(`Running flow ${chalk.bold(flowId)}`));
    const flow = this.db.data.flows[flowId];
    try {
      // run operations
      for (let i = 0; i < flow.jobDefinition.ops.length; i++) {
        const op = flow.jobDefinition.ops[i];
        let opState: OpState;
        try {
          switch (op.type) {
            case 'container/run':
              opState = await this.runOperation(
                op as Operation<'container/run'>,
                flowId,
              );
              break;

            default:
              throw new Error(`no support for operation type ${op.type}`);
          }
        } catch (error) {
          console.error(chalk.red(error));
          this.db.data.flows[flowId].state.find(
            (opState) => opState.id === op.id,
          )!.status = 'failed';
          this.db.write();
          break;
        }
        if (opState && opState.status === 'failed') break;
      }
    } catch (error: any) {
      this.db.data.flows[flowId].error = error.toString();
      this.db.write();
    }
    this.finishFlow(flowId, flow.error ? 'node-error' : undefined);
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

  /**
   * Wait for flow to be finished and return FlowState
   * @param id Flow id
   * @param logCallback
   * @returns FlowState
   */
  public async waitForFlowFinish(
    flowId: string,
    logCallback?: Function,
  ): Promise<Flow> {
    return await new Promise((resolve, reject) => {
      const flow = this.db.data.flows[flowId];
      if (!flow) reject('Flow not found');
      if (this.db.data.flows[flowId].endTime) {
        resolve(this.db.data.flows[flowId]);
      }

      if (logCallback) {
        this.eventEmitter.on('newLog', (info) => {
          logCallback(info);
        });
      }

      this.eventEmitter.on('flowFinished', (flowId) => {
        this.eventEmitter.removeAllListeners('flowFinished');
        this.eventEmitter.removeAllListeners('newLog');
        resolve(this.db.data.flows[flowId]);
      });
    });
  }

  /*
  TODO:
  - improve code, separate log stream function? setFlowState function?
    */
  /**
   *
   * @param flowId
   */
  public async continueFlow(flowId: string): Promise<void> {
    const flow = this.db.data.flows[flowId];
    if (!flow) throw new Error(`Flow not found: ${flowId}`);
    if (flow && flow.endTime)
      throw new Error(`Flow already finished at` + flow.endTime.toString());

    for (let i = 0; i < flow.state.length; i++) {
      const opState = flow.state[i];
      if (
        opState.id &&
        !opState.endTime &&
        opState.operation.type === 'container/run'
      ) {
        await new Promise<void>(async (resolve, reject) => {
          const c = await this.getContainerByName(opState.id as string);
          if (!c) {
            // when node is shutted down before the container started, it won't find the container
            // run op again in new container
            try {
              await this.runOperation(
                opState.operation as Operation<'container/run'>,
                flowId,
              );
            } catch (error) {
              console.log(chalk.red(error));
              this.db.data.flows[flowId].state[i].status = 'failed';
              this.db.write();
            }
            resolve();
          } else {
            const container = this.docker.getContainer(c.Id);
            const containerInfo = await container.inspect();

            if (containerInfo.State.Running) {
              const stdoutStream = new stream.PassThrough();
              const stderrStream = new stream.PassThrough();
              this.db.data.flows[flowId].state[i].logs = [];

              stdoutStream.on('data', (chunk) => {
                this.eventEmitter.emit('newLog', {
                  type: 'stdout',
                  log: chunk.toString(),
                });
                this.db.data.flows[flowId].state[i].logs.push({
                  type: 'stdout',
                  log: chunk.toString(),
                });
              });

              const logStream = await container.logs({
                stdout: true,
                stderr: true,
                follow: true,
              });
              container.modem.demuxStream(
                logStream,
                stdoutStream,
                stderrStream,
              );

              logStream.on('end', async () => {
                const endInfo = await container.inspect();
                this.db.data.flows[flowId].state[i].exitCode =
                  endInfo.State.ExitCode;
                this.db.data.flows[flowId].state[i].status = endInfo.State
                  .ExitCode
                  ? 'failed'
                  : 'success';
                this.db.data.flows[flowId].state[i].endTime = Math.floor(
                  new Date(endInfo.State.FinishedAt).getTime(),
                );
                this.db.write();

                stdoutStream.end();
                // container.remove();
                resolve();
              });
            } else if (containerInfo.State.Status === 'exited') {
              // Container is exited so job is finished
              // Retrieve logs, parse output and update flowState db
              const log = await container.logs({
                follow: false,
                stdout: true,
                stderr: true,
              });

              // parse output
              const output = this.demuxOutput(log);
              this.db.data.flows[flowId].state[i].logs = [];

              if (output.stdout !== '') {
                this.db.data.flows[flowId].state[i].logs.push({
                  type: 'stdout',
                  log: output.stdout,
                });
              }
              if (output.stderr !== '') {
                this.db.data.flows[flowId].state[i].logs.push({
                  type: 'stderr',
                  log: output.stderr,
                });
              }

              this.db.data.flows[flowId].state[i].exitCode =
                containerInfo.State.ExitCode;
              this.db.data.flows[flowId].state[i].status = containerInfo.State
                .ExitCode
                ? 'failed'
                : 'success';
              this.db.data.flows[flowId].state[i].endTime = Math.floor(
                new Date(containerInfo.State.FinishedAt).getTime(),
              );
              this.db.write();
              container.remove();
              resolve();
            }
          }
        });
        if (this.db.data.flows[flowId].state[i].status === 'failed') break;
      } else if (
        !opState.endTime &&
        opState.operation.type === 'container/run'
      ) {
        let state;
        try {
          state = await this.runOperation(
            opState.operation as Operation<'container/run'>,
            flowId,
          );
        } catch (error) {
          console.log(chalk.red(error));
          this.db.data.flows[flowId].state[i].status = 'failed';
          this.db.write();
          break;
        }
        if (state && state.status === 'failed') break;
      }
    }

    this.finishFlow(flowId);
  }

  /**
   * Finish a flow. Set status & emit end event
   * @param flowStateId
   */
  private finishFlow(flowId: string, status?: string) {
    const checkStatus = (op: OpState) => op.status === 'failed';
    if (status) {
      this.db.data.flows[flowId].status = status;
    } else {
      this.db.data.flows[flowId].status =
        this.db.data.flows[flowId].state.some(checkStatus) ||
        this.db.data.flows[flowId].state.every((opState) => !opState.status)
          ? 'failed'
          : 'success';
    }
    this.db.data.flows[flowId].endTime = Date.now();
    this.db.write();

    this.eventEmitter.emit('flowFinished', flowId);
    console.log(`Finished flow ${flowId} \n`);
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

    delete this.db.data.flows[flowId];
    this.db.write();
    console.log('Cleared flow', flowId);
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

  /**
   * input: log Buffer, output stdout & stderr strings
   * @param buffer
   * @returns
   */
  private demuxOutput = (
    buffer: Buffer,
  ): { stdout: string; stderr: string } => {
    const stdouts: Buffer[] = [];
    const stderrs: Buffer[] = [];

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
          stdouts.push(content);
          break;
        case 2:
          stderrs.push(content);
          break;
        default:
        // ignore
      }
    }

    return {
      stdout: Buffer.concat(stdouts).toString('utf8'),
      stderr: Buffer.concat(stderrs).toString('utf8'),
    };
  };

  /****************
   *   Getters   *
   ****************/
  public getFlow(id: string): Flow | undefined {
    return this.db.data.flows[id];
  }

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
