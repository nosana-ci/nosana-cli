import { Presets } from 'cli-progress';
import {
  OperationArgsMap,
  RequiredResource,
  Resource,
  S3Secure,
} from '../../../provider/types.js';
import {
  createS3HelperOpts,
  nosanaBucket,
} from '../../../../../providers/modules/resourceManager/volumes/definition/s3HelperOpts.js';
import { convertFromBytes } from '../../../../../providers/modules/resourceManager/volumes/helpers/convertFromBytes.js';
import { extractLogsAndResultsFromLogBuffer } from '../../../../../providers/utils/extractLogsAndResultsFromLogBuffer.js';
import { applyLoggingProxyToClass } from '../../../monitoring/proxy/loggingProxy.js';
import { ContainerOrchestrationInterface } from '../../../provider/containerOrchestration/interface';
import { NodeRepository } from '../../../repository/NodeRepository.js';
import { ProgressBarReporter } from '../../utils/progressBarReporter.js';
import { createResourceName } from '../helpers/createResourceName.js';
import { hasDockerVolume } from '../helpers/hasDockerVolume.js';
import { hoursSinceDate } from '../helpers/hoursSunceDate.js';

export class VolumeManager {
  private fetched: boolean = false;
  private market_required_volumes: RequiredResource[] = [];
  private progressBarReporter: ProgressBarReporter;

  constructor(
    private containerOrchestration: ContainerOrchestrationInterface,
    private repository: NodeRepository,
  ) {
    this.progressBarReporter = new ProgressBarReporter();

    applyLoggingProxyToClass(this);
  }

  public async pullMarketRequiredVolumes(
    remoteResources: RequiredResource[],
  ): Promise<void> {
    this.fetched = true;
    this.market_required_volumes = remoteResources;

    const savedVolumes = this.repository.getVolumesResources();
    for (const resource of this.market_required_volumes) {
      if (!savedVolumes[createResourceName(resource)]) {
        await this.createRemoteVolume(resource);
      }
    }
  }

