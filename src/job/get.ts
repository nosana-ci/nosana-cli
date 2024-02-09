import { Command } from 'commander';
import { Client, Job } from '@nosana/sdk';
import { getSDK } from '../utils/sdk.js';
import { colors, clearLine } from '../utils/terminal.js';
import { download } from './download.js';
import { ClientSubscriptionId, PublicKey } from '@solana/web3.js';

export async function getJob(
  jobAddress: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
  nosana?: Client,
) {
  if (!nosana) {
    nosana = getSDK();
  }
  let job;
  console.log('retrieving job...');
  try {
    job = await nosana.jobs.get(jobAddress);
    clearLine();
  } catch (e) {
    clearLine();
    console.error(`${colors.RED}Could not retrieve job\n${colors.RESET}`, e);
  }

  if (job) {
    console.log(
      `Job:\t\t${colors.BLUE
      }https://explorer.nosana.io/jobs/${jobAddress}${nosana.solana.config.network.includes('devnet')
        ? '?network=devnet'
        : ''
      }${colors.RESET}`,
    );
    console.log(
      `JSON flow:\t${colors.BLUE}${nosana.ipfs.config.gateway}${job.ipfsJob}${colors.RESET}`,
    );
    console.log(
      `Market:\t\t${colors.BLUE}https://explorer.nosana.io/markets/${job.market
      }${nosana.solana.config.network.includes('devnet')
        ? '?network=devnet'
        : ''
      }${colors.RESET}`,
    );
    console.log(
      `Price:\t\t${colors.CYAN}${job.price / 1e6} NOS/s${colors.RESET}`,
    );

    if (
      ((options.wait || options.download) &&
        job.state !== 'COMPLETED' &&
        job.state !== 'STOPPED')
    ) {
      console.log(
        `Status:\t\t${job.state === 'COMPLETED' ? colors.GREEN : colors.CYAN}${job.state}${colors.RESET}`,
      );
      await nosana.jobs.loadNosanaJobs();

      const waitTillComplete = (address: PublicKey, nosana: Client): Promise<Job> => {
        return new Promise((resolve, reject) => {
          const subscriptionId: ClientSubscriptionId = nosana.jobs.connection!.onAccountChange(
            address,
            (accountInfo) => {
              const jobAccount = nosana.jobs.jobs!.coder.accounts.decode(nosana.jobs.jobs!.account.jobAccount.idlAccount.name, accountInfo.data);
              if (jobAccount.state >= 2) {
                nosana.jobs.connection!.removeProgramAccountChangeListener(subscriptionId);
                resolve(jobAccount);
              }
            }, 'confirmed'
          );
        });
      }
      await waitTillComplete(new PublicKey(jobAddress), nosana);
      job = await nosana.jobs.get(jobAddress);
      clearLine();
    }




    if (
      job.state === 'COMPLETED' ||
      job.state === 'STOPPED'
    ) {

      console.log(
        `Node:\t\t${colors.BLUE}https://explorer.nosana.io/nodes/${job.node
        }${nosana.solana.config.network.includes('devnet')
          ? '?network=devnet'
          : ''
        }${colors.RESET}`,
      );


      if (job.timeStart) {
        console.log(
          `Start Time:\t${colors.CYAN}${new Date(job.timeStart * 1000)}${colors.RESET
          }`,
        );
      }
      if (job.timeEnd) {
        console.log(
          `Duration:\t${colors.CYAN}${job.timeEnd - job.timeStart} seconds${colors.RESET}`,
        );
        console.log(
          `Total Costs:\t${colors.CYAN}${((job.timeEnd - job.timeStart) * job.price) / 1e6} NOS${colors.RESET}`,
        );
      }
      console.log(
        `Status:\t\t${job.state === 'COMPLETED' ? colors.GREEN : colors.CYAN}${job.state}${colors.RESET}`,
      );
    }

    if (job.state === 'COMPLETED') {
      console.log(
        `Result:\t\t${colors.BLUE}${nosana.ipfs.config.gateway}${job.ipfsResult}${colors.RESET}`,
      );

      const ipfsResult = await nosana.ipfs.retrieve(job.ipfsResult);

      console.log('Logs:');
      const result = ipfsResult?.results;
      if (result) {
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
        console.log(`${colors.RED}Cannot log results${colors.RESET}`);
      }
    }
  }
  return job;
}
