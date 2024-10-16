import ApiEventEmitter from "../../api/ApiEventEmitter.js";
import { ApiListenResultReturnStrategy } from "./startegy/ApiListenResultReturnStrategy.js";

export interface ResultReturnStrategy {
    load(jobId: string): Promise<boolean>;
}

export class ResultReturnStrategySelector {
    constructor() {}

    /**
     * Selects the appropriate JobDefinitionStrategy based on the name.
     * @param name - The name/type of the strategy ('api-listen' or 'api').
     * @returns JobDefinitionStrategy
     */
    selectStrategy(name: string): ResultReturnStrategy {
        switch (name) {
            case 'api-listen':
                return new ApiListenResultReturnStrategy(ApiEventEmitter.getInstance());
            default:
                throw new Error(`Unsupported strategy: ${name}`);
        }
    }
}