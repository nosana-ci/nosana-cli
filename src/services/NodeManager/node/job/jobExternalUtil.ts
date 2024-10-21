import { Job, Market, Run, Client as SDK } from "@nosana/sdk";
import { NodeRepository } from "../../repository/NodeRepository.js";
import { JobDefinition, FlowState } from "../../provider/types.js";
import { JobDefinitionStrategySelector } from "./defination/JobDefinitionStrategy.js";
import { ResultReturnStrategySelector } from "./result/ResultReturnStrategy.js";
import { IValidation } from "typia";
import { validateJobDefinition } from "../../../../providers/Provider.js";

export class JobExternalUtil {
    constructor(
        private sdk: SDK,
        private repository: NodeRepository,
    ){
    }

    public async resolveJobDefinition(id: string, job: Job): Promise<JobDefinition> {
        let jobDefinition: JobDefinition = await this.sdk.ipfs.retrieve(
            job.ipfsJob,
        );

        if(jobDefinition.logicstics?.receive?.type) {
            const strategySelector = new JobDefinitionStrategySelector()
            const strategy = strategySelector.selectStrategy(jobDefinition.logicstics?.receive?.type)

            this.repository.updateflowState(id, {
                status: 'waiting-for-job-defination'
            })

            jobDefinition = await strategy.load(id)
        }

        return jobDefinition;
    }

    public async resolveResult(id: string): Promise<FlowState> {
        let result = this.repository.getFlowState(id)

        const jobDefinition = this.repository.getflow(id).jobDefinition

        if(jobDefinition.logicstics?.send?.type) {
            const strategySelector = new ResultReturnStrategySelector()
            const strategy = strategySelector.selectStrategy(jobDefinition.logicstics?.send?.type)

            this.repository.updateflowState(id, {
                status: 'waiting-for-result'
            })

            await strategy.load(id)

            result = {
                status: result.status,
                startTime: result.startTime,
                endTime: result.endTime,
                opStates: []
            }
        }

        return result;
    }

    async validate(id: string, jobDefinition: JobDefinition): Promise<boolean> {
        const validation: IValidation<JobDefinition> =
          validateJobDefinition(jobDefinition);

        if (!validation.success) {
            this.repository.updateflowStateError(id, {
                status: 'validation-error',
                errors: validation.errors,
            })
            return false;
        }

        return true;
    }
}