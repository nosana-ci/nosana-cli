import { sleep } from '@nosana/sdk';
import { StatusEmitter } from './statusEmitter.js';
import { createSignature } from '../../../api.js';
import { listenToEventSource } from '../../../eventsource.js';
import { configs } from '../../../NodeManager/configs/configs.js';

export async function createListener(
  nodeAddress: string,
  jobAddress: string,
  statusEmitter: StatusEmitter,
) {
  let listener;
  await sleep(3);
  const headers = await createSignature();
  listener = listenToEventSource(
    `https://${nodeAddress}.${
      configs().frp.serverAddr
    }/status/${jobAddress}?logs=jobLog`,
    headers,
    (events: any[]) => {
      if (events.length > 0) {
        events.forEach(({ log }) => {
          const streamableLogs = [
            'JOB_DEFINATION_VALIDATION',
            'JOB_DEFINATION_VALIDATION_PASSED',
            'PULLING_IMAGE',
            'PULLING_IMAGE_SUCCESS',
            'CONTAINER_STARTING',
            'CONTAINER_STARTED',
          ];
          const logJSON = JSON.parse(log);
          if (streamableLogs.includes(logJSON.state)) {
            statusEmitter.emitProgress(jobAddress, logJSON.state);
          }

          if (logJSON.state === 'FLOW_FINISHED') {
            listener!.close();
          }
        });
      }
    },
  );
}
