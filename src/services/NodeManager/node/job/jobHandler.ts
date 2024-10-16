import { Job, Market, Run, Client as SDK } from "@nosana/sdk";
import { FlowState, JobDefinition } from "../../provider/types.js";
import { FlowHandler } from "../flow/flowHandler.js";
import { Provider } from "../../provider/Provider.js";
import { applyLoggingProxyToClass } from "../monitoring/proxy/loggingProxy.js";
import { NodeRepository } from "../../repository/NodeRepository.js";
import { JobDefinitionStrategySelector } from "./defination/JobDefinitionStrategy.js";
import { ResultReturnStrategySelector } from "./result/ResultReturnStrategy.js";
import { IValidation } from "typia";
import { validateJobDefinition } from "../../../../providers/Provider.js";

export class JobHandler {
    private id: string | undefined;
    private job: Job | undefined;

    private flowHandler: FlowHandler;

    constructor(
        private sdk: SDK,
        private provider: Provider,
        private repository: NodeRepository,
    ){
        this.flowHandler = new FlowHandler(this.provider, repository);
        applyLoggingProxyToClass(this)
    }

    public get() : Job | undefined{
        return this.job
    }

    private jobId(): string {
        if (!this.id) {
            throw new Error("Job ID is not set");
        }
        return this.id;
    }

    private getJobOrThrow(): Job {
        if (!this.job) {
            throw new Error("Job is not set");
        }
        return this.job;
    }

    public clearJob(){
        this.job = undefined
    }

    async claim(jobAddress: string): Promise<Job> {
        try {
            const job: Job = await this.sdk.jobs.get(jobAddress);
            this.id = jobAddress
            this.job = job
            return job
        } catch (_) {
            throw new Error('could not start job')
        }
    }

    async stop(): Promise<void> {
        await this.flowHandler.stop(this.jobId())
        this.clearJob()
    }

    public isJobExpired(run: Run, market: Market): boolean {
        const now = Date.now() / 1000;
        // @ts-expect-error Type is wrong, its not a number but a BN
        return run.account.time.toNumber() + (market.jobTimeout * 1.5) < now;
    }

    async validate(jobDefinition: JobDefinition): Promise<boolean> {
        const validation: IValidation<JobDefinition> =
          validateJobDefinition(jobDefinition);

        if (!validation.success) {
            this.repository.updateflowStateError(this.jobId(), {
                status: 'validation-error',
                errors: validation.errors,
            })
            return false;
        }

        return true;
    }

    async expired(market: Market, run: Run): Promise<boolean> {
        return this.isJobExpired(run, market)
    }

    async start(job: Job): Promise<boolean> {
        const flow = this.repository.getflow(this.jobId())

        if(!flow){
            this.flowHandler.init(this.jobId())

            let jobDefinition: JobDefinition = await this.resolveJobDefinition(job)

            if(!await this.validate(jobDefinition)){
                return false;
            }

            this.flowHandler.start(this.jobId(), jobDefinition)
        } else {
            this.flowHandler.resume(this.jobId())
        }

        return true;
    }

    async run(): Promise<void> {
        await this.flowHandler.run(this.jobId())
    }

    async quit(run: Run): Promise<void> {
        await this.sdk.jobs.quit(run);
        await this.flowHandler.stop(this.jobId())
    }

    async wait(run: Run, market: Market): Promise<void> {
        if(this.repository.getFlowState(this.jobId()).status == 'failed'){
            return;
        }

        if (this.flowHandler.exposed(this.jobId())) {
            const expirationTime = (run.account.time as number) + (market.jobTimeout * 1.5);
            const waitTimeInSeconds = expirationTime - (Date.now() / 1000);
            
            if (waitTimeInSeconds > 0) {
                const waitTimeInMilliseconds = waitTimeInSeconds * 1000;
                await this.idle(waitTimeInMilliseconds);
            }
        }

        this.repository.updateflowState(this.jobId(), {
            status: 'success',
            endTime: Date.now()
        })
    }

    async idle(waitTimeInMilliseconds: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, waitTimeInMilliseconds));
    }

    async finish(run: Run): Promise<void> {
        try {
            let result = await this.resolveResult(this.jobId())
            const ipfsResult = await this.sdk.ipfs.pin(result as object);
            const bytesArray = this.sdk.ipfs.IpfsHashToByteArray(ipfsResult);

            await this.sdk.jobs.submitResult(
                bytesArray,
                run,
                this.getJobOrThrow().market.toString(),
            );
        } catch (e) {
            throw new Error(`Failed to finish job: ${e}`);
        }
    }

    public async resolveJobDefinition(job: Job): Promise<JobDefinition> {
        let jobDefinition: JobDefinition = await this.sdk.ipfs.retrieve(
            job.ipfsJob,
        );

        if(jobDefinition.logicstics?.receive?.type) {
            const strategySelector = new JobDefinitionStrategySelector()
            const strategy = strategySelector.selectStrategy(jobDefinition.logicstics?.receive?.type)

            this.repository.updateflowState(this.jobId(), {
                status: 'waiting-for-job-defination'
            })

            jobDefinition = await strategy.load(this.jobId())
        }

        return jobDefinition;
    }

    private async resolveResult(id: string): Promise<FlowState> {
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
}
