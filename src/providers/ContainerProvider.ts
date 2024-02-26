import chalk from 'chalk';
import {
  JobDefinition,
  Operation,
  BaseProvider,
  OpState,
  FlowState,
} from './BaseProvider';
import ora from 'ora';
import Docker, { Exec } from 'dockerode';
import stream from 'stream';
import streamPromises from 'stream/promises';
import { parse } from 'shell-quote';
import EventEmitter from 'events'; 
import { JSONFileSyncPreset } from 'lowdb/node'

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

  async runOps(jobDefinition: JobDefinition, flowStateId: string): Promise<void> {
    const state: FlowState = {
      id: flowStateId,
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      ops: []
    }
    this.db.update(({ flowStates }) => flowStates.push(state))

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
            flowStateId
          );
        }
      } catch (error) {
        console.log(chalk.red(error));
        status = 'failed';
      }
    }
    const checkStatus = (op: OpState) => op.status === 'failed';
    this.db.data.flowStates[flowStateIndex].status = this.db.data.flowStates[flowStateIndex].ops.some(checkStatus) ? 'failed' : status;
    this.db.data.flowStates[flowStateIndex].endTime = Date.now();
    this.db.write()

    spinner.stop();

    this.eventEmitter.emit('flowFinished', flowStateId);
    console.log(chalk.green(`Finished flow ${flowStateId} \n`))
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

  getFlowState (id: string): FlowState | undefined {
    return this.db.data.flowStates.find((o) => o.id === id);
  }

  getFlowStateIndex (id: string): number {
    return this.db.data.flowStates.findIndex((o) => o.id === id)
  }

  getFlowStates() {
    return this.db.data.flowStates;
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

    await container.start();

    // TODO: how to stop this listener?
    // this.docker.getEvents(
    //   {
    //     filters: {
    //       container: [name],
    //       event: [],
    //     },
    //   },
    //   this.handleDockerEvents,
    // );

    return container;
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
    const container = await this.setupContainer(op);
    const outputs: OpState["logs"] = [];
    let exitCode = 0;

    const state = {
      id: op.id,
      providerFlowId: container.id,
      startTime,
      endTime: 0,
      status: 'running',
      exitCode,
      execs: [] as OpState["execs"],
      logs: [] as OpState["logs"],
    }

    const flowStateIndex = this.getFlowStateIndex(flowStateId);
    this.db.data.flowStates[flowStateIndex].ops.push(state);
    const opIndex = this.db.data.flowStates[flowStateIndex].ops.findIndex((o) => op.id === o.id);
    this.db.write()

    // exec commands in op
    for (let i = 0; i < op.args?.cmds.length; i++) {
      try {
        const cmd = op.args?.cmds[i];
        const exec = await this.exec(container, cmd, op.id, flowStateId);
        state.status = exec.exitCode ? 'failed' : 'success';
        state.exitCode = exec.exitCode || state.exitCode;

        let type: 'stdin' | 'stdout' | 'stderr' =
        state.status === 'failed' ? 'stderr' : 'stdout';
        outputs.push({
          type,
          log: state.status === 'failed' ? exec.stderr : exec.stdout,
        });
      } catch (e: any) {
        state.status = 'failed';
        outputs.push({
          type: 'stderr' as const,
          log: e.toString(),
        });
      }
    }

    await container.stop();
    container.remove();

    state.logs = outputs;
    state.endTime = Date.now();
    this.db.data.flowStates[flowStateIndex].ops[opIndex] = state;
    this.db.write()

    return this.db.data.flowStates[flowStateIndex].ops[opIndex];
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
    flowStateId: string,
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
    const flowStateIndex = this.getFlowStateIndex(flowStateId);
    const opIndex = this.db.data.flowStates[flowStateIndex].ops.findIndex((o) => opId === o.id);

    this.docker.modem.demuxStream(dockerExecStream, stdoutStream, stderrStream);

    dockerExecStream.resume();

    // save exec info also in flow state
    const execInfo = await dockerExec.inspect();
    this.db.data.flowStates[flowStateIndex].ops[opIndex].execs.push({
      id: execInfo.ID,
      cmd: execInfo.ProcessConfig.arguments,
    })
    this.db.write();

    dockerExecStream.on('data', (chunk: any) => {
      // console.log(chunk.toString());
      this.db.data.flowStates[flowStateIndex].ops[opIndex].logs.push({
        type: 'stdout',
        log: chunk.toString(),
      })
      this.db.write();
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

  /**
   * Wait for flow to be finished and return FlowState
   * @param id Flow id
   * @returns FlowState 
   */
  async waitForFlowFinish(id: string): Promise<FlowState | undefined> {
    return await new Promise((resolve, reject) => {
      const flowStateIndex = this.getFlowStateIndex(id);
      if (flowStateIndex === -1) reject('Flow state not found');
      if(this.db.data.flowStates[flowStateIndex].endTime) {
        resolve(this.db.data.flowStates[flowStateIndex])
      }
      this.eventEmitter.on('flowFinished', (flowId) => { 
        this.eventEmitter.removeAllListeners('flowFinished');
        resolve(this.db.data.flowStates[flowStateIndex])
      });
    });
  }

  // TODO
  async continueFlow(flowId: string): Promise<void> {
    const flow = this.getFlowState(flowId);
    if (!flow) throw new Error(`Flow not found: ${flowId}`);
    if (flow && flow.endTime) throw new Error(`Flow already finished at: ` + flow.endTime.toString());

    for (let i = 0; i < flow.ops.length; i++) {
      const op = flow.ops[i];
      const container = this.docker.getContainer(op.providerFlowId);
      if (!container) throw new Error(`Container not found for op: ${op.id} in flow ${flow.id}`);

      if (!op.endTime) {
        for (let i = 0; i < op.execs.length; i++) {
          const exec = new Exec(container.modem, op.execs[i].id);
          // exec = {
          //   CanRemove: true,
          //   ContainerID: "37b1e7cee72c4c843716a5323f13ca3414b6cb1ba0742a016b0446a671d84157",
          //   DetachKeys: "",
          //   ExitCode: -1,
          //   ID: "4e4e6e4453f9aac9117c1d21db8cf74f58c364603410829c23d786c9e14c7678",
          //   OpenStderr: true,
          //   OpenStdin: false,
          //   OpenStdout: true,
          //   Running: false,
          //   Pid: 0,
          //   ProcessConfig: {
          //     arguments: [ "-c", "for i in {1..200}; do echo $i; sleep 2; done" ],
          //     entrypoint: "/bin/bash",
          //     privileged: false,
          //     tty: false,
          //     user: "",
          //   },
          // }
          console.log('continueFlow exec', await exec.inspect());
        }
      }
    }
  }

}
