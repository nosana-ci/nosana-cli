import fs from 'fs';
import tar from 'tar';
import zlib from 'zlib';
import { Readable } from 'stream';
import { Command } from 'commander';
import { Client } from '@nosana/sdk';

import { getSDK } from '../../../services/sdk.js';
import { colors } from '../../../generic/utils.js';

export async function download(
  ipfshash: string,
  path: string | boolean | undefined,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
  nosana?: Client,
) {
  if (!nosana) {
    nosana = getSDK();
  }
  const data = await nosana.ipfs.retrieve(ipfshash, {
    responseType: 'arraybuffer',
  });

  const output = zlib.gunzipSync(data);
  const readable = new Readable();
  readable.push(output);
  readable.push(null);
  const outputFolder = typeof path === 'string' ? path : 'output-' + ipfshash;
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
  }
  readable.pipe(tar.extract({ cwd: outputFolder }));
  console.log(
    `\n${colors.GREEN}Output written to ${outputFolder}${colors.RESET}`,
  );
}
