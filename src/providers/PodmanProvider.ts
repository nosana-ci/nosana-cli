import chalk from 'chalk';
import { DockerProvider } from './DockerProvider';
import {
  Flow,
  OpState,
  Operation,
  OperationArgsMap,
  Provider,
} from './Provider';
import { parse } from 'shell-quote';
import { MountType } from 'dockerode';
import stream from 'stream';

export class PodmanProvider extends DockerProvider {
  /**
   * Run operation and return results
   * @param op Operation specs
   * @returns OpState
   */
  async executeCmd(
    opArgs: OperationArgsMap['container/run'],
    flowId: string,
    opStateIndex: number,
    updateOpState: Function,
  ): Promise<OpState> {
    return await new Promise<OpState>(async (resolve, reject) => {
      let cmd = '';
      for (let i = 0; i < opArgs.cmds.length; i++) {
        if (i === 0) {
          cmd += opArgs.cmds[i];
        } else {
          cmd += "'" + opArgs.cmds[i] + "'";
        }
      }
      const flow = this.getFlow(flowId) as Flow;
      const parsedcmd = parse(cmd);

      try {
        await this.pullImage(opArgs.image);
      } catch (error: any) {
        reject(chalk.red(`Cannot pull image ${opArgs.image}: `) + error);
      }

      // when flow is being cleared, resolve promise
      this.eventEmitter.on('startClearFlow', (id) => {
        if (id === flowId) {
          this.eventEmitter.removeAllListeners('startClearFlow');
          resolve(flow.state.opStates[opStateIndex]);
        }
      });

      const name =
        opArgs.image +
        '-' +
        [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
      updateOpState({ providerId: name });

      // const logs: OpState['logs'] = [];
      // this.handleLogStreams(
      //   name,
      //   (data: { log: string; type: 'stdin' | 'stdout' | 'stderr' }) => {
      //     this.eventEmitter.emit('newLog', {
      //       type: data.type,
      //       log: data.log,
      //     });
      //     logs.push({
      //       type: data.type,
      //       log: data.log,
      //     });
      //     updateOpState({ logs });
      //   },
      //   3,
      // ).catch((e) => {
      //   console.log(chalk.red(`Error handling log streams for ${name}`, e));
      // });

      const options = {
        image: opArgs.image,
        command: ["/bin/bash", "-c", "echo Hello!"], // parsedcmd
        // name,
        // env: { DEBUG: 1 },
        // volumes: opArgs.volumes,
        // devices: [{ path: 'nvidia.com/gpu=all' }],
        // portmappings: [{ container_port: 80, host_port: this.port }],
        // create_working_dir: true,
        // cgroups_mode: 'disabled',
      };
      console.log('options', options);

      try {
        const createContainer = await fetch(
          `${this.protocol}://${this.host}:${this.port}/containers/create`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(options),
          },
        );
        const createResult = await createContainer.json();
        console.log('createResult:', createResult);

        const startContainer = await fetch(
          `${this.protocol}://${this.host}:${this.port}/containers/${createResult.Id}/start`,
          {
            method: 'POST',
          },
        );

        // const startResult = await startContainer.json();
        console.log('startResult:', startContainer);
      } catch (error) {
        console.log('error:', error);
      }
    });
  }
}
