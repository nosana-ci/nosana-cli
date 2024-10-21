import { Job, Market, Run, Client as SDK } from "@nosana/sdk";
import { applyLoggingProxyToClass } from "../monitoring/proxy/loggingProxy.js";

export class HealthHandler {
    constructor(
        private sdk: SDK,
    ){
        applyLoggingProxyToClass(this)
    }

    public async market(market: string){
        try {
            await this.sdk.jobs.getMarket(market)
        } catch (error) {
            throw error
        }
    }
}