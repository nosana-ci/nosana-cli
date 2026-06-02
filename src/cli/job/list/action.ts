import { Command } from 'commander';
import { Client } from '@nosana/sdk';
import { Table } from 'console-table-printer';
import { getSDK } from '../../../services/sdk.js';
import { configs } from '../../../services/NodeManager/configs/configs.js';

type JobState = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'STOPPED';

export interface ListJobsOptions {
  limit?: number;
  offset?: number;
  state?: JobState;
  market?: string;
  node?: string;
  poster?: string;
  payer?: string;
  timeStart?: number;
  timeEnd?: number;
  groupBy?: 'project' | 'market';
  timeSeriesInterval?: 'day' | 'week' | 'month';
  useMultiplier?: boolean;
  skipCache?: boolean;
  network?: string;
  format?: string;
  [key: string]: any;
}

export async function listJobs(
  options: ListJobsOptions,
  cmd: Command | undefined,
): Promise<void> {
  const nosana: Client = getSDK();

  const walletAddress = nosana.solana.wallet.publicKey.toString();

  const poster = options.poster ?? walletAddress;

  const config = configs(options);
  const params = new URLSearchParams();

  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined)
    params.set('offset', String(options.offset));
  if (options.state) params.set('state', options.state);
  if (options.market) params.set('market', options.market);
  if (options.node) params.set('node', options.node);
  if (options.payer) params.set('payer', options.payer);
  if (options.timeStart !== undefined)
    params.set('timeStart', String(options.timeStart));
  if (options.timeEnd !== undefined)
    params.set('timeEnd', String(options.timeEnd));
  if (options.groupBy) params.set('groupBy', options.groupBy);
  if (options.timeSeriesInterval)
    params.set('timeSeriesInterval', options.timeSeriesInterval);
  if (options.useMultiplier !== undefined)
    params.set('useMultiplier', String(options.useMultiplier));
  if (options.skipCache !== undefined)
    params.set('skipCache', String(options.skipCache));
  params.set('poster', poster);

  const url = `${config.indexerUrl}/jobs/?${params.toString()}`;

  let jobs: any[];
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Request failed with status ${response.status}: ${response.statusText}`,
      );
    }
    const data = await response.json();
    if (
      !data ||
      typeof data !== 'object' ||
      (!Array.isArray(data) && !Array.isArray(data.jobs))
    ) {
      throw new Error(
        'Invalid response format: expected an array of jobs or an object with a jobs array',
      );
    }
    jobs = data.jobs;
  } catch (e) {
    console.error(`Failed to retrieve jobs: ${(e as Error).message}`);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    if (options.format === 'json') {
      console.log(JSON.stringify([]));
    } else {
      console.log('No jobs found.');
    }
    return;
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(jobs, null, 2));
    return;
  }

  const table = new Table({
    columns: [
      { name: 'address', title: 'ADDRESS' },
      { name: 'state', title: 'STATE' },
      { name: 'market', title: 'MARKET' },
      { name: 'time', title: 'TIME' },
    ],
  });

  for (const job of jobs) {
    const state: string =
      typeof job.state === 'number' ? stateFromNumber(job.state) : job.state;

    const rowColor = 'white';

    const time = job.timeStart
      ? new Date(job.timeStart * 1000).toLocaleString()
      : '-';

    table.addRow(
      { address: job.address ?? '-', state, market: job.market ?? '-', time },
      { color: rowColor },
    );
  }

  table.printTable();
}

function stateFromNumber(state: number): string {
  const states: Record<number, string> = {
    0: 'QUEUED',
    1: 'RUNNING',
    2: 'COMPLETED',
    3: 'STOPPED',
  };
  return states[state] ?? String(state);
}
