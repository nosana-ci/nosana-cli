import chalk from "chalk";
import { sleep } from "../generic/utils";
import { JobDefinition, Provider, Result } from "./BaseProvider";
import ora from "ora";

export class DockerProvider implements Provider {
  async run(jobDefinition: JobDefinition): Promise<Result> {
    const spinner = ora(chalk.cyan('Running job')).start();
    await sleep(5);
    spinner.stop();
    return {
      status: 'success',
      ops: [
        {
          id: 'test',
          startTime: 0,
          endTime: 10,
          exitCode: 0,
          status: 'success',
          logs: [{
            type: "stdout",
            log: 'line 1'
          },
          {
            type: "stdout",
            log: 'line 2'
          }]
        }
      ]
    }
  }
}