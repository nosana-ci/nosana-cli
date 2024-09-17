import { NextFunction } from 'express';

import { JobRequest, JobResponse, JobObject } from '../types';
import { sleep } from '@nosana/sdk';

export async function jobStatus(
  req: JobRequest,
  res: JobResponse<{ job: JobObject | undefined }>,
  next: NextFunction,
) {
  const jobManager = req.jobManager!;
  const { error, job } = res.locals;

  // if (error || !job) {
  //   return next();
  // }

  res.writeHead(200, {
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
  });

  jobManager.state.subscribe('test', (event, value) => {
    res.write(`data: ${JSON.stringify({ event, value })}\n\n`);
  });

  for (let i = 0; i < 5; i++) {
    // @ts-ignore
    jobManager.state.set('test', { a: i });
    await sleep(1);
  }

  res.locals.result = undefined;

  res.on('close', () => {
    jobManager.state.unsubscribe('test');
    res.end();
  });

  next();
}
