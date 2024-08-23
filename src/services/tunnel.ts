import { Request, Response } from 'express';
import { ManagerOptions, Socket } from 'socket.io-client';
import { Readable, Duplex } from 'stream';
import http, { IncomingHttpHeaders } from 'http';
import { io } from 'socket.io-client';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocketOptions } from 'dgram';

let socket: Socket | null = null;

function keepAlive() {
  setTimeout(() => {
    if (socket && socket.connected) {
      socket.send('ping');
    }
    keepAlive();
  }, 5000);
}

export function initTunnel(options: {
  server: string;
  port: number;
  host?: string;
  path?: string;
  origin?: string;
}) {
  const initParams: Partial<ManagerOptions & SocketOptions> = {
    path: '/$web_tunnel',
    transports: ['websocket'],
    extraHeaders: {},
  };
  if (options.path) {
    initParams.extraHeaders!['path-prefix'] = options.path;
  }
  const http_proxy = process.env.https_proxy || process.env.http_proxy;
  if (http_proxy) {
    // @ts-ignore
    initParams.agent = new HttpsProxyAgent(http_proxy);
  }
  socket = io(options.server, initParams);

  socket.on('connect', () => {
    if (socket!.connected) {
      // TODO: replace with node logger?
      // console.log('client connect to server successfully');
    }
  });

  socket.on('connect_error', (e) => {
    // TODO: replace with node logger?
    // console.log('connect error', e && e.message);
  });

  socket.on('disconnect', () => {
    // TODO: replace with node logger?
    // console.log('client disconnected');
  });

  socket.on('request', (requestId, request) => {
    const isWebSocket = request.headers.upgrade === 'websocket';
    // TODO: use node logger with a new event type
    // console.log(`${isWebSocket ? 'WS' : request.method}: `, request.path);
    request.port = options.port;
    request.hostname = options.host;
    if (options.origin) {
      request.headers.host = options.origin;
    }
    const tunnelRequest = new TunnelRequest({
      requestId,
      socket: socket!,
    });
    const localReq = http.request(request);
    tunnelRequest.pipe(localReq);
    const onTunnelRequestError = (e: any) => {
      tunnelRequest.off('end', onTunnelRequestEnd);
      localReq.destroy(e);
    };
    const onTunnelRequestEnd = () => {
      tunnelRequest.off('error', onTunnelRequestError);
    };
    tunnelRequest.once('error', onTunnelRequestError);
    tunnelRequest.once('end', onTunnelRequestEnd);
    const onLocalResponse = (localRes: any) => {
      localReq.off('error', onLocalError);
      if (isWebSocket && localRes.upgrade) {
        return;
      }
      const tunnelResponse = new TunnelResponse({
        responseId: requestId,
        socket: socket!,
      });
      tunnelResponse.writeHead(
        localRes.statusCode,
        localRes.statusMessage,
        localRes.headers,
        localRes.httpVersion,
      );
      localRes.pipe(tunnelResponse);
    };
    const onLocalError = (error: any) => {
      // console.log(error);
      localReq.off('response', onLocalResponse);
      socket!.emit('request-error', requestId, error && error.message);
      tunnelRequest.destroy(error);
    };
    const onUpgrade = (
      localRes: Request,
      localSocket: Duplex,
      localHead: IncomingHttpHeaders,
    ) => {
      // localSocket.once('error', onTunnelRequestError);
      if (localHead && localHead.length) localSocket.unshift(localHead);
      const tunnelResponse = new TunnelResponse({
        responseId: requestId,
        socket: socket!,
        duplex: true,
      });
      tunnelResponse.writeHead(null, null, localRes.headers);
      localSocket.pipe(tunnelResponse).pipe(localSocket);
    };
    localReq.once('error', onLocalError);
    localReq.once('response', onLocalResponse);

    if (isWebSocket) {
      localReq.on('upgrade', onUpgrade);
    }
  });
  keepAlive();
}

