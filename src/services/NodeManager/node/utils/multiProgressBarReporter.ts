import { Options, Preset } from 'cli-progress';

export class MultiProgressBarReporter {
  private running: boolean = false;
  private current: {
    optProgressBar: Options | null;
  } = {
    optProgressBar: null,
  };

  start(
    name: string,
    optProgressBar: Options,
  ): void {
    this.current = {
      optProgressBar,
    };
    this.running = true;
  }

  update(event: {
    status: 'Pulling fs layer' | 'Downloading' | 'Download complete';
    progressDetail: { current: number; total: number };
    id: string;
  }): void {}

   stop(name: string): string {
    this.running = false;
    return name;
  }

  async completed(): Promise<void> {
    this.running = false;
  }
}
