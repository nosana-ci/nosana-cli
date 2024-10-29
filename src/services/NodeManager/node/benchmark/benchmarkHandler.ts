import { Client as SDK } from '@nosana/sdk';
import { FlowHandler } from '../flow/flowHandler.js';
import { Provider } from '../../provider/Provider.js';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import {
  benchmarkGPU,
} from '../../../../static/staticsImports.js';
import { CudaCheckResponse } from '../../../../types/cudaCheck.js';
import { config } from '../../../../generic/config.js';
import {
  PublicKey,
} from '@solana/web3.js';

export class BenchmarkHandler {
  private flowHandler: FlowHandler;
  private address: PublicKey;

  constructor(
    private sdk: SDK,
    private provider: Provider,
    private repository: NodeRepository,
  ) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;
    this.flowHandler = new FlowHandler(this.provider, repository);
    applyLoggingProxyToClass(this);
  }

  async check(): Promise<boolean> {
    if (this.sdk.nodes.config.network == 'devnet') {
      return true;
    }

    const id = this.generateRandomId(32);
    this.flowHandler.start(id, benchmarkGPU);
    const result = await this.flowHandler.run(id);

    if (result && result.state.status === 'success') {
      await this.processSuccess(result.state.opStates);
    } else if (result && result.state.status === 'failed') {
      this.processFailure(result.state.opStates);
    } else {
      throw new Error('Cannot find results');
    }

    return true;
  }

  private async processSuccess(opStates: any[]): Promise<void> {
    if (!opStates) {
      throw new Error('Missing operation states in result');
    }

    await this.handleGPUBenchmark(opStates[0]);
    await this.handleDiskSpaceCheck(opStates[1]);
  }

  private processFailure(opStates: any[]): void {
    const errors: string[] = [];

    if (opStates[0]) {
      const { error } = JSON.parse(
        opStates[0].logs[0].log!,
      ) as CudaCheckResponse;

      if (error) {
        errors.push(
          'GPU benchmark failed. Ensure NVidia Cuda runtime drivers and NVidia Container Toolkit are correctly configured.',
        );
      }
    }

    if (opStates[1]) {
      errors.push('Disk space check failed.');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }
  }

  private async handleGPUBenchmark(opState: any): Promise<void> {
    if (!opState || !opState.logs || !opState.logs[0]) {
      throw new Error('Cannot find GPU benchmark output');
    }

    const { devices } = JSON.parse(opState.logs[0].log!) as CudaCheckResponse;

    if (!devices) {
      throw new Error('GPU benchmark returned with no devices');
    }

    const gpus = opState.logs[0].log!;
    this.repository.updateNodeInfo({ gpus: `${gpus}` });
  }

  private async handleDiskSpaceCheck(opState: any): Promise<void> {
    if (!opState || !opState.logs) {
      throw new Error(`Can't find disk space output`);
    }

    for (const logEntry of opState.logs) {
      if (logEntry.log) {
        const availableDiskSpace = parseInt(logEntry.log);

        this.repository.updateNodeInfo({ disk: `${availableDiskSpace}` });

        if (config.minDiskSpace > availableDiskSpace) {
          throw new Error(
            `Not enough disk space available. Found ${
              availableDiskSpace / 1000
            } GB available. Needs at least ${config.minDiskSpace / 1000} GB.`,
          );
        }
      } else {
        throw new Error(`Can't find disk space output`);
      }
    }
  }

  private generateRandomId(length: number): string {
    return [...Array(length)].map(() => Math.random().toString(36)[2]).join('');
  }
}
