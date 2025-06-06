import ora from 'ora';
import chalk from 'chalk';
import { Command } from 'commander';
import { AuthorizationManager, Client, Job } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';
import 'rpc-websockets/dist/lib/client.js';
import { download } from '../download/action.js';
import { clearLine, colors } from '../../../generic/utils.js';
import { getSDK } from '../../../services/sdk.js';
import {
  waitForJobCompletion,
  waitForJobRunOrCompletion,
} from '../../../services/jobs.js';
import { OUTPUT_EVENTS } from '../../../providers/utils/ouput-formatter/outputEvents.js';
import { outputFormatSelector } from '../../../providers/utils/ouput-formatter/outputFormatSelector.js';
import { createSignature } from '../../../services/api.js';
import { OutputFormatter } from '../../../providers/utils/ouput-formatter/OutputFormatter.js';
import { isPrivate } from '../../../generic/ops-util.js';
import { listenToWebSocketLogs } from '../../../services/websocket.js';
import { configs } from '../../../services/NodeManager/configs/configs.js';
import { OpState } from '../../../services/NodeManager/provider/types.js';

// clear these timeouts
let retryTimeoutId: NodeJS.Timeout | null = null;
let resultRetryTimeoutId: NodeJS.Timeout | null = null;

export async function getJob(
  jobAddress: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
  json_flow?: {
    [key: string]: any;
  },
): Promise<void> {
  const config = configs();
  const nosana: Client = getSDK();
  const formatter = outputFormatSelector(options.format);

  const headers = await createSignature();

  let ws;

  let job;
  console.log('retrieving job...');
  try {
    job = await nosana.jobs.get(jobAddress);
    clearLine();
  } catch (e) {
    clearLine();
    formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_NOT_FOUND, { error: e as Error });
  }

  if (job) {
    formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_URL, {
      job_url: `${config.explorerUrl}/jobs/${jobAddress}`,
    });

    formatter.output(OUTPUT_EVENTS.OUTPUT_JSON_FLOW_URL, {
      json_flow_url: `${nosana.ipfs.config.gateway}${job.ipfsJob}`,
    });
    formatter.output(OUTPUT_EVENTS.OUTPUT_MARKET_URL, {
      market_url: `${config.explorerUrl}/markets/${job.market}`,
    });

    formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_PRICE, {
      price: `${job.price / 1e6}`,
    });
    formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_STATUS, {
      status: `${job.state}`,
    });

    if (
      (options.wait || options.download) &&
      job.state !== 'COMPLETED' &&
      job.state !== 'STOPPED'
    ) {
      const spinner = ora(chalk.cyan(`Waiting for job to complete`)).start();
      job = await waitForJobRunOrCompletion(new PublicKey(jobAddress));
      spinner.succeed();
      clearLine();

      if (job.state === 'RUNNING') {
        clearLine();

        formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_STATUS, {
          status: job.state,
        });

        formatter.output(OUTPUT_EVENTS.OUTPUT_NODE_URL, {
          url: `${config.explorerUrl}/host/${job.node}`,
        });

        const ipfsJob = await nosana.ipfs.retrieve(job.ipfsJob);

        // handle job logs the new way using websockets

        if (isPrivate(ipfsJob)) {
          await fetchServiceURLWithRetry(job, jobAddress, formatter, headers);
        }

        if (options.private) {
          getJobResultUntilSuccess({
            job,
            jobAddress,
            options,
            config,
          });
        }

        ws = listenToWebSocketLogs(
          `https://${job.node}.${configs(options).frp.serverAddr}`,
          jobAddress,
        );

        job = await waitForJobCompletion(new PublicKey(jobAddress));
      }
    }

    if (job.state === 'COMPLETED' || job.state === 'STOPPED') {
      formatter.output(OUTPUT_EVENTS.OUTPUT_NODE_URL, {
        url: `${config.explorerUrl}/host/${job.node}`,
      });

      if (job.timeStart) {
        formatter.output(OUTPUT_EVENTS.OUTPUT_START_TIME, {
          date: new Date(job.timeStart * 1000),
        });
      }

      if (job.timeEnd) {
        formatter.output(OUTPUT_EVENTS.OUTPUT_DURATION, {
          duration: job.timeEnd - job.timeStart,
        });
        formatter.output(OUTPUT_EVENTS.OUTPUT_TOTAL_COST, {
          cost: ((job.timeEnd - job.timeStart) * job.price) / 1e6,
        });
      }

      formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_STATUS, { status: job.state });
    }

    if (job.state === 'COMPLETED') {
      formatter.output(OUTPUT_EVENTS.OUTPUT_RESULT_URL, {
        url: `${nosana.ipfs.config.gateway}${job.ipfsResult}`,
      });

      const ipfsResult = await nosana.ipfs.retrieve(job.ipfsResult);

      const result = ipfsResult.results;
      if (ipfsResult.opStates) {
        // New result format
        for (let i = 0; i < ipfsResult.opStates.length; i++) {
          const opState: OpState = ipfsResult.opStates[i];
          formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_EXECUTION, { opState });
        }
      } else if (result) {
        const jsonFlow = await nosana.ipfs.retrieve(job.ipfsJob);
        let commands = [];

        if (jsonFlow.ops) {
          commands = jsonFlow.ops.map((j: any) => j.name || j.id);
          const type = jsonFlow.state && jsonFlow.state['nosana/job-type'];
          switch (type) {
            case 'Github':
            case 'github-flow':
              if (!commands.includes('checkout')) commands.unshift('checkout');
              break;
            case 'gitlab':
              break;
          }
        }

        for (let i = 0; i < commands.length; i++) {
          const command = commands[i];
          if (result[command] && !command.endsWith('-volume')) {
            console.log(
              `${colors.GREEN}- Executed step ${command}${colors.RESET}`,
            );
            // const commandStatus = result[command][0];
            const steps = result[command][1];
            if (Array.isArray(steps)) {
              for (let j = 0; j < steps.length; j++) {
                const step = steps[j];
                if (step.cmd) {
                  if (step.cmd.cmd) {
                    if (!step.cmd.cmd.startsWith('sh -c')) {
                      console.log(
                        `${colors.CYAN}$ ${step.cmd.cmd}${colors.RESET}`,
                      );
                    }
                  } else {
                    console.log(`${colors.CYAN}$ ${step.cmd}${colors.RESET}`);
                  }
                }
                if (step.log && Array.isArray(step.log)) {
                  let logString = '';
                  for (let k = 0; k < step.log.length; k++) {
                    const log = step.log[k];
                    const color = log[0] === 2 && step.status ? colors.RED : '';
                    logString += `${color}${log[1]}${colors.RESET}`;
                  }
                  console.log(logString);
                }
                if (step.error) {
                  console.log(`${colors.RED}${step.error}${colors.RESET}`);
                }
                if (step.status) {
                  console.log(
                    `${colors.RED}Exited with code ${step.status}${colors.RESET}`,
                  );
                }
              }
            } else {
              console.log(`${colors.RED}${steps}${colors.RESET}`);
            }
          }
        }

        const artifactId = jsonFlow.ops[jsonFlow.ops.length - 1].id;
        if (artifactId.startsWith('artifact-')) {
          if (result[artifactId]) {
            const steps = result[artifactId][1];
            if (Array.isArray(steps)) {
              const logs = steps[steps.length - 1].log;
              if (logs && logs[logs.length - 2]) {
                const ipfshash = logs[logs.length - 2][1].slice(-47, -1);
                if (options.download) {
                  await download(
                    ipfshash,
                    options.download,
                    options,
                    undefined,
                    nosana,
                  );
                } else {
                  console.log(
                    `${colors.YELLOW}This job has external artifacts that can be downloaded with:${colors.RESET}`,
                  );
                  console.log(
                    `${colors.CYAN}nosana download ${ipfshash}${colors.RESET}`,
                  );
                }
              }
            }
          }
        }
      } else {
        formatter.output(OUTPUT_EVENTS.OUTPUT_CANNOT_LOG_RESULT, null);
      }
    }
  }

  if (ws) {
    ws.close();
  }
}

