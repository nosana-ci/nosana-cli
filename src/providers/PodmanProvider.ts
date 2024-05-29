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
  private nodeName: string;

  constructor(podman: string, configLocation: string, nodeName: string) {
    super(podman, configLocation);
    this.apiUrl = `${this.protocol}://${this.host}:${this.port}/v4.5.0/libpod`;
    this.nodeName = nodeName;
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

      const name = flowId + '-' + flow.state.opStates[opStateIndex].operationId;
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
      await this.docker.createNetwork({ Name: name });
      const networks: any = {};
      networks[name] = {};

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
        netns: { nsmode: 'bridge' },
        Networks: networks,
        // portmappings: [{ container_port: 80, host_port: 8082 }], // TODO: figure out what we want with portmappings
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
          if (opArgs.expose) {
            this.startFrpc(name, opArgs.expose);
          }

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

  async startFrpc(name: string, port: number): Promise<void> {
    const networks: any = {};
    networks[name] = {};
    const options = {
      name: 'frpc-' + name,
      image: 'docker.io/laurensv/nosana-frpc',
      command: parse('-c /etc/frp/frpc.toml'),
      netns: { nsmode: 'bridge' },
      env: {
        FRP_SERVER_ADDR: '143.178.233.0',
        FRP_SERVER_PORT: '7000',
        FRP_NAME: name,
        FRP_LOCAL_IP: name,
        FRP_LOCAL_PORT: port.toString(),
        FRP_CUSTOM_DOMAIN: this.nodeName + '.variable.nl',
      },
      Networks: networks,
      create_working_dir: true,
      cgroups_mode: 'disabled',
    };
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

        if (start.status !== 204) {
          throw new Error(
            'Cannot start frpc container: ' + (await start.json()).message,
          );
        }
      } else {
        throw new Error(
          'Cannot create frpc container' + (await create.json()).message,
        );
      }
    } catch (error) {
      console.error(error);
    }
  }
}
