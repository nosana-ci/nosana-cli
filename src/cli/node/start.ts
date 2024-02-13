import { Command } from 'commander';

export async function startNode(
  market: string,
  options: {
    [key: string]: any;
  },
  cmd: Command | undefined,
) {
  console.log(market)
}