import chalk from "chalk";
import { sleep } from "../generic/utils";
import { JobDefinition, Provider, Result } from "./BaseProvider";
import ora from "ora";
const Docker = require('dockerode');

export class DockerProvider implements Provider {
  docker: typeof Docker;
  constructor () {
    this.docker = new Docker();
  }
  async run(jobDefinition: JobDefinition): Promise<Result> {
    const spinner = ora(chalk.cyan('Running job')).start();

    try {
      await new Promise((resolve, reject) => {
        this.docker.pull(jobDefinition.ops[0].args?.image, (err:any, stream:any) => {
          if (err) {
            return reject(err);
          }
          this.docker.modem.followProgress(stream, (err: any, res: any) =>
            err ? reject(err) : resolve(res),
          );
        });
      });
      console.log('pulled image');
  
      const name = jobDefinition.ops[0].args?.image + '-' + (Math.random() + 1).toString(36).substring(7);
      const container = await this.docker.createContainer({
        Image: jobDefinition.ops[0].args?.image,
        name,
        AttachStderr: true,
        AttachStdin: true,
        AttachStdout: true,
        OpenStdin: true,
        StdinOnce: true,
        Tty: false,
      });
      console.log('created: ', name)
  
      console.log('start attach stream');
      const stream = await container.attach({
        hijack: true,
        stderr: true,
        stdin: true,
        stdout: true,
        stream: true,
      });
      console.log('finish attach stream');
  
      // Create a promise that resolves to the container's stdout
      const stdout = new Promise((resolve) => {
        stream.on('data', (data: any) => {
          const response = data && data.slice(8).toString();
          resolve(response);
        });
      });
  
      // Start the container
      await container.start();
      const output = await this.runCommandInContainer(container, ['/bin/bash', '-c', 'echo Hello World from exec']);
      console.log('output', output);
  
      // const allContainerInfos = await docker.listContainers();
      // console.log('allContainerInfos', allContainerInfos);
      stream.end();
      await container.wait();
      container.remove();
      
      const result = await stdout;
      console.log('result', result);
    } catch (error) {
      console.log(error);
    }

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

  async healthy(): Promise<Boolean> {
    // implement
    return true
  }

  async runCommandInContainer(container: any, command: string[]): Promise<string> {
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ hijack: true, stdin: true });
    let output = "";
    output = await this.readStream(stream);
    await this.waitForStreamEnd(stream);
    return output;
  }  
  async readStream(stream: any) {
    let output: string = "";
    return new Promise<string>((resolve, reject) => {
      stream.on("data", (chunk: string) => {
        output += chunk;
      });
  
      stream.on("end", () => {
        resolve(output.trim().split("\n").map(processString).join("\n"));
      });
    });
    
    function processString(str: string): string {
      const out = Buffer.from(str, "binary");
      if (out.readUInt8(0) === 1) {
        return out.toString("utf8", 8);
      } else {
        return out.toString("utf8", 0);
      }
    }
  };
  async waitForStreamEnd(stream: NodeJS.ReadableStream): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        stream.on('end', async () => {
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}