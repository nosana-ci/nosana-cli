import { Command } from 'commander';
import { Client } from '@nosana/sdk';
import 'rpc-websockets/dist/lib/client.js';

import { clearLine, colors, logTable } from '../../../generic/utils.js';
import { getSDK } from '../../../services/sdk.js';
import { clientSelector } from '../../../api/client.js';

export async function getMarket(
  marketId: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
): Promise<void> {
  const nosana: Client = getSDK();
  let blockchainMarket;
  console.log('retrieving market...');
  const { data: market, error }: any = await clientSelector().GET(
    '/api/markets/{id}/',
    {
      params: { path: { id: marketId } },
    },
  );
  if (error) throw new Error(`Failed to fetch market \n${error.message}`);

  if (market) {
    try {
      blockchainMarket = await nosana.jobs.getMarket(market.address);
      clearLine();
    } catch (e) {
      clearLine();
      console.error(
        `${colors.RED}Could not retrieve market from blockchain\n${colors.RESET}`,
        e,
      );
    }

    console.log(`Name:\t\t\t${colors.GREEN}${market.name}${colors.RESET}`);
    console.log(`Slug:\t\t\t${colors.GREEN}${market.slug}${colors.RESET}`);
    console.log(`Address:\t\t${colors.GREEN}${market.address}${colors.RESET}`);
    console.log(
      `SFT collection:\t\t${colors.GREEN}${market.sft}${colors.RESET}`,
    );
    if (blockchainMarket) {
      console.log(
        `Job price:\t\t${colors.GREEN}${blockchainMarket.jobPrice / 1e6} NOS/s${
          colors.RESET
        }`,
      );
      console.log(
        `Job timeout:\t\t${colors.GREEN}${
          blockchainMarket.jobTimeout / 60
        } minutes${colors.RESET}`,
      );
      console.log(
        `Job expiration:\t\t${colors.GREEN}${
          blockchainMarket.jobExpiration / 3600
        } hours${colors.RESET}`,
      );
      console.log(
        `Queue type:\t\t${colors.GREEN}${
          blockchainMarket.queueType === 1 ? 'Node Queue' : 'Job Queue'
        }${colors.RESET}`,
      );
      console.log(
        `${blockchainMarket.queueType === 1 ? 'Nodes' : 'Jobs'} in queue:\t\t${
          colors.GREEN
        }${blockchainMarket.queue.length}${colors.RESET}`,
      );
    }
    console.log(`GPU Types:`);
    logTable(market.gpu_types);
    console.log(`Required Docker Images:`);
    logTable(market.required_images);
    console.log(`Required Remote Resources`);
    logTable(market.required_remote_resources);
  }
}
