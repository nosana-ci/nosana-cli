import { Client } from '@nosana/sdk';

import { configs } from '../../configs/configs.js';
import { Provider } from '../../provider/Provider.js';
import { specsAndNetworkJob } from '../../../../static/staticsImports.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';

import {
  CudaCheckErrorResponse,
  CudaCheckResponse,
  CudaCheckSuccessResponse,
} from '../../../../types/cudaCheck.js';
import { NetworkInfoResults, SystemInfoResults } from './type.js';
import { OpState } from '@nosana/sdk';
import TaskManager from '../task/TaskManager.js';
import { generateRandomId } from '../../../../providers/utils/generate.js';

export class SpecsHandler {
  constructor(
    private provider: Provider,
    private repository: NodeRepository,
    private sdk: Client,
  ) {
    applyLoggingProxyToClass(this);
  }

  async check(): Promise<boolean> {
    const id = generateRandomId(32);

    const task = new TaskManager(
      this.provider,
      this.repository,
      id,
      this.sdk.solana.wallet.publicKey.toString(),
      specsAndNetworkJob,
    );

    try {
      task.bootstrap();
      await task.start();
    } catch (error) {
      throw error;
    }

    let result = this.repository.getFlow(id);

    if (result) {
      this.repository.deleteflow(result.id);

      if (result && result.state.status === 'success') {
        await this.processSuccess(result.state.opStates);

        this.repository.updateNodeInfo({
          protocol: this.provider.containerOrchestration.getProtocol(),
        });

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

    const headers = new Headers();
    headers.append(
      'Authorization',
      await this.sdk.authorization.generate(configs().signMessage),
    );
    headers.append('Content-Type', 'application/json');

    await fetch(
      `${
        configs().backendUrl
      }/nodes/${this.sdk.solana.provider!.wallet.publicKey.toString()}/submit-system-specs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(nodeInfo),
      },
    ).catch((error) => {
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
    const combinedLogs = logs.reduce(
      (result: string, { log, type }) => {
        if (type === 'stdout' && log) {
          // Strip Docker log timestamps - format: "2026-01-13T14:23:13+01:00 content"
          const timestampMatch = log.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2} /);
          if (timestampMatch) {
            return result + log.slice(timestampMatch[0].length);
          }
          // Fallback: try to find JSON start
          const jsonStart = log.indexOf('{');
          if (jsonStart >= 0) {
            return result + log.slice(jsonStart);
          }
          return result + log;
        }
        return result;
      },
      '',
    );

    return JSON.parse(combinedLogs.trim()) as T;
  }

  private processFailure(opStates: any[]): void {
    const errors: string[] = [];

    if (opStates[0]) {
      try {
        // Strip Docker log timestamps
        const rawLog = opStates[0].logs[0].log || '';
        let cleanLog = rawLog;
        const timestampMatch = rawLog.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2} /);
        if (timestampMatch) {
          cleanLog = rawLog.slice(timestampMatch[0].length);
        }
        // Fallback: try to find JSON start
        const jsonStart = cleanLog.indexOf('{');
        if (jsonStart >= 0) {
          cleanLog = cleanLog.slice(jsonStart);
        }
        const cudaCheckResults = JSON.parse(cleanLog.trim()) as CudaCheckResponse;

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
