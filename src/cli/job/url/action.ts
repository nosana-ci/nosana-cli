import { Command } from "commander";
import { OUTPUT_EVENTS } from "../../../providers/utils/ouput-formatter/outputEvents.js";
import { outputFormatSelector } from "../../../providers/utils/ouput-formatter/outputFormatSelector.js";
import { getSDK } from "../../../services/sdk.js";
import { Client } from '@nosana/sdk';
import { PublicKey } from "@solana/web3.js";
import chalk from "chalk";
import ora from "ora";
import { clearLine, colors } from '../../../generic/utils.js';
import { waitForJobRunOrCompletion } from "../../../services/jobs.js";
import { config } from "../../../generic/config.js";
import { createSignature } from "../../../services/api.js";

export async function getURL(
    jobAddress: string,
    options: {
      [key: string]: any;
    },
    cmd: Command | undefined,
  ): Promise<void> {
    const nosana: Client = getSDK();
    const formatter = outputFormatSelector(options.format);

    let job;
    try {
      job = await nosana.jobs.get(jobAddress);
    } catch (e) {
      formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_NOT_FOUND, { error: e as Error });
    }

    if (job) {
        if(job.state === 'STOPPED' || job.state === 'COMPLETED'){
         console.log(`Job Exposed URL is expired since Job has been ${job.state}`);
         return;  
        }
        if(!options.wait && job.state === 'QUEUED'){
         console.log('Job Exposed URL is not ready yet')
         return;
        }
        if (
            options.wait
          ) {
            const spinner = ora(chalk.cyan(`Waiting for job to complete`)).start();
            job = await waitForJobRunOrCompletion(new PublicKey(jobAddress));
            spinner.succeed();
            clearLine();

            if (job.state === 'RUNNING') {
                const headers = await createSignature();
                const response = await fetch(
                    `https://${job.node}.${config.frp.serverAddr}/service/url/${jobAddress}`,
                    {
                      method: 'POST',
                      headers: {...headers},
                    },
                  );
                  const nodeResponse = await response.text();
                  if (!nodeResponse) {
                    throw new Error(nodeResponse);
                  }
                  
                console.log('This is the url', nodeResponse)
                return;
            }

            console.log(`Job Exposed URL is expired since Job has been ${job.state}`);
        }
    }
    console.log('Invalid Job')
}  