import { Job, Market, Run, Client as SDK } from "@nosana/sdk";
import { FlowState, JobDefinition } from "../../provider/types.js";
import { FlowHandler } from "../flow/flowHandler.js";
import { Provider } from "../../provider/Provider.js";
import { applyLoggingProxyToClass } from "../../monitoring/proxy/loggingProxy.js";
import { NodeRepository } from "../../repository/NodeRepository.js";
import { JobDefinitionStrategySelector } from "./defination/JobDefinitionStrategy.js";
import { ResultReturnStrategySelector } from "./result/ResultReturnStrategy.js";
import { IValidation } from "typia";
import { validateJobDefinition } from "../../../../providers/Provider.js";
import { JobExternalUtil } from "./jobExternalUtil.js";

export class JobHandler {
    private id: string | undefined;
    private job: Job | undefined;

    private flowHandler: FlowHandler;
    private jobExternalUtil: JobExternalUtil;

    constructor(
        private sdk: SDK,
        private provider: Provider,
        private repository: NodeRepository,
    ){
        this.flowHandler = new FlowHandler(this.provider, repository);
        this.jobExternalUtil = new JobExternalUtil(sdk, this.repository);

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

    async start(job: Job): Promise<boolean> {
        const flow = this.repository.getflow(this.jobId())

        if(!flow){
            this.flowHandler.init(this.jobId())

            let jobDefinition: JobDefinition = await this.jobExternalUtil.resolveJobDefinition(this.jobId(), job)

            if(!await this.jobExternalUtil.validate(this.jobId(), jobDefinition)){
                return false;
            }

            this.flowHandler.start(this.jobId(), jobDefinition)
        } else {
            this.flowHandler.resume(this.jobId())
        }

        return true;
    }

    async run(): Promise<boolean> {
        if(this.repository.getFlowState(this.jobId()).status == 'failed'){
            return false;
        }

        await this.flowHandler.run(this.jobId());

        if(this.repository.getFlowState(this.jobId()).status == 'failed'){
            return false;
        }

        return true;
    }

    async quit(run: Run): Promise<void> {
        await this.sdk.jobs.quit(run);
        await this.flowHandler.stop(this.jobId())
    }

    exposed(): boolean {
        return this.flowHandler.exposed(this.jobId())
    }

    async finish(run: Run): Promise<void> {
        try {
            let result = await this.jobExternalUtil.resolveResult(this.jobId())
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
}
