import { Container } from 'dockerode';
import { promiseTimeoutWrapper } from '../../generic/timeoutPromiseWrapper.js';

export function getCotnainerLogs(
  container: Container,
  timeout = 360,
  controller = new AbortController(),
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const logs = await promiseTimeoutWrapper(
        container.logs({
          follow: false,
          stdout: true,
          stderr: true,
          abortSignal: controller.signal,
        }),
        timeout,
        controller,
      );
      resolve(logs);
    } catch (e) {
      reject(e);
    }
  });
}
