import chalk from 'chalk';
import { DockerProvider } from './DockerProvider';
import { Flow, OpState, OperationArgsMap } from './Provider';
import Docker from 'dockerode';
import { parse } from 'shell-quote';

export class PodmanProvider extends DockerProvider {
  private apiUrl: string;

  constructor(podman: string) {
    super(podman);
    this.apiUrl = `${this.protocol}://${this.host}:${this.port}/v4.5.0/libpod`;
  }
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

      const options = {
        image: opArgs.image,
        name: name,
        command: parsedcmd,
        volumes: opArgs.volumes,
        env: { "DEBUG": "1" },
        devices: [{ path: 'nvidia.com/gpu=all' }],
        portmappings: [{ container_port: 80, host_port: 8081 }],
        create_working_dir: true,
        cgroups_mode: 'disabled',
      };

      try {
        // create container
        const create = await fetch(
          `${this.apiUrl}/containers/create`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(options),
          },
        );

        // start container and handle logs
        if (create.status === 201) {
          const createResult = await create.json();
          
          const start = await fetch(`${this.apiUrl}/containers/${createResult.Id}/start`, {
            method: 'POST',
          });

          if (start.status === 204) {
            const logs: OpState['logs'] = [];
            await this.handleLogStreams(
              name,
              (data: { log: string; type: 'stdin' | 'stdout' | 'stderr' }) => {
                this.eventEmitter.emit('newLog', {
                  type: data.type,
                  log: data.log,
                });
                logs.push({
                  type: data.type,
                  log: data.log,
                });
                updateOpState({ logs });
              },
            ).catch((e) => {
              console.log(chalk.red(`Error handling log streams for ${name}`, e));
            });

            const c = await this.getContainerByName(name);
            if (c) {
              const container = this.docker.getContainer(c.Id);
              await this.finishOpContainerRun(container, updateOpState);
              resolve(flow.state.opStates[opStateIndex]);
            } else {
              updateOpState({
                exitCode: 3,
                status: 'failed',
                endTime: Date.now(),
                logs: [{
                  type: 'stderr',
                  log: 'Cannot fetch container info'
                }]
              });
              reject(flow.state.opStates[opStateIndex]);
            }  
          } else {
            updateOpState({
              exitCode: 1,
              status: 'failed',
              endTime: Date.now(),
              logs: [{
                type: 'stderr',
                log: 'Cannot start container: ' + (await start.json()).message
              }]
            });
            reject(flow.state.opStates[opStateIndex]);
          }
        } else {
          updateOpState({
            exitCode: 1,
            status: 'failed',
            endTime: Date.now(),
            logs: [{
              type: 'stderr',
              log: 'Cannot create container' + (await create.json()).message
            }]
          });
          reject(flow.state.opStates[opStateIndex]);
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}
