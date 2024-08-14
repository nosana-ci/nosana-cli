import { Request } from 'express';
import { Socket } from 'socket.io';

import { Writable, Duplex } from 'stream';

export class TunnelRequest extends Writable {
  protected _socket: Socket;
  protected _requestId: string;

  constructor({
    socket,
    requestId,
    request,
  }: {
    socket: Socket;
    requestId: string;
    request: Partial<Request>;
  }) {
    super();
    this._socket = socket;
    this._requestId = requestId;
    this._socket.emit('request', requestId, request);
  }

  _write(chunk: any, encoding: any, callback: Function) {
    this._socket.emit('request-pipe', this._requestId, chunk);
    this._socket.conn.once('drain', () => {
      callback();
    });
  }

  _writev(chunks: any, callback: Function) {
    this._socket.emit('request-pipes', this._requestId, chunks);
    this._socket.conn.once('drain', () => {
      callback();
    });
  }

  _final(callback: Function) {
    this._socket.emit('request-pipe-end', this._requestId);
    this._socket.conn.once('drain', () => {
      callback();
    });
  }

  _destroy(e: any, callback: Function) {
    if (e) {
      this._socket.emit('request-pipe-error', this._requestId, e && e.message);
      this._socket.conn.once('drain', () => {
        callback();
      });
      return;
    }
    callback();
  }
}

export class TunnelResponse extends Duplex {
  protected _socket: Socket;
  protected _responseId: string;
  constructor({ socket, responseId }: { socket: Socket; responseId: string }) {
    super();
    this._socket = socket;
    this._responseId = responseId;
    const onResponse = (responseId: string, data: Request) => {
      if (this._responseId === responseId) {
        this._socket.off('response', onResponse);
        this._socket.off('request-error', onRequestError);
        this.emit('response', {
          statusCode: data.statusCode,
          statusMessage: data.statusMessage,
          headers: data.headers,
          httpVersion: data.httpVersion,
        });
      }
    };
    const onResponsePipe = (responseId: string, data: Request) => {
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
      if (this._responseId !== responseId) {
        return;
      }
      this._socket.off('response-pipe', onResponsePipe);
      this._socket.off('response-pipes', onResponsePipes);
      this._socket.off('response-pipe-error', onResponsePipeError);
      this._socket.off('response-pipe-end', onResponsePipeEnd);
      this.destroy(new Error(error));
    };
    const onResponsePipeEnd = (responseId: string, data: Request) => {
      if (this._responseId !== responseId) {
        return;
      }
      if (data) {
        this.push(data);
      }
      this._socket.off('response-pipe', onResponsePipe);
      this._socket.off('response-pipes', onResponsePipes);
      this._socket.off('response-pipe-error', onResponsePipeError);
      this._socket.off('response-pipe-end', onResponsePipeEnd);
      this.push(null);
    };
    const onRequestError = (requestId: string, error: string) => {
      if (requestId === this._responseId) {
        this._socket.off('request-error', onRequestError);
        this._socket.off('response', onResponse);
        this._socket.off('response-pipe', onResponsePipe);
        this._socket.off('response-pipes', onResponsePipes);
        this._socket.off('response-pipe-error', onResponsePipeError);
        this._socket.off('response-pipe-end', onResponsePipeEnd);
        this.emit('requestError', error);
      }
    };
    this._socket.on('response', onResponse);
    this._socket.on('response-pipe', onResponsePipe);
    this._socket.on('response-pipes', onResponsePipes);
    this._socket.on('response-pipe-error', onResponsePipeError);
    this._socket.on('response-pipe-end', onResponsePipeEnd);
    this._socket.on('request-error', onRequestError);
  }

  _read(size: number) {}

  _write(chunk: any, encoding: any, callback: Function) {
    this._socket.emit('response-pipe', this._responseId, chunk);
    this._socket.conn.once('drain', () => {
      callback();
    });
  }

  _writev(chunks: any, callback: Function) {
    this._socket.emit('response-pipes', this._responseId, chunks);
    this._socket.conn.once('drain', () => {
      callback();
    });
  }

  _final(callback: Function) {
    this._socket.emit('response-pipe-end', this._responseId);
    this._socket.conn.once('drain', () => {
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
      this._socket.conn.once('drain', () => {
        callback();
      });
      return;
    }
    callback();
  }
}
