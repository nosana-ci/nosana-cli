import JobManager from '../../../services/JobManager/index.js';

type Options = { config: string; port: string };

export const jobServe = ({ config, port }: Options) => {
  const jobManager = new JobManager(config);

  if (Number(port)) {
    jobManager.listen(parseInt(port));
  } else {
    console.log('Port must be a number.');
  }
};
