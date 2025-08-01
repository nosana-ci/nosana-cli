import { FlowState, Job, Run, Client as SDK } from '@nosana/sdk';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { JobExternalUtil } from './jobExternalUtil.js';

export class JobRegistry {
    private static instance: JobRegistry;
    private registry = new Map<string, Job>();
    private runs = new Map<string, Run>();

    private constructor() { }

    public static getInstance(): JobRegistry {
        if (!JobRegistry.instance) {
            JobRegistry.instance = new JobRegistry();
        }
        return JobRegistry.instance;
    }

    public register(jobId: string, run: Run, job: Job) {
        this.registry.set(jobId, job);
        this.runs.set(jobId, run);
    }

    public get(jobId: string): Job | undefined {
        return this.registry.get(jobId);
    }

    public remove(jobId: string) {
        this.registry.delete(jobId);
        this.runs.delete(jobId);
    }

    public has(jobId: string): boolean {
        return this.registry.has(jobId);
    }

    public async stop(sdk: SDK, repository: NodeRepository): Promise<void> {
        const stopPromises: Promise<void>[] = [];

        for (const [jobId, job] of this.registry.entries()) {
            const promise = (async () => {
                const jobExternalUtil = new JobExternalUtil(sdk, repository);
                const result = await jobExternalUtil.resolveResult(jobId, job);

                const ipfsResult = await sdk.ipfs.pin(result as object);
                const bytesArray = sdk.ipfs.IpfsHashToByteArray(ipfsResult);

                await sdk.jobs.submitResult(
                    bytesArray,
                    this.runs.get(jobId) as Run,
                    job.market
                );

                this.runs.delete(jobId);
                this.registry.delete(jobId);
            })();

            stopPromises.push(promise);
        }

        try {
            await Promise.all(stopPromises);
        } catch (error) {
            console.log(error)
        }
    }
}