export class TunnelRequest extends Readable {
  protected _socket: Socket;
  protected _requestId: string;
  constructor({ socket, requestId }: { socket: Socket; requestId: string }) {
    super();
    this._socket = socket;
    this._requestId = requestId;
    const onRequestPipe = (requestId: string, data: Request) => {
      if (this._requestId === requestId) {
        this.push(data);
      }
    };
    const onRequestPipes = (requestId: string, data: Request) => {
      if (this._requestId === requestId) {
        data.forEach((chunk) => {
          this.push(chunk);
        });
      }
    };
    const onRequestPipeError = (requestId: string, error: string) => {
      if (this._requestId === requestId) {
        this._socket.off('request-pipe', onRequestPipe);
        this._socket.off('request-pipes', onRequestPipes);
        this._socket.off('request-pipe-error', onRequestPipeError);
        this._socket.off('request-pipe-end', onRequestPipeEnd);
        this.destroy(new Error(error));
      }
    };
    const onRequestPipeEnd = (requestId: string, data: Request) => {
      if (this._requestId === requestId) {
        this._socket.off('request-pipe', onRequestPipe);
        this._socket.off('request-pipes', onRequestPipes);
        this._socket.off('request-pipe-error', onRequestPipeError);
        this._socket.off('request-pipe-end', onRequestPipeEnd);
        if (data) {
          this.push(data);
        }
        this.push(null);
      }
    };
    this._socket.on('request-pipe', onRequestPipe);
    this._socket.on('request-pipes', onRequestPipes);
    this._socket.on('request-pipe-error', onRequestPipeError);
    this._socket.on('request-pipe-end', onRequestPipeEnd);
  }

  _read() {}
}

export class TunnelResponse extends Duplex {
  protected _socket: Socket;
  protected _responseId: string;
  constructor({
    socket,
    responseId,
    duplex,
  }: {
    socket: Socket;
    responseId: string;
    duplex?: boolean;
  }) {
    super();
    this._socket = socket;
    this._responseId = responseId;
    if (duplex) {
      // for websocket request： bidirection
      const onResponsePipe = (responseId: string, data: Response) => {
        if (this._responseId === responseId) {
          this.push(data);
        }
      };
      const onResponsePipes = (responseId: string, data: Request) => {
        if (this._responseId === responseId) {
          data.forEach((chunk) => {
            this.push(chunk);
          });
        }
      };
      const onResponsePipeError = (responseId: string, error: string) => {
        if (this._responseId === responseId) {
          this._socket.off('response-pipe', onResponsePipe);
          this._socket.off('response-pipes', onResponsePipes);
          this._socket.off('response-pipe-error', onResponsePipeError);
          this._socket.off('response-pipe-end', onResponsePipeEnd);
          this.destroy(new Error(error));
        }
      };
      const onResponsePipeEnd = (responseId: string, data: Request) => {
        if (this._responseId === responseId) {
          this._socket.off('response-pipe', onResponsePipe);
          this._socket.off('response-pipes', onResponsePipes);
          this._socket.off('response-pipe-error', onResponsePipeError);
          this._socket.off('response-pipe-end', onResponsePipeEnd);
          if (data) {
            this.push(data);
          }
          this.push(null);
        }
      };
      this._socket.on('response-pipe', onResponsePipe);
      this._socket.on('response-pipes', onResponsePipes);
      this._socket.on('response-pipe-error', onResponsePipeError);
      this._socket.on('response-pipe-end', onResponsePipeEnd);
    }
  }

  _write(chunk: any, encoding: any, callback: Function) {
    this._socket.emit('response-pipe', this._responseId, chunk);
    this._socket.io.engine.once('drain', () => {
      callback();
    });
  }

  _writev(chunks: any, callback: Function) {
    this._socket.emit('response-pipes', this._responseId, chunks);
    this._socket.io.engine.once('drain', () => {
      callback();
    });
  }

  _final(callback: Function) {
    this._socket.emit('response-pipe-end', this._responseId);
    this._socket.io.engine.once('drain', () => {
      callback();
    });
  }

  _destroy(e: any, callback: Function) {
    if (e) {
      this._socket.emit(
        'response-pipe-error',
        this._responseId,
        e && e.message,
      );
      this._socket.io.engine.once('drain', () => {
        callback();
      });
      return;
    }
    callback();
  }

  writeHead(
    statusCode: Request['statusCode'] | null,
    statusMessage: Request['statusMessage'] | null,
    headers: Request['headers'],
    httpVersion?: Request['httpVersion'],
  ) {
    this._socket.emit('response', this._responseId, {
      statusCode,
      statusMessage,
      headers,
      httpVersion,
    });
  }

  _read(size: number) {}
}
