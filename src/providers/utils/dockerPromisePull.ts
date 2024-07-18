import Dockerode from 'dockerode';

export async function dockerPromisePull(image: string, docker: Dockerode) {
  return await new Promise((resolve, reject): any =>
    docker.pull(image, (err: any, stream: any) => {
      if (err) {
        reject(err);
      } else {
        docker.modem.followProgress(
          stream,
          (err: any, output: any) => onFinished(err, output),
          onProgress,
        );
      }
      async function onFinished(err: any, _: any) {
        if (!err) {
          resolve(true);
          return;
        }
        reject(err);
      }
      function onProgress(event: any) {
        // TODO: multiple progress bars happening at the same time, how do we show this?
      }
    }),
  );
}