  public async createRemoteVolume(resource: RequiredResource): Promise<string> {
    const resourceName = createResourceName(resource);
    const savedResource = this.repository.getVolumeResource(
      createResourceName(resource),
    )?.volume;

    if (savedResource) {
      this.setVolume(resourceName, savedResource);
      return savedResource;
    }

    try {
      let volumeName: string;
      const response = await this.containerOrchestration.createVolume();

      if (response.error || !response.result) {
        throw response.error;
      }

      // @ts-ignore **PODMAN returns name not Name**
      if (response.result.name) {
        // @ts-ignore **PODMAN returns name not Name**
        volumeName = response.result.name;
      } else {
        volumeName = response.result.Name;
      }

      if (resource.url) {
        await this.runResourceManagerContainer(volumeName, {
          url: resource.url,
          files: resource.files,
        });
      } else {
        for (const bucket of resource.buckets!) {
          await this.runResourceManagerContainer(volumeName, bucket);
        }
      }

      this.setVolume(resourceName, volumeName);

      return volumeName;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  private async runResourceManagerContainer(
    name: string,
    resource: {
      url: string;
      files?: string[];
    },
  ): Promise<void> {
    const { url, files } = resource;

    const args = createS3HelperOpts(
      name,
      { url, files },
      (resource as S3Secure).IAM,
    );
    const response = await this.containerOrchestration.runContainer(args);

    if (response.error || !response.result) {
      throw Error(`container failed to start, ${response.error}`);
    }

    const controller = new AbortController();

    const container = response.result;

    const logStream = await container.logs({
      stdout: true,
      stderr: false,
      follow: true,
      abortSignal: controller.signal,
    });

    let start = false;
    let formatSize: 'gb' | 'mb' | 'kb' = 'kb';

    logStream.on('data', (logBuffer) => {
      try {
        const logString: string = logBuffer.toString('utf8');
        const logJSON = JSON.parse(logString.slice(8, logString.length - 1));

        if (!start && logJSON.event === 'status') {
          start = true;
          const { value, format } = convertFromBytes(logJSON.size.total);
          formatSize = format;

          this.progressBarReporter.start(
            `downloading resource volume resource ${name}`,
            {
              format: `{bar} {percentage}% | {value}/{total}${format} | {valueFiles}/{totalFiles} files`,
            },
            value,
            0,
            {
              valueFiles: 0,
              totalFiles: logJSON.count.total,
            },
            Presets.shades_classic,
          );
        } else if (logJSON.event === 'status') {
          const { value } = convertFromBytes(logJSON.size.current, formatSize);

          this.progressBarReporter.update(value, {
            valueFiles: logJSON.count.current,
          });
        }
      } catch (error) {}
    });

    const { StatusCode } = await container.wait({ condition: 'not-running' });
    controller.abort();

    // If download failed, remove volume
    if (StatusCode !== 0) {
      this.progressBarReporter.stop(
        `downloading resource volume resource ${name} stopped`,
      );
      const errrorBuffer = await container.logs({
        follow: false,
        stdout: false,
        stderr: true,
      });

      const { logs } = extractLogsAndResultsFromLogBuffer(
        errrorBuffer,
        undefined,
      );

      await container.remove({ force: true });

      await this.containerOrchestration.deleteVolume(name);

      const lastLog = logs[logs.length - 1].log?.replaceAll('\n', '');
      const jsonLog = lastLog
        ? JSON.parse(lastLog)
        : { message: 'Unkown Error' };
      throw new Error(jsonLog.message);
    }

    this.progressBarReporter.stop(
      `downloading resource volume resource ${name} completed`,
    );

    await this.containerOrchestration.stopAndDeleteContainer(container.id);
  }

  public async setVolume(bucket: string, volume: string): Promise<void> {
    const volumeObj = this.repository.getVolumeResource(bucket);
    this.repository.updateVolumeResource(bucket, {
      volume,
      required: this.market_required_volumes.some(
        (vol) => createResourceName(vol) === bucket,
      ),
      lastUsed: new Date(),
      usage: volumeObj?.usage + 1 || 1,
    });
  }

  public async hasVolume(resource: Resource): Promise<boolean> {
    const volume = this.repository.getVolumeResource(
      createResourceName(resource),
    )?.volume;
    if (!volume) {
      return false;
    }

    const dockerHasVolume = await this.containerOrchestration.hasVolume(volume);

    if (!dockerHasVolume) {
      this.repository.deleteVolumeResource(createResourceName(resource));
    }

    return dockerHasVolume;
  }

  public async getVolume(
    resource: RequiredResource | Resource,
  ): Promise<string> {
    return this.repository.getVolumeResource(createResourceName(resource))
      ?.volume;
  }

  public async pruneVolumes(): Promise<void> {
    const cachedVolumes = await this.containerOrchestration.listVolumes();
    const dbVolume = Object.entries(this.repository.getVolumesResources());

    for (const { Name } of cachedVolumes) {
      const dbEntry = dbVolume.find((vol) => vol[1].volume === Name);

      if (dbEntry && dbEntry[1].required) continue;

      await this.containerOrchestration.deleteVolume(Name);

      if (dbEntry) {
        this.repository.deleteVolumeResource(dbEntry[0]);
      }
    }
  }

  public async resyncResourcesDB(): Promise<void> {
    const savedVolumes = await this.containerOrchestration.listVolumes();

    for (const [resource, value] of Object.entries(
      this.repository.getVolumesResources(),
    )) {
      // RENAME NOSANA S3 BUCKETS TO CLOUDFRONT
      if (resource.includes('s3://nos-ai-models-qllsn32u')) {
        this.repository.updateVolumeResource(
          `${resource.replace('s3://nos-ai-models-qllsn32u', nosanaBucket)}`,
          value,
        );
        this.repository.deleteVolumeResource(resource);
      }
    }

    for (const [resource, { volume, lastUsed, required }] of Object.entries(
      this.repository.getVolumesResources(),
    )) {
      if (!hasDockerVolume(volume, savedVolumes)) {
        this.repository.deleteVolumeResource(resource);
        continue;
      }

      if (
        (!this.fetched && required) ||
        this.market_required_volumes.some(
          (vol) => createResourceName(vol) === resource,
        )
      ) {
        continue;
      }

      const hoursSinceLastUsed = hoursSinceDate(new Date(lastUsed));

      if (hoursSinceLastUsed > 24) {
        try {
          await this.containerOrchestration.deleteVolume(volume);
          this.repository.deleteVolumeResource(volume);
        } catch (err) {
          const message = (err as { json: { message: string } }).json.message;
        }
      }
    }
  }
}
