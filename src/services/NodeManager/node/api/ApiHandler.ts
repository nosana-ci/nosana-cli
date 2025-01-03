import { Job, Client as SDK } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';
import express, { Express, Request, Response, NextFunction } from 'express';
import { Provider } from '../../provider/Provider.js';
import { initTunnel } from '../../../tunnel.js';
import { sleep } from '../../../../generic/utils.js';
import { Server } from 'http';
import cors from 'cors';
import ApiEventEmitter from './ApiEventEmitter.js';
import { NodeRepository } from '../../repository/NodeRepository.js';
import {
  applyLoggingProxyToClass,
  logEmitter,
  LogEntry,
} from '../../monitoring/proxy/loggingProxy.js';
import WebSocket from 'ws';
import { stateStreaming } from '../../monitoring/streaming/StateStreamer.js';
import { logStreaming } from '../../monitoring/streaming/LogStreamer.js';
import nacl from 'tweetnacl';
import { verifyJobOwnerMiddleware } from './middlewares/verifyJobOwnerMiddleware.js';
import { verifySignatureMiddleware } from './middlewares/verifySignatureMiddleware.js';
import { state } from '../../monitoring/state/NodeState.js';
import { configs } from '../../configs/configs.js';
import { pkg } from '../../../../static/staticsImports.js';

export class ApiHandler {
  private api: Express;
  private address: PublicKey;
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

    applyLoggingProxyToClass(this);

    // periodically check if the tunnel server returns a response on / (the response is the address)
    // if not stop the reverse proxy and set it up again
  }

  public async start(): Promise<string> {
    try {
      await this.provider.stopReverseProxyApi(this.address.toString());
      await this.provider.setUpReverseProxyApi(this.address.toString());

      const tunnelServer = `https://${this.address}.${
        configs().frp.serverAddr
      }`;

      await sleep(3);
      initTunnel({ server: tunnelServer, port: this.port });
      await this.listen();
      this.startWebSocketServer();
      this.startTunnelCheck(tunnelServer);
      return tunnelServer;
    } catch (error) {
      throw error;
    }
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

  private startTunnelCheck(tunnelServer: string) {
    this.tunnelCheckInterval = setInterval(async () => {
      let failed = false;
      try {
        const response = await fetch(`${tunnelServer}/`);
        if (!response.ok) {
          failed = true;
        }

        const responseText = await response.text();
        if (responseText !== this.address.toString()) {
          failed = true;
        }
      } catch (error) {
        failed = true;
      }

      if (failed == true) {
        await this.provider.stopReverseProxyApi(this.address.toString());
        await this.provider.setUpReverseProxyApi(this.address.toString());
      }
    }, 60000 * 20); // check every 20 mins
  }

  private async registerRoutes() {
    this.api.get('/', (req: Request, res: Response) => {
      res.send(this.address);
    });

    this.api.post(
      '/job-definition/:id',
      verifySignatureMiddleware,
      verifyJobOwnerMiddleware,
      express.json(),
      (req: Request, res: Response) => {
        const id = req.params.id;
        const jobDefinition = req.body.jobDefinition;
        if (!jobDefinition || !id) {
          return res.status(400).send('job definition parameters not provided');
        }

        if (!this.repository.getFlowState(id)) {
          return res.status(400).send('invalid job id');
        }

        if (
          this.repository.getFlowState(id).status !==
          'waiting-for-job-defination'
        ) {
          return res
            .status(400)
            .send('cannot send job defination at this time');
        }

        this.eventEmitter.emit('job-definition', { jobDefinition, id });
        res.status(200).send('Job definition received');
      },
    );

    this.api.get(
      '/job-definition/:id',
      verifySignatureMiddleware,
      verifyJobOwnerMiddleware,
      express.json(),
      (req: Request, res: Response) => {
        const id = req.params.id;
        if (!id) {
          return res.status(400).send('job id parameter not provided');
        }

        if (!this.repository.getFlowState(id)) {
          return res.status(400).send('invalid job id');
        }

        if (this.repository.getFlowState(id).status !== 'waiting-for-result') {
          return res.status(400).send('cannot get job result at this time');
        }

        this.eventEmitter.emit('job-result', { id });

        res.status(200).send(JSON.stringify(this.repository.getFlowState(id)));
      },
    );

    this.api.post(
      '/service/stop/:jobId',
      verifySignatureMiddleware,
      verifyJobOwnerMiddleware,
      async (req: Request<{ jobId: string }>, res: Response) => {
        const jobId = req.params.jobId;

        if (!jobId) {
          res.status(400).send('jobId path parameter is required');
          return;
        }

        try {
          this.eventEmitter.emit('stop-job', jobId);

          res.status(200).send('job stopped successfully');
          return;
        } catch (error) {
          res.status(500).send('Error occured while stopping job');
        }
      },
    );

    this.api.get(
      '/service/url/:jobId',
      verifySignatureMiddleware,
      (req: Request, res: Response) => {
        try {
          const jobId = req.params.jobId;

          const flow = this.repository.getflow(jobId);
          const secrets = flow?.state.secrets;

          if (secrets && secrets[jobId]) {
            res
              .status(200)
              .send(`https://${secrets[jobId]}.${configs().frp.serverAddr}`);
            return;
          }

          res.status(400).send('No exposed url for job id');
        } catch (error) {
          res.status(500).send('Error occured getting url');
        }
      },
    );

    this.api.get(
      '/node/info',
      // verifySignatureMiddleware,
      (req: Request, res: Response) => {
        res.status(200).json({
          ...state(this.address.toString()).getNodeInfo(),
          info: this.repository.getNodeInfo(),
          version: pkg.version,
        });
      },
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
    this.stopTunnelCheck();
    await this.provider.stopReverseProxyApi(this.address.toString());

    if (this.server) {
      this.server.close();
    }
    if (this.wss) {
      this.wss.close();
    }
  }
}
