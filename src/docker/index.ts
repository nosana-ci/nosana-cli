import { Presets, MultiBar, SingleBar } from 'cli-progress';
import Dockerode from 'dockerode';

import { repoTagsContainsImage } from './utils/repoTagsContainsImage.js';
import { convertFromBytes } from '../providers/modules/resourceManager/volumes/helpers/convertFromBytes.js';
import { MultiProgressBarReporter } from '../services/NodeManager/node/utils/multiProgressBarReporter.js';
import { createLoggingProxy } from '../services/NodeManager/monitoring/proxy/loggingProxy.js';

export class DockerExtended extends Dockerode {
  async promisePull(image: string) {
    const multiProgressBarReporter = createLoggingProxy(
      new MultiProgressBarReporter(),
    );

    return await new Promise((resolve, reject): any =>
      this.pull(image, (err: any, stream: any) => {
        if (err) {
          reject(err);
        }

        // const layerIds = new Map<string, SingleBar>();

        // const multibar = new MultiBar(
        //   {
        //     clearOnComplete: false,
        //     hideCursor: true,
        //     format:
        //       '{status} | {bar} | {layerId} | {value}{format}/{total}{format}',
        //   },
        //   Presets.shades_grey,
        // );

        multiProgressBarReporter.start(`pulling image ${image}`, {
          format:
            '{status} | {bar} | {layerId} | {value}{format}/{total}{format}',
        });

        const onProgress = (event: {
          status: 'Pulling fs layer' | 'Downloading' | 'Download complete';
          progressDetail: { current: number; total: number };
          id: string;
        }) => {
          multiProgressBarReporter.update(event);

          // const { id, status, progressDetail } = event;

          // if (status === 'Pulling fs layer') return;

          // let progressBar = layerIds.get(id);

          // if (status === 'Downloading') {
          //   const { current, total } = progressDetail;

          //   const { value } = convertFromBytes(current);
          //   const { format, value: totalValue } = convertFromBytes(total);
          //   if (!progressBar) {
          //     progressBar = multibar.create(totalValue, value, {
          //       status,
          //       layerId: id,
          //       format,
          //     });
          //     layerIds.set(id, progressBar);
          //   }
          //   progressBar.update(value, { status });
          //   return;
          // }

          // if (progressBar) {
          //   progressBar.update(progressBar.getTotal(), { status });
          // }
        };

        const onFinished = (err: any, _: any) => {
          multiProgressBarReporter.stop(`done pulling image ${image}`);
          if (!err) {
            resolve(true);
            return;
          }
          reject(err);
        };

        this.modem.followProgress(
          stream,
          (err: any, output: any) => onFinished(err, output),
          onProgress,
        );
      }),
    );
  }

  async hasImage(image: string): Promise<boolean> {
    const savedImages = await this.listImages();

    return savedImages.some(({ RepoTags }) =>
      repoTagsContainsImage(image, RepoTags),
    );
  }
}
