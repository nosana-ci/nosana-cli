import chalk from 'chalk';
import {
  JobDefinition,
  Operation,
  BaseProvider,
  OpState,
  FlowState,
} from './BaseProvider';
import ora from 'ora';
import Docker from 'dockerode';
import stream from 'stream';
import { parse } from 'shell-quote';
import EventEmitter from 'events';
import { JSONFileSyncPreset } from 'lowdb/node';

interface FlowStatesDb {
  flowStates: Array<FlowState>;
}

export class ContainerProvider implements BaseProvider {
  docker: Docker;
  db = JSONFileSyncPreset<FlowStatesDb>('db/flows.json', { flowStates: [] });
  eventEmitter: EventEmitter = new EventEmitter();

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
    this.runOps(jobDefinition, id);
    return id;
  }

  /**
   * Run operations form job definition
   * @param jobDefinition 
   * @param flowStateId 
   */
  async runOps(jobDefinition: JobDefinition, flowStateId: string): Promise<void> {
    const state: FlowState = {
      id: flowStateId,
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      ops: [],
    };
    this.db.update(({ flowStates }) => flowStates.push(state));

    const spinner = ora(chalk.cyan(`Running job ${flowStateId} \n`)).start();
    const flowStateIndex = this.getFlowStateIndex(flowStateId);
    let status = 'success';

    // run operations
    for (let i = 0; i < jobDefinition.ops.length; i++) {
      const op = jobDefinition.ops[i];
      try {
        if (op.type === 'container/run') {
          await this.runOperation(
            op as Operation<'container/run'>,
            flowStateId,
          );
        }
      } catch (error) {
        console.log(chalk.red(error));
        status = 'failed';
      }
    }
    const checkStatus = (op: OpState) => op.status === 'failed';
    this.db.data.flowStates[flowStateIndex].status = this.db.data.flowStates[
      flowStateIndex
    ].ops.some(checkStatus)
      ? 'failed'
      : status;
    this.db.data.flowStates[flowStateIndex].endTime = Date.now();
    this.db.write();

    spinner.stop();

    this.eventEmitter.emit('flowFinished', flowStateId);
    console.log(chalk.green(`Finished flow ${flowStateId} \n`));
  }

  /**
   * Check if ContainerProvider is healthy by checking if podman is running
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

  getFlowState(id: string): FlowState | undefined {
    return this.db.data.flowStates.find((o) => o.id === id);
  }

  getFlowStateIndex(id: string): number {
    return this.db.data.flowStates.findIndex((o) => o.id === id);
  }

  getFlowStates() {
    return this.db.data.flowStates;
  }

  /**
   * Run operation and return results
   * @param op Operation specs
   * @returns OpState
   */
  private async runOperation(
    op: Operation<'container/run'>,
    flowStateId: string,
  ): Promise<OpState> {
    const startTime = Date.now();
    let run: { logs: OpState["logs"], exitCode: number } = { logs: [], exitCode: 0 };
    let exitCode = 0;

    const state = {
      id: op.id,
      providerFlowId: null,
      startTime,
      endTime: 0,
      status: 'running',
      exitCode,
      logs: [] as OpState["logs"],
    }

    const flowStateIndex = this.getFlowStateIndex(flowStateId);
    this.db.data.flowStates[flowStateIndex].ops.push(state);
    this.db.write()
    const opIndex = this.db.data.flowStates[flowStateIndex].ops.findIndex((o) => op.id === o.id);

    try {
      const cmd = op.args?.cmds;
      run = await this.executeCmd(cmd, op.args.image, flowStateIndex, opIndex);
      state.status = run.exitCode ? 'failed' : 'success';
      state.exitCode = run.exitCode || state.exitCode;
    } catch (e: any) {
      state.status = 'failed';
      run.logs.push({
        type: 'stderr' as const,
        log: e.toString(),
      });
    }

    state.logs = run?.logs;
    state.endTime = Date.now();
    this.db.data.flowStates[flowStateIndex].ops[opIndex] = state;
    this.db.write();

    return this.db.data.flowStates[flowStateIndex].ops[opIndex];
  }

  /**
   * Pull docker image
   * @param image 
   * @returns 
   */
  private async pullImage(image: string) {
    return await new Promise((resolve, reject) => {
      this.docker.pull(image, (err: any, stream: any) => {
        if (err) {
          return reject(err);
        }
        this.docker.modem.followProgress(stream, (err: any, res: any) =>
          err ? reject(err) : resolve(res),
        );
      });
    });
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
    cmd: string,
    image: string,
    flowStateIndex: number,
    opIndex: number
  ): Promise<{
    exitCode: number;
    logs: [];
  }> {
    const parsedcmd = parse(cmd);

    await this.pullImage(image);
    
    const stdoutStream = new stream.PassThrough();
    const stderrStream = new stream.PassThrough();

    stdoutStream.on('data', (chunk) =>{
      this.eventEmitter.emit('newLog', { opIndex, log: chunk.toString() });
      this.db.data.flowStates[flowStateIndex].ops[opIndex].logs.push({
        type: 'stdout',
        log: chunk.toString(),
      });
      this.db.write();
    })

    return await this.docker.run(
      image,
      parsedcmd as string[],
      [stdoutStream, stderrStream],
      {
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
        }
      })
      .then(([res, container]) => {
        console.log('Docker run finished');
        const stderr = stderrStream.read() as Buffer | undefined;
        container.remove();

        const logs = this.db.data.flowStates[flowStateIndex].ops[opIndex].logs;
        if (stderr) {
          logs.push({
            type: 'stderr',
            log: stderr.toString(),
          })
        }

        return {
          exitCode: res.StatusCode,
          logs,
        };
      })
      .catch(error => {
        chalk.red(console.log('Docker run failed', {error}));
        return error;
      });
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
   * Wait for flow to be finished and return FlowState
   * @param id Flow id
   * @param logCallback
   * @returns FlowState
   */
  async waitForFlowFinish(
    id: string,
    logCallback?: Function,
  ): Promise<FlowState | undefined> {
    return await new Promise((resolve, reject) => {
      const flowStateIndex = this.getFlowStateIndex(id);
      if (flowStateIndex === -1) reject('Flow state not found');
      if (this.db.data.flowStates[flowStateIndex].endTime) {
        resolve(this.db.data.flowStates[flowStateIndex]);
      }

      if (logCallback) {
        this.eventEmitter.on('newLog', (info) => {
          logCallback(info);
        });
      }

      this.eventEmitter.on('flowFinished', (flowId) => {
        this.eventEmitter.removeAllListeners('flowFinished');
        this.eventEmitter.removeAllListeners('newLog');
        resolve(this.db.data.flowStates[flowStateIndex]);
      });
    });
  }

  // TODO
  // async continueFlow(flowId: string): Promise<void> {
  //   const flow = this.getFlowState(flowId);
  //   if (!flow) throw new Error(`Flow not found: ${flowId}`);
  //   if (flow && flow.endTime) throw new Error(`Flow already finished at: ` + flow.endTime.toString());

  //   for (let i = 0; i < flow.ops.length; i++) {
  //     const op = flow.ops[i];
  //     const container = this.docker.getContainer(op.providerFlowId);
  //     const containerInfo = await container.inspect();
  //     if (!container) throw new Error(`Container not found for op: ${op.id} in flow ${flow.id}`);
  //     if (!containerInfo.State.Running) throw new Error(`Container ${containerInfo.Id} is not running anymore`);

  //     console.log('container', containerInfo.State)
  //     if (!op.endTime) {
        
  //     }
  //   }
  // }

}
