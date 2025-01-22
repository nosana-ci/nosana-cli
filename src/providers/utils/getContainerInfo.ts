import { Container, ContainerInspectInfo } from 'dockerode';
import { promiseTimeoutWrapper } from '../../generic/timeoutPromiseWrapper.js';

export function getContainerInfo(
  container: Container,
  timeout = 360,
  controller = new AbortController(),
): Promise<ContainerInspectInfo> {
  return new Promise(async (resolve, reject) => {
    try {
      const info = await promiseTimeoutWrapper(
        container.inspect({
          abortSignal: controller.signal,
        }),
        timeout,
        controller,
      );

      resolve(info);
    } catch (e) {
      reject(e);
    }
  });
}
