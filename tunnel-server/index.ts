import http, { IncomingHttpHeaders } from 'http';
import express, { Request, Response } from 'express';
import { Server, Socket } from 'socket.io';
import morgan from 'morgan';
import { v4 as uuidV4 } from 'uuid';
import { Duplex } from 'stream';
import { TunnelRequest, TunnelResponse } from './tunnel.js';

const app = express();
const httpServer = http.createServer(app);
const webTunnelPath = '/$web_tunnel';
const io = new Server(httpServer, {
  path: webTunnelPath,
});
export type TunnelSocket = {
  host: string;
  pathPrefix?: string;
  socket: Socket;
};
let tunnelSockets: Array<TunnelSocket> = [];

function getTunnelSocket(host: string, pathPrefix?: string | string[]) {
  pathPrefix = Array.isArray(pathPrefix) ? pathPrefix[0] : pathPrefix;
  return tunnelSockets.find(
    (s: TunnelSocket) => s.host === host && s.pathPrefix === pathPrefix,
  );
}

function setTunnelSocket(
  socket: Socket,
  host: string,
  pathPrefix?: string | string[],
) {
  pathPrefix = Array.isArray(pathPrefix) ? pathPrefix[0] : pathPrefix;
  tunnelSockets.push({
    host,
    pathPrefix,
    socket,
  });
}

function removeTunnelSocket(host: string, pathPrefix?: string | string[]) {
  pathPrefix = Array.isArray(pathPrefix) ? pathPrefix[0] : pathPrefix;
  tunnelSockets = tunnelSockets.filter(
    (s) => !(s.host === host && s.pathPrefix === pathPrefix),
  );
  console.log('tunnelSockets: ', tunnelSockets);
}

function getAvailableTunnelSocket(host: string, url: string) {
  const tunnels = tunnelSockets
    .filter((s) => {
      if (s.host !== host) {
        return false;
      }
      if (!s.pathPrefix) {
        return true;
      }
      return url.indexOf(s.pathPrefix) === 0;
    })
    .sort((a, b) => {
      if (!a.pathPrefix) {
        return 1;
      }
      if (!b.pathPrefix) {
        return -1;
      }
      return b.pathPrefix.length - a.pathPrefix.length;
    });
  if (tunnels.length === 0) {
    return null;
  }
  return tunnels[0].socket;
}

io.use((socket, next) => {
  const connectHost = socket.handshake.headers.host;
  const pathPrefix = socket.handshake.headers['path-prefix'];
  if (!connectHost) {
    return next(new Error('Could not determine connect host'));
  }
  if (getTunnelSocket(connectHost, pathPrefix)) {
    return next(new Error(`${connectHost} has a existing connection`));
  }
  next();
});

io.on('connection', (socket: Socket) => {
  const connectHost = socket.handshake.headers.host;
  const pathPrefix = socket.handshake.headers['path-prefix'];
  if (connectHost) {
    setTunnelSocket(socket, connectHost, pathPrefix);
    console.log(
      `client connected at ${connectHost}, path prefix: ${pathPrefix}`,
    );
    const onMessage = (message: string) => {
      if (message === 'ping') {
        socket.send('pong');
      }
    };
    const onDisconnect = (reason: string) => {
      console.log('client disconnected: ', reason);
      removeTunnelSocket(connectHost, pathPrefix);
      socket.off('message', onMessage);
    };
    socket.on('message', onMessage);
    socket.once('disconnect', onDisconnect);
  } else {
    console.error('Could not determine connect host');
  }
});

app.use(morgan('tiny'));

function getReqHeaders(req: Request) {
  const encrypted = req.secure;
  const headers = { ...req.headers };
  const url = new URL(`${encrypted ? 'https' : 'http'}://${req.headers.host}`);
  const forwardValues = {
    for: req.socket.remoteAddress,
    port: url.port || (encrypted ? 443 : 80),
    proto: encrypted ? 'https' : 'http',
  };
  const headerKeys = ['for', 'port', 'proto'];
  headerKeys.forEach((key) => {
    const previousValue = req.headers[`x-forwarded-${key}`] || '';
    headers[`x-forwarded-${key}`] = `${previousValue || ''}${
      previousValue ? ',' : ''
    }${
      // @ts-ignore
      forwardValues[key]
    }`;
  });
  headers['x-forwarded-host'] =
    req.headers['x-forwarded-host'] || req.headers.host || '';
  return headers;
}

