import { Command } from 'commander';
import { Client } from '../';
import { getSDK } from './index.js';
import zlib from 'zlib';
import tar from 'tar';
import { Readable } from 'stream';
import fs from 'fs';
import { colors } from './terminal';

export async function download(
  ipfshash: string,
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
  const outputFolder = 'output-' + ipfshash;
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
  }
  readable.pipe(tar.extract({ cwd: outputFolder }));
  console.log(
    `\n${colors.GREEN}Output written to ${outputFolder}${colors.RESET}`,
  );
}
