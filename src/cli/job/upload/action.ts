import fs from 'node:fs';
import { Client } from '@nosana/sdk';

import { colors } from '../../../generic/utils.js';
import { getSDK } from '../../../services/sdk.js';

export async function upload(
  file: string,
  options: {
    [key: string]: any;
  },
) {
  const stat = await fs.promises.stat(file);
  console.log();

  const nosana: Client = getSDK();
  const files: Array<string> = [];
  if (stat.isDirectory()) {
    const items = fs.readdirSync(file);
    for (let i = 0; i < items.length; i++) {
      const s = await fs.promises.stat(file + '/' + items[i]);
      if (!s.isDirectory()) {
        files.push(file + '/' + items[i]);
      }
    }
  } else {
    files.push(file);
  }
  for (let i = 0; i < files.length; i++) {
    const url =
      nosana.ipfs.config.gateway + (await nosana.ipfs.pinFile(files[i]));
    console.log(
      `file ${files[i]} uploaded:\t${colors.BLUE}${url}${colors.RESET}`,
    );
  }
}
