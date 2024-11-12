import { Server } from 'http';
import express, { Express, NextFunction, Request, Response } from 'express';
import WebSocket from 'ws';
import { Job, Client as SDK } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';

import { Provider } from '../../provider/Provider.js';
import { initTunnel } from '../../../tunnel.js';
import { sleep } from '../../../../generic/utils.js';
import ApiEventEmitter from './ApiEventEmitter.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import { applyLoggingProxyToClass } from '../../monitoring/proxy/loggingProxy.js';
import { stateStreaming } from '../../monitoring/streaming/StateStreamer.js';
import { logStreaming } from '../../monitoring/streaming/LogStreamer.js';
import nacl from 'tweetnacl';
import { verifyJobOwnerMiddleware } from './middlewares/verifyJobOwnerMiddleware.js';
import { verifySignatureMiddleware } from './middlewares/verifySignatureMiddleware.js';
import { configs } from '../../configs/nodeConfigs.js';
import { NodeAPIRequest } from './types/index.js';
import {
  getNodeInfoRoute,
  getJobDefinitionRoute,
  getServiceUrlRoute,
  postJobDefinitionRoute,
  postServiceStopRoute,
  postNodeValidate,
} from './routes/index.js';

export class ApiHandler {
  private api: Express;
  private address: PublicKey;
  private server: Server | null = null;
  private wss: WebSocket.Server | null = null; // WebSocket server
  private eventEmitter = ApiEventEmitter.getInstance();

  constructor(
    private sdk: SDK,
    private repository: NodeRepository,
    private provider: Provider,
    private port: number,
  ) {
    this.address = this.sdk.solana.provider!.wallet.publicKey;
    this.api = express();
    // this.api.use(cors());
    this.registerRoutes();

    applyLoggingProxyToClass(this);
  }

  public async start(): Promise<string> {
    await this.provider.stopReverseProxyApi(this.address.toString());
    await this.provider.setUpReverseProxyApi(this.address.toString());

    const tunnelServer = `https://${this.address}.${configs().frp.serverAddr}`;

    await sleep(3);
    initTunnel({ server: tunnelServer, port: this.port });
    await this.listen();
    this.startWebSocketServer();

    return tunnelServer;
  }

  private async startWebSocketServer() {
    this.wss = new WebSocket.Server({ noServer: true });

    this.server?.on('upgrade', (request, socket, head) => {
      this.wss?.handleUpgrade(request, socket as any, head, (ws) => {
        this.wss?.emit('connection', ws, request);
      });
    });

    this.wss.on('connection', (ws, request) => {
      ws.on('message', async (message) => {
        const { path, header, body } = JSON.parse(message.toString());

        /**
         * this is to handle state streaming, this would be used for external
         * sevices to follow a job or node state
         */
        if (path == '/status') {
          // valid authurization (public key and signature)
          const [nodeAddress, base64Signature] = header.split(':');
          const signature = Buffer.from(base64Signature, 'base64');
          const publicKey = new PublicKey(nodeAddress);
          const message = Buffer.from(configs().signMessage);

          if (
            !nacl.sign.detached.verify(message, signature, publicKey.toBytes())
          ) {
            ws.send('Invalid signature');
            return;
          }

          const { jobAddress, address } = body;

          if (!jobAddress || !address) {
            ws.send('Invalid job params');
          }

          // job owner validation
          const job: Job = await this.sdk.jobs.get(jobAddress);

          if (address !== job.project.toString()) {
            ws.send('Invalid address');
            return;
          }

          stateStreaming(this.address.toString()).subscribe(ws, jobAddress);
        }

        /**
         * this is for log streaming, this is going to be used by the basic job poster
         * just to show that clients logs, both from the node and the container
         */
        if (path == '/log') {
          // valid authurization (public key and signature)
          const [nodeAddress, base64Signature] = header.split(':');
          const signature = Buffer.from(base64Signature, 'base64');
          const publicKey = new PublicKey(nodeAddress);
          const message = Buffer.from(configs().signMessage);

          if (
            !nacl.sign.detached.verify(message, signature, publicKey.toBytes())
          ) {
            ws.send('Invalid signature');
            return;
          }

          const { jobAddress, address } = body;

          if (!jobAddress || !address) {
            ws.send('Invalid job params');
          }

          // job owner validation
          const job: Job = await this.sdk.jobs.get(jobAddress);

          if (address !== job.project.toString()) {
            ws.send('Invalid address');
            return;
          }

          logStreaming(this.address.toString()).subscribe(ws, jobAddress);
        }
      });

      ws.on('close', () => {
        stateStreaming(this.address.toString()).unsubscribe(ws);
      });
    });
  }

  private async registerRoutes() {
    // Attach require objects to routes
    this.api.use((req: NodeAPIRequest, _: Response, next: NextFunction) => {
      req.repository = this.repository;
      req.eventEmitter = this.eventEmitter;
      req.address = this.address;
      next();
    });

    // GET Routes
    this.api.get('/', (_: Request, res: Response) => res.send(this.address));
    this.api.get('/job-definition/:id', express.json(), getJobDefinitionRoute);
    this.api.get('/node/info', getNodeInfoRoute);
    this.api.get(
      '/service/url/:jobId',
      verifySignatureMiddleware,
      getServiceUrlRoute,
    );

    // POST Routes
    this.api.post(
      '/job-definition/:id',
      express.json(),
      postJobDefinitionRoute,
    );
    this.api.post(
      '/service/stop/:jobId',
      verifySignatureMiddleware,
      verifyJobOwnerMiddleware,
      postServiceStopRoute,
    );
    this.api.post('/node/validate', postNodeValidate);
  }

  private async listen(): Promise<number> {
    this.server = this.api.listen(this.port, () => {});
    return this.port;
  }

  public async stop() {
    await this.provider.stopReverseProxyApi(this.address.toString());
    if (this.server) {
      this.server.close();
    }
    if (this.wss) {
      this.wss.close();
    }
  }
}
