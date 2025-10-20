import { Job, Client as SDK } from '@nosana/sdk';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { JobDefinition, validateJobDefinition } from '../../provider/types.js';
import { FlowState } from '@nosana/sdk';
import { JobDefinitionStrategySelector } from './defination/JobDefinitionStrategy.js';
import { ResultReturnStrategySelector } from './result/ResultReturnStrategy.js';
import { IValidation } from 'typia';
import { createInitialFlow } from '../task/helpers/createInitialFlow.js';

export class JobExternalUtil {
  constructor(private sdk: SDK, private repository: NodeRepository) {}

  public async resolveJobDefinition(
    id: string,
    job: Job,
  ): Promise<JobDefinition | null> {
    let jobDefinition: JobDefinition | null = await this.sdk.ipfs.retrieve(
      job.ipfsJob,
    );

    if (jobDefinition && jobDefinition.logistics?.send?.type) {
      const strategySelector = new JobDefinitionStrategySelector();
      const strategy = strategySelector.selectStrategy(
        jobDefinition.logistics.send.type,
      );

      this.repository.setflow(
        id,
        createInitialFlow(
          id,
          job.project.toString(),
          jobDefinition,
          [],
          'waiting-for-job-definition',
          Date.now(),
        ),
      );

      try {
        jobDefinition = await strategy.load(
          id,
          jobDefinition.logistics.send.args,
        );
      } catch (error) {
        jobDefinition = null;
        this.repository.updateflowStateError(id, {
          status: 'logistics-error',
          error: error,
        });
      }
    }

    return jobDefinition;
  }

  public async resolveResult(id: string, job: Job): Promise<FlowState> {
    let result = this.repository.getFlowState(id);
    const orginalStatus = result.status;

    let jobDefinition: JobDefinition = await this.sdk.ipfs.retrieve(
      job.ipfsJob,
    );

    if (!result) {
      return {
        status: '',
        startTime: 0,
        endTime: 0,
        opStates: [],
      };
    }

    if (jobDefinition.logistics?.receive?.type) {
      const strategySelector = new ResultReturnStrategySelector();
      const strategy = strategySelector.selectStrategy(
        jobDefinition.logistics.receive.type,
      );

      this.repository.updateflowState(id, {
        status: 'waiting-for-result',
      });

      const blankResult: FlowState = {
        status: orginalStatus,
        startTime: result.startTime,
        endTime: result.endTime,
        opStates: [],
        errors: result.errors ?? [],
      };

      try {
        await strategy.load(
          id,
          jobDefinition.logistics.receive.args,
          result,
          orginalStatus,
        );
      } catch (error) {
        this.repository.updateflowStateError(id, {
          error: error,
        });
      }

      result = blankResult;
    }

    return result;
  }

  async validate(id: string, jobDefinition: JobDefinition): Promise<boolean> {
    const validation: IValidation<JobDefinition> =
      validateJobDefinition(jobDefinition);

    if (!validation.success) {
      this.repository.updateflowState(id, {
        endTime: Date.now(),
        status: 'failed',
      });
      this.repository.updateflowStateError(id, {
        status: 'validation-error',
        error: validation.errors,
      });
      return false;
    }

    return true;
  }
}
