import cors from 'cors';
import WebSocket from 'ws';
import { Server } from 'http';
import { Client as SDK } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';
import express, { Express, NextFunction, Request, Response } from 'express';

import ApiEventEmitter from './ApiEventEmitter.js';
import { configs } from '../../configs/configs.js';
import { FlowHandler } from '../flow/flowHandler.js';
import { sleep } from '../../../../generic/utils.js';
import { NodeAPIRequest } from './types/index.js';
import { stateStreaming } from '../../monitoring/streaming/StateStreamer.js';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';
import { Provider } from '../../provider/Provider.js';
import { initTunnel, stopTunnel } from '../../../tunnel.js';
import { NodeRepository } from '../../repository/NodeRepository.js';

import {
  verifyBackendSignatureMiddleware,
  verifyJobOwnerSignatureMiddleware,
  verifyWSJobOwnerSignatureMiddleware,
  verifyWSNodeOrJobOwnerSignatureMiddleware,
} from './middlewares/index.js';

import {
  getNodeInfoRoute,
  getJobDefinitionRoute,
  getServiceUrlRoute,
  postJobDefinitionRoute,
  postServiceStopRoute,
  postNodeValidation,
  wssLogRoute,
  wssStatusRoute,
} from './routes/index.js';

export class ApiHandler {
  private api: Express;
  private address: PublicKey;
  private flowHandler: FlowHandler;
  private server: Server | null = null;
  private wss: WebSocket.Server | null = null; // WebSocket server
  private eventEmitter = ApiEventEmitter.getInstance();
  private tunnelCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private sdk: SDK,
    private repository: NodeRepository,
    private provider: Provider,
    private port: number,
  ) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;
    this.api = express();
    this.api.use(cors());
    this.registerRoutes();
    this.flowHandler = new FlowHandler(this.provider, repository);

    applyLoggingProxyToClass(this);

    // periodically check if the tunnel server returns a response on / (the response is the address)
    // if not stop the reverse proxy and set it up again
  }

  public async start(): Promise<string> {
    try {
      const tunnelServer = await this.restartTunnelAndProxy();
      await this.listen();
      this.startWebSocketServer();

      return tunnelServer;
    } catch (error) {
      throw error;
    }
  }

  private async restartTunnelAndProxy() {
    await this.stopTunnelAndProxy();
    await this.provider.setUpReverseProxyApi(this.address.toString());

    const tunnelServer = `https://${this.address}.${configs().frp.serverAddr}`;
    await sleep(3);
    initTunnel({ server: tunnelServer, port: this.port });
    this.startTunnelCheck(tunnelServer);
    return tunnelServer;
  }

  private async stopTunnelAndProxy() {
    await this.provider.stopReverseProxyApi(this.address.toString());
    this.stopTunnelCheck();
    stopTunnel();
  }

  private async startWebSocketServer() {
    this.wss = new WebSocket.Server({ noServer: true });

    this.server?.on('upgrade', (request, socket, head) => {
      this.wss?.handleUpgrade(request, socket as any, head, (ws) => {
        this.wss?.emit('connection', ws, request);
      });
    });

    this.wss.on('connection', (ws, _) => {
      ws.on('message', async (message) => {
        const { path, header, body } = JSON.parse(message.toString());

        try {
          switch (path) {
            case '/log':
              await verifyWSJobOwnerSignatureMiddleware(
                ws,
                header,
                body,
                wssLogRoute,
              );
              break;
            case '/status':
              await verifyWSNodeOrJobOwnerSignatureMiddleware(
                ws,
                header,
                body,
                wssStatusRoute,
              );
              break;
            default:
              ws.close(404);
          }
        } catch (_) {
          ws.close(500, 'Ops something went wrong');
        }
      });

      ws.on('close', () => {
        stateStreaming(this.address.toString()).unsubscribe(ws);
      });
    });
  }

  private startTunnelCheck(tunnelServer: string) {
    if (!this.tunnelCheckInterval) {
      this.tunnelCheckInterval = setInterval(async () => {
        let failed = false;
        try {
          const response = await fetch(`${tunnelServer}/`);
          if (!response.ok) {
            failed = true;
          }

          const responseText = await response.json();
          if (responseText !== this.address.toString()) {
            failed = true;
          }
        } catch (error) {
          failed = true;
        }

        if (failed == true) {
          console.log('API proxy is offline, restarting..');
          await this.restartTunnelAndProxy();
        }
      }, 60000 * 5); // check every 5 mins
    }
  }

  private async registerRoutes() {
    // Attach require objects to routes
    this.api.use((req: NodeAPIRequest, _: Response, next: NextFunction) => {
      req.repository = this.repository;
      req.eventEmitter = this.eventEmitter;
      req.address = this.address;
      req.flowHandler = this.flowHandler;
      next();
    });

    // GET Routes
    this.api.get('/', (_: Request, res: Response) => res.send(this.address));
    this.api.get('/job-definition/:id', express.json(), getJobDefinitionRoute);
    this.api.get('/node/info', getNodeInfoRoute);
    this.api.get(
      '/service/url/:jobId',
      verifyJobOwnerSignatureMiddleware,
      getServiceUrlRoute,
    );

    // POST Routes
    this.api.post(
      '/job-definition/:jobId',
      express.json(),
      verifyJobOwnerSignatureMiddleware,
      postJobDefinitionRoute,
    );
    this.api.post(
      '/service/stop/:jobId',
      verifyJobOwnerSignatureMiddleware,
      postServiceStopRoute,
    );
    this.api.post(
      '/node/validate',
      express.json(),
      verifyBackendSignatureMiddleware,
      postNodeValidation,
    );
  }

  private async listen(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.server = this.api.listen(this.port, () => {
        resolve(this.port);
      });

      this.server.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  private stopTunnelCheck() {
    if (this.tunnelCheckInterval) {
      clearInterval(this.tunnelCheckInterval);
      this.tunnelCheckInterval = null;
    }
  }

  public async stop() {
    await this.stopTunnelAndProxy();

    if (this.server) {
      this.server.close();
    }
    if (this.wss) {
      this.wss.close();
    }
  }
}
