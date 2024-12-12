import { Flow, OpState } from '@nosana/sdk';

import { configs } from '../../configs/configs.js';
import { FlowHandler } from '../flow/flowHandler.js';
import { Provider } from '../../provider/Provider.js';
import {
  benchmarkGPU,
  jobDefinition,
} from '../../../../static/staticsImports.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';

import {
  CudaCheckErrorResponse,
  CudaCheckResponse,
  CudaCheckSuccessResponse,
} from '../../../../types/cudaCheck.js';

export class BenchmarkHandler {
  private flowHandler: FlowHandler;

  constructor(private provider: Provider, private repository: NodeRepository) {
    this.flowHandler = new FlowHandler(this.provider, repository);
    applyLoggingProxyToClass(this);
  }

  async check(isInMarket: boolean): Promise<boolean> {
    const id = this.flowHandler.generateRandomId(32);

    this.flowHandler.start(id, isInMarket ? benchmarkGPU : jobDefinition);

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
      } else if (result && result.state.status === 'failed') {
        this.processFailure(result.state.opStates);
      } else {
        throw new Error('Cannot find results');
      }

      return true;
    }

    return false;
  }

  private processSuccess(opStates: OpState[]): void {
    if (!opStates) {
      throw new Error('Missing operation states in result');
    }

    for (const { operationId, logs } of opStates) {
      switch (operationId) {
        case 'bandwidth':
          this.handleBandwidthBenchmark(logs);
          break;
        case 'country':
          this.hanldeCountryBenchmark(logs);
          break;
        case 'cpu':
          this.handleCPUBenchmark(logs);
          break;
        case 'disk-space':
          this.handleDiskSpaceCheck(logs);
          break;
        case 'ram':
          this.handleRAMBenchmark(logs);
          break;
        case 'gpu':
          this.handleGPUBenchmark(logs);
          break;
      }
    }
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

  private handleBandwidthBenchmark(logs: OpState['logs']): void {
    const parsedBandwidth = logs.reduce(
      (parsedResult: { [key: string]: number }, { log }) => {
        if (!log) return parsedResult;
        const [category, result] = log.split(':');
        return {
          ...parsedResult,
          [`${category.toLowerCase()}_${category === 'Ping' ? 'ms' : 'mbits'}`]:
            typeof result === 'string' ? parseFloat(result) : -1,
        };
      },
      {},
    );

    if (Object.keys(parsedBandwidth).length === 0)
      throw new Error('Cannot find bandwidth output');

    this.repository.updateNodeInfo({ bandwidth: parsedBandwidth });
  }

  private hanldeCountryBenchmark(logs: OpState['logs']): void {
    if (!logs[0].log) throw new Error('Cannot find country output');
    this.repository.updateNodeInfo({ country: logs[0].log.trim() });
  }

  private handleCPUBenchmark(logs: OpState['logs']): void {
    if (!logs[0].log) throw new Error('Cannot find cpu output');
    const parsedCPU = logs[0].log.replace('model name\t:', '').trim();
    this.repository.updateNodeInfo({ cpu: parsedCPU });
  }

  private handleRAMBenchmark(logs: OpState['logs']): void {
    if (!logs[0].log) throw new Error('Cannot find RAM output');
    this.repository.updateNodeInfo({ ram_mb: parseFloat(logs[0].log) });
  }

  private handleGPUBenchmark(logs: OpState['logs']): void {
    if (!logs[0].log) {
      throw new Error('Cannot find GPU benchmark output');
    }

    let log = logs.reduce(
      (jsonString: string, { log }) => jsonString + log,
      '',
    );

    let parsedCudaCheck: CudaCheckSuccessResponse;

    try {
      parsedCudaCheck = JSON.parse(log);
    } catch (error) {
      throw new Error('GPU benchmark returned with no devices');
    }

    if (!parsedCudaCheck.devices) {
      throw new Error('GPU benchmark returned with no devices');
    }

    this.repository.updateNodeInfo({
      gpus: parsedCudaCheck,
    });
  }

  private handleDiskSpaceCheck(logs: OpState['logs']): void {
    if (!logs[0]) {
      throw new Error(`Can't find disk space output`);
    }

    for (const logEntry of logs) {
      if (logEntry.log) {
        const minDiskSpace = configs().minDiskSpace / 1024;
        const availableDiskSpace = parseFloat(logEntry.log) / 1000;

        this.repository.updateNodeInfo({ disk_gb: availableDiskSpace });

        if (minDiskSpace > availableDiskSpace) {
          throw new Error(
            `Not enough disk space available. Found ${availableDiskSpace} GB available. Needs at least ${minDiskSpace} GB.`,
          );
        }
      } else {
        throw new Error(`Can't find disk space output`);
      }
    }
  }
}
