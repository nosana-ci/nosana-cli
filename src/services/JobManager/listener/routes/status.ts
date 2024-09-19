import { NextFunction } from 'express';

import { JobRequest, JobResponse, JobObject } from '../types';

function createEventSourceEvent(value: string | object): string {
  let msg = value;
  if (typeof msg === 'object') msg = JSON.stringify(msg);
  return `data: ${msg}\n\n`;
}

export async function jobStatus(
  req: JobRequest,
  res: JobResponse<{ job: JobObject | undefined }>,
  next: NextFunction,
) {
  const jobManager = req.jobManager!;
  const { error, job } = res.locals;

  if (error !== undefined || job === undefined) {
    console.log({ error, job });
    res.locals.error = {
      error: 'Could not get job',
      message: 'Failed to find job.',
    };
    return next();
  }

  res.writeHead(200, {
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
  });

  res.write(createEventSourceEvent({ event: 'connection_init' }));

  res.locals.result = undefined;

  res.on('close', () => {
    res.end();
  });

  jobManager.status(
    job.id,
    (msg) => {
      res.write(createEventSourceEvent(msg));
    },
    () => {
      console.log('STOPPING');
      res.write(createEventSourceEvent({ event: 'stop' }));
      res.end();
    },
  );

  next();
}
