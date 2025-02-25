import { Client, Flow, OpState } from '@nosana/sdk';

import { configs } from '../../configs/configs.js';
import { FlowHandler } from '../flow/flowHandler.js';
import { Provider } from '../../provider/Provider.js';
import {
  specsAndNetworkJob,
  specsJob,
} from '../../../../static/staticsImports.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';

import {
  CudaCheckErrorResponse,
  CudaCheckResponse,
  CudaCheckSuccessResponse,
} from '../../../../types/cudaCheck.js';
import { NetworkInfoResults, SystemInfoResults } from './type.js';
import { clientSelector, QueryClient } from '../../../../api/client.js';

export class SpecsHandler {
  private client: QueryClient;
  private flowHandler: FlowHandler;

  constructor(
    private provider: Provider,
    private repository: NodeRepository,
    private sdk: Client,
  ) {
    this.client = clientSelector();
    this.flowHandler = new FlowHandler(this.provider, repository);
    applyLoggingProxyToClass(this);
  }

  async check(isInMarket: boolean): Promise<boolean> {
    const id = this.flowHandler.generateRandomId(32);

    this.flowHandler.start(id, isInMarket ? specsJob : specsAndNetworkJob);

    let result: Flow | undefined;
    try {
      result = await this.flowHandler.run(id);
    } catch (error) {
      throw error;
    }

    if (result) {
      this.repository.deleteflow(result.id);

      if (result && result.state.status === 'success') {
        await this.processSuccess(result.state.opStates);
        await this.submitSystemSpecs();
      } else if (result && result.state.status === 'failed') {
        this.processFailure(result.state.opStates);
      } else {
        throw new Error('Cannot find results');
      }

      return true;
    }

    return false;
  }

  private async submitSystemSpecs(): Promise<void> {
    const nodeInfo = this.repository.getNodeInfo();

    await this.client
      .POST('/api/nodes/{id}/submit-system-specs', {
        params: {
          path: { id: this.sdk.solana.provider!.wallet.publicKey.toString() },
          header: {
            authorization: this.sdk.authorization.generate(
              configs().signMessage,
            ),
          },
        },
        body: nodeInfo,
      })
      .catch((error) => {
        console.error(error);
      });
  }

  private processSuccess(opStates: OpState[]): void {
    if (!opStates) {
      throw new Error('Missing operation states in result');
    }

    for (const { operationId, logs } of opStates) {
      switch (operationId) {
        case 'system-info':
          this.processSystemInfoBenchmark(logs);
          break;
        case 'network-info':
          this.processNetworkInfoBenchmark(logs);
          break;
        case 'gpu-info':
          this.processGPUInfoBenchmark(logs);
          break;
      }
    }
  }

  private parseLogsIntoJSON<T extends unknown>(logs: OpState['logs']): T {
    return JSON.parse(
      logs.reduce(
        (result: string, { log, type }) =>
          type === 'stdout' ? result + log : result,
        '',
      ),
    ) as T;
  }

  private processFailure(opStates: any[]): void {
    const errors: string[] = [];

    if (opStates[0]) {
      try {
        const cudaCheckResults = JSON.parse(
          opStates[0].logs[0].log!,
        ) as CudaCheckResponse;

        if ((cudaCheckResults as CudaCheckErrorResponse).error) {
          errors.push(
            'GPU benchmark failed. Ensure NVidia Cuda runtime drivers and NVidia Container Toolkit are correctly configured.',
          );
        }
      } catch (error) {
        errors.push('GPU benchmark returned with no devices.');
      }
    }

    if (opStates[1]) {
      errors.push('Disk space check failed.');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }
  }

  private processSystemInfoBenchmark(logs: OpState['logs']): void {
    if (!logs[0]) throw new Error('Could not find system info logs');

    const {
      system_environment,
      cpu_model: model,
      logical_cores,
      physical_cores,
      ram_mb,
      disk_gb,
    } = this.parseLogsIntoJSON<SystemInfoResults>(logs);

    if (configs().minDiskSpace > disk_gb) {
      throw new Error(
        `Node does not have enough disk space. Required: ${
          configs().minDiskSpace
        }GB, Available: ${disk_gb}GB`,
      );
    }

    this.repository.updateNodeInfo({
      system_environment,
      cpu: {
        model,
        logical_cores,
        physical_cores,
      },
      ram_mb,
      disk_gb,
    });
  }

  private processNetworkInfoBenchmark(logs: OpState['logs']): void {
    if (!logs[0]) throw new Error('Could not find network info logs');

    const { country, ip, ping_ms, download_mbps, upload_mbps } =
      this.parseLogsIntoJSON<NetworkInfoResults>(logs);

    this.repository.updateNodeInfo({
      country,
      network: {
        ip,
        ping_ms,
        download_mbps,
        upload_mbps,
      },
    });
  }

  private processGPUInfoBenchmark(logs: OpState['logs']): void {
    if (!logs[0]) throw new Error('Could not find GPU info logs');

    const results = this.parseLogsIntoJSON<CudaCheckSuccessResponse>(logs);
    this.repository.updateNodeInfo({ gpus: results });
  }
}
