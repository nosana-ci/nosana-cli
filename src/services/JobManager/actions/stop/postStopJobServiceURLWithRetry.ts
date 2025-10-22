import { createSignature } from '../../../api.js';
import { configs } from '../../../NodeManager/configs/configs.js';

export async function postStopJobServiceURLWithRetry(
  nodeAddress: string,
  jobAddress: string,
  callback?: () => void,
  overrides?: {
    interval: number;
    attempts: number;
  },
): Promise<void> {
  let retryCount = 0;

  const headers = await createSignature();
  const retryInterval = overrides?.interval || 5000;

  const intervalId = setInterval(async () => {
    retryCount = retryCount + 1;

    if (retryCount > (overrides?.attempts || 0)) {
      clearInterval(intervalId);
    }

    try {
      const response = await fetch(
        `https://${nodeAddress}.${
          configs().frp.serverAddr
        }/job/${jobAddress}/stop`,
        {
          method: 'POST',
          headers,
          body: '',
        },
      );
      if (response.status === 200) {
        clearInterval(intervalId);
        if (callback) callback();
      }
    } catch (error) {
      // The interval will continue, no need to manually retry here
    }
  }, retryInterval);
}
