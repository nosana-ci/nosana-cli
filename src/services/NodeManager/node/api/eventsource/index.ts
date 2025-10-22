import { Request, Response } from 'express';

export interface EventSource<T extends unknown> {
  sendIfChanged: (data: T) => void;
  closeEventSource: () => void;
}

export function createEventSource<T extends unknown>(
  req: Request,
  res: Response,
): EventSource<T> {
  let lastSendDataString: string | null = null;

  function sendIfChanged(data: T) {
    const dataString = JSON.stringify(data);

    if (dataString !== lastSendDataString) {
      res.write(`data: ${dataString}\n\n`);
      lastSendDataString = dataString;
    }
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const keepaliveInterval = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepaliveInterval);
    res.end();
  });
  req.on('error', () => {
    clearInterval(keepaliveInterval);
    res.end();
  });

  const closeEventSource = () => {
    clearInterval(keepaliveInterval);
    res.end();
  };

  return {
    sendIfChanged,
    closeEventSource,
  };
}