app.use('/', (req: Request, res: Response) => {
  let tunnelSocket: Socket | null = null;
  if (req.headers.host) {
    tunnelSocket = getAvailableTunnelSocket(req.headers.host, req.url);
  }
  if (!tunnelSocket) {
    res.status(404);
    res.send('Not Found');
    return;
  }
  const requestId = uuidV4();
  const tunnelRequest = new TunnelRequest({
    socket: tunnelSocket,
    requestId,
    request: {
      method: req.method,
      headers: getReqHeaders(req),
      path: req.url,
    },
  });
  const onReqError = (e: any) => {
    tunnelRequest.destroy(new Error(e || 'Aborted'));
  };
  req.once('aborted', onReqError);
  req.once('error', onReqError);
  req.pipe(tunnelRequest);
  req.once('finish', () => {
    req.off('aborted', onReqError);
    req.off('error', onReqError);
  });
  const tunnelResponse = new TunnelResponse({
    socket: tunnelSocket,
    responseId: requestId,
  });
  const onRequestError = () => {
    tunnelResponse.off('response', onResponse);
    tunnelResponse.destroy();
    res.status(502);
    res.end('Request error');
  };
  const onResponse = ({
    statusCode,
    statusMessage,
    headers,
  }: Partial<Request>) => {
    tunnelRequest.off('requestError', onRequestError);
    res.writeHead(statusCode || 200, statusMessage, headers);
  };
  tunnelResponse.once('requestError', onRequestError);
  tunnelResponse.once('response', onResponse);
  tunnelResponse.pipe(res);
  const onSocketError = () => {
    res.off('close', onResClose);
    res.end(500);
  };
  const onResClose = () => {
    tunnelSocket.off('disconnect', onSocketError);
  };
  tunnelSocket.once('disconnect', onSocketError);
  res.once('close', onResClose);
});

function createSocketHttpHeader(line: string, headers?: IncomingHttpHeaders) {
  if (!headers) return;
  return (
    Object.keys(headers)
      .reduce(
        function (head, key) {
          var value = headers[key];

          if (!Array.isArray(value)) {
            head.push(key + ': ' + value);
            return head;
          }

          for (var i = 0; i < value.length; i++) {
            head.push(key + ': ' + value[i]);
          }
          return head;
        },
        [line],
      )
      .join('\r\n') + '\r\n\r\n'
  );
}

httpServer.on('upgrade', (req: Request, socket: Duplex, head: Buffer) => {
  if (req.url.indexOf(webTunnelPath) === 0) {
    return;
  }
  console.log(`WS ${req.url}`);
  // proxy websocket request
  let tunnelSocket: Socket | null = null;
  if (req.headers.host) {
    tunnelSocket = getAvailableTunnelSocket(req.headers.host, req.url);
  }
  if (!tunnelSocket) {
    return;
  }
  if (head && head.length) socket.unshift(head);
  const requestId = uuidV4();
  const tunnelRequest = new TunnelRequest({
    socket: tunnelSocket,
    requestId,
    request: {
      method: req.method,
      headers: getReqHeaders(req),
      path: req.url,
    },
  });
  req.pipe(tunnelRequest);
  const tunnelResponse = new TunnelResponse({
    socket: tunnelSocket,
    responseId: requestId,
  });
  const onRequestError = () => {
    tunnelResponse.off('response', onResponse);
    tunnelResponse.destroy();
    socket.end();
  };
  const onResponse = ({
    statusCode,
    statusMessage,
    headers,
    httpVersion,
  }: Partial<Request>) => {
    tunnelResponse.off('requestError', onRequestError);
    if (statusCode) {
      socket.once('error', (err: any) => {
        console.log(`WS ${req.url} ERROR`);
        // ignore error
      });
      // not upgrade event
      socket.write(
        createSocketHttpHeader(
          `HTTP/${httpVersion} ${statusCode} ${statusMessage}`,
          headers,
        ),
      );
      tunnelResponse.pipe(socket);
      return;
    }
    const onSocketError = (err: any) => {
      console.log(`WS ${req.url} ERROR`);
      socket.off('end', onSocketEnd);
      tunnelSocket.off('disconnect', onTunnelError);
      tunnelResponse.destroy(err);
    };
    const onSocketEnd = () => {
      console.log(`WS ${req.url} END`);
      socket.off('error', onSocketError);
      tunnelSocket.off('disconnect', onTunnelError);
      tunnelResponse.destroy();
    };
    const onTunnelError = () => {
      socket.off('error', onSocketError);
      socket.off('end', onSocketEnd);
      socket.end();
      tunnelResponse.destroy();
    };
    socket.once('error', onSocketError);
    socket.once('end', onSocketEnd);
    tunnelSocket.once('disconnect', onTunnelError);
    socket.write(
      createSocketHttpHeader('HTTP/1.1 101 Switching Protocols', headers),
    );
    tunnelResponse.pipe(socket).pipe(tunnelResponse);
  };
  tunnelResponse.once('requestError', onRequestError);
  tunnelResponse.once('response', onResponse);
});

httpServer.listen(process.env.PORT || 3000);
console.log(`app start at http://localhost:${process.env.PORT || 3000}`);
