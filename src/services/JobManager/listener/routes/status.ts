import { NextFunction } from 'express';

import { JobRequest, JobResponse, JobObject } from '../types/index.js';

function createEventSourceEvent(value: string | object): string {
  let type,
    msg = value;
  if (typeof msg === 'object') {
    // @ts-ignore
    type = value.event;
    msg = JSON.stringify({ ...msg, time_stamp: new Date().toString() });
  }
  return `data: ${msg}\n${type ? `event: ${type}\n` : ''}\n`;
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
      // TODO: FIX EVENT STOP MESSAGE
      // res.write(createEventSourceEvent({ event: 'stop' }));
      res.end();
    },
  );

  next();
}
