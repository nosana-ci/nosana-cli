import { Client, Run } from "@nosana/sdk";
import { getSDK } from "../utils/sdk";

export const getRun = async (node: string): Promise<Run | void> => {
  const nosana: Client = getSDK();
  const runs = await nosana.jobs.getRuns([
    {
      memcmp: {
        offset: 40,
        bytes: node,
      },
    },
  ]);
  if (runs && runs.length > 0) {
    return runs[0].account;
  }
}