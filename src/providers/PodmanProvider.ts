import chalk from 'chalk';
import { DockerProvider } from './DockerProvider.js';
import {
  Flow,
  OpState,
  OperationArgsMap,
  OperationResults,
} from './Provider.js';
import { parse } from 'shell-quote';
import { ifStringCastToArray } from '../generic/utils.js';

export class PodmanProvider extends DockerProvider {
  private apiUrl: string;

  constructor(podman: string, configLocation: string) {
    super(podman, configLocation);
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
    operationResults: OperationResults | undefined,
  ): Promise<OpState> {
    return await new Promise<OpState>(async (resolve, reject) => {
      let cmd = '';
      if (Array.isArray(opArgs.cmd)) {
        for (let i = 0; i < opArgs.cmd.length; i++) {
          if (i === 0) {
            cmd += opArgs.cmd[i];
          } else {
            cmd += "'" + opArgs.cmd[i] + "'";
          }
        }
      } else {
        cmd = opArgs.cmd;
      }
      const flow = this.getFlow(flowId) as Flow;
      const parsedcmd = parse(cmd);

      const name = [...Array(32)]
        .map(() => Math.random().toString(36)[2])
        .join('');
      updateOpState({ providerId: name });

      // check for global & local options
      const gpu =
        opArgs.gpu ||
        (flow.jobDefinition.global && flow.jobDefinition.global.gpu)
          ? [
              {
                path: 'nvidia.com/gpu=all',
              },
            ]
          : [];
      const work_dir =
        opArgs.work_dir ||
        !flow.jobDefinition.global ||
        !flow.jobDefinition.global.work_dir
          ? opArgs.work_dir
          : flow.jobDefinition.global.work_dir;

      const entrypoint =
        opArgs.entrypoint ||
        !flow.jobDefinition.global ||
        !flow.jobDefinition.global.entrypoint
          ? opArgs.entrypoint
          : flow.jobDefinition.global.entrypoint;

      const globalEnv =
        flow.jobDefinition.global && flow.jobDefinition.global.env
          ? flow.jobDefinition.global.env
          : {};
      const environment = { ...globalEnv, ...opArgs.env };

      const volumes = [];
      if (opArgs.volumes && opArgs.volumes.length > 0) {
        for (let i = 0; i < opArgs.volumes.length; i++) {
          const volume = opArgs.volumes[i];
          volumes.push({
            dest: volume.dest,
            name: flowId + '-' + volume.name,
          });
        }
      }

      const options = {
        image: opArgs.image ? opArgs.image : flow.jobDefinition.global?.image,
        name: name,
        command: parsedcmd,
        volumes,
        ...(entrypoint
          ? { entrypoint: ifStringCastToArray(entrypoint) }
          : undefined),
        env: environment,
        devices: gpu,
        // portmappings: [{ container_port: 80, host_port: 8081 }], // TODO: figure out what we want with portmappings
        create_working_dir: true,
        cgroups_mode: 'disabled',
        work_dir,
      };

      this.eventEmitter.emit('newLog', {
        type: 'info',
        log: chalk.cyan('Running in container'),
      });
      try {
        // create container
        const create = await fetch(`${this.apiUrl}/containers/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(options),
        });

        // start container and handle logs
        if (create.status === 201) {
          const createResult = await create.json();

          const start = await fetch(
            `${this.apiUrl}/containers/${createResult.Id}/start`,
            {
              method: 'POST',
            },
          );

          if (start.status === 204) {
            // const logs: OpState['logs'] = [];
            await this.handleLogStreams(
              name,
              (data: { log: string; type: 'stdin' | 'stdout' | 'stderr' }) => {
                this.eventEmitter.emit('newLog', {
                  type: data.type,
                  log: data.log,
                });
                // logs.push({
                //   type: data.type,
                //   log: data.log,
                // });
                // updateOpState({ logs });
              },
            ).catch((e) => {
              console.error(
                chalk.red(`Error handling log streams for ${name}`, e),
              );
            });

            const c = await this.getContainerByName(name);
            if (c) {
              const container = this.docker.getContainer(c.Id);
              await this.finishOpContainerRun({
                container,
                updateOpState,
                operationResults,
              });
              resolve(flow.state.opStates[opStateIndex]);
            } else {
              updateOpState({
                exitCode: 3,
                status: 'failed',
                endTime: Date.now(),
                logs: [
                  {
                    type: 'stderr',
                    log: 'Cannot fetch container info',
                  },
                ],
              });
              reject(flow.state.opStates[opStateIndex]);
            }
          } else {
            reject('Cannot start container: ' + (await start.json()).message);
          }
        } else {
          reject('Cannot create container' + (await create.json()).message);
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}
