import { Client as SDK } from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';
import express, { Express, Request, Response, NextFunction } from 'express';
import { Provider } from "../../provider/Provider.js";
import { config } from "../../../../generic/config.js";
import { initTunnel } from "../../../tunnel.js";
import { sleep } from "../../../../generic/utils.js";
import { Server } from 'http';
import ApiEventEmitter from "./ApiEventEmitter.js";
import { NodeRepository } from "../../repository/NodeRepository.js";
import { applyLoggingProxyToClass, logEmitter, LogEntry } from "../../monitoring/proxy/loggingProxy.js";
import WebSocket from 'ws';
import { stateStreaming } from "../../monitoring/streaming/StateStreamer.js";
import { logStreaming } from "../../monitoring/streaming/LogStreamer.js";

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
        private port: number
    ){
        this.address = this.sdk.solana.provider!.wallet.publicKey;
        this.api = express();
        this.registerRoutes();

        applyLoggingProxyToClass(this);
    }

    public async start(): Promise<string> {
        await this.provider.setUpReverseProxyApi(this.address.toString());

        const tunnelServer = `https://${this.address}.${config.frp.serverAddr}`;

        await sleep(3);
        initTunnel({ server: tunnelServer, port: this.port });
        await this.listen();
        this.startWebSocketServer();

        return tunnelServer
    }

    private async startWebSocketServer() {
        this.wss = new WebSocket.Server({ noServer: true });

        this.server?.on('upgrade', (request, socket, head) => {
            this.wss?.handleUpgrade(request, socket as any, head, (ws) => {
                this.wss?.emit('connection', ws, request);
            });
        });

        this.wss.on('connection', (ws) => {
            ws.on('message', (message) => {
                const { path, header, body } = JSON.parse(message.toString());
                
                /**
                 * this is to handle state streaming, this would be used for external
                 * sevices to follow a job or node state
                 */
                if(path == '/status'){
                    const { job } = body;

                    // if(!job){
                    //     ws.send('Invalid job params')
                    // }

                    // TODO: do authorization checks
                    // valid authurization (public key and signature)
                    // job owner validation

                    stateStreaming(this.address.toString()).subscribe(ws, job)
                }

                /**
                 * this is for log streaming, this is going to be used by the basic job poster
                 * just to show that clients logs, both from the node and the container
                 */
                if(path == '/log'){
                    const { job } = body;

                    // if(!job){
                    //     ws.send('Invalid job params')
                    // }

                    // TODO: do authorization checks
                    // valid authurization (public key and signature)
                    // job owner validation

                    logStreaming(this.address.toString()).subscribe(ws, job)
                }
            });

            ws.on('close', () => {
                stateStreaming(this.address.toString()).unsubscribe(ws);
            });
        });
    }

    private async registerRoutes() {
        this.api.get('/', (req: Request, res: Response) => {
            res.send(this.address);
        });

        this.api.post('/job-definition/:id', express.json(), (req: Request, res: Response) => {
            const id = req.params.id;
            const jobDefinition = req.body.jobDefinition;
            if (!jobDefinition || !id) {
                return res.status(400).send('job definition parameters not provided');
            }

            if(!this.repository.getFlowState(id)){
                return res.status(400).send('invalid job id');
            }

            if(this.repository.getFlowState(id).status !== 'waiting-for-job-defination'){
                return res.status(400).send('cannot send job defination at this time');
            }

            this.eventEmitter.emit('job-definition', { jobDefinition, id });
            res.status(200).send('Job definition received');
        });

        this.api.get('/job-definition/:id', express.json(), (req: Request, res: Response) => {
            const id = req.params.id;
            if (!id) {
                return res.status(400).send('job id parameter not provided');
            }

            if(!this.repository.getFlowState(id)){
                return res.status(400).send('invalid job id');
            }

            if(this.repository.getFlowState(id).status !== 'waiting-for-result'){
                return res.status(400).send('cannot get job result at this time');
            }

            this.eventEmitter.emit('job-result', { id });

            res.status(200).send(JSON.stringify(this.repository.getFlowState(id)));
        });
    }

    private async listen(): Promise<number> {
        this.server = this.api.listen(this.port, () => {});
        return this.port;
    }

    public async stop(){
        if (this.server) {
            this.server.close();
        }
        if (this.wss) {
            this.wss.close();
        }
    }
}