async function fetchServiceURLWithRetry(
  job: Job,
  jobAddress: string,
  formatter: OutputFormatter,
  headers: any,
): Promise<void> {
  const retryInterval = 5000; // 5 seconds

  const intervalId = setInterval(async () => {
    try {
      const response = await fetch(
        `https://${job.node}.${
          configs().frp.serverAddr
        }/service/url/${jobAddress}`,
        { method: 'GET', headers },
      );

      if (response.status === 200) {
        const url = await response.text();
        if (url) {
          formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_SERVICE_URL, { url });
          clearInterval(intervalId);
        }
      } else if (response.status === 400) {
        throw new Error('URL not ready yet');
      } else {
        formatter.output(OUTPUT_EVENTS.OUTPUT_JOB_SERVICE_URL, {
          url: 'No exposed URL for job id',
        });
        clearInterval(intervalId);
      }
    } catch (error) {
      // The interval will continue, no need to manually retry here
    }
  }, retryInterval);
}

function getJobResultUntilSuccess({
  job,
  jobAddress,
  options,
  config,
}: {
  job: any;
  jobAddress: string;
  options: any;
  config: any;
}) {
  const nosana: Client = getSDK();

  const headers = nosana.authorization.generateHeader(job.ipfsJob, {
    includeTime: true,
  });
  headers.append('Content-Type', 'application/json');

  const url = `https://${job.node}.${
    options.network === 'devnet' ? 'node.k8s.dev.nos.ci' : config.frp.serverAddr
  }/job-result/${jobAddress}`;

  async function attemptFetch() {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        console.log('✅ Job result fetched successfully.');
        resultRetryTimeoutId = null;

        const resultData = await res.json();
        console.log(resultData);
        return;
      } else {
      }
    } catch (err: any) {}

    resultRetryTimeoutId = setTimeout(attemptFetch, 15000);
  }

  attemptFetch();
}
