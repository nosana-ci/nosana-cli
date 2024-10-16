import { JobDefinition } from "../../../provider/types.js";
import ApiEventEmitter from "../../api/ApiEventEmitter.js";
import { ApiListenJobDefinitionStrategy } from "./startegy/ApiListenJobDefinitionStrategy.js";

export interface JobDefinitionStrategy {
    load(jobId: string): Promise<JobDefinition>;
}

export class JobDefinitionStrategySelector {
    constructor() {}

    /**
     * Selects the appropriate JobDefinitionStrategy based on the name.
     * @param name - The name/type of the strategy ('api-listen' or 'api').
     * @returns JobDefinitionStrategy
     */
    selectStrategy(name: string): JobDefinitionStrategy {
        switch (name) {
            case 'api-listen':
                return new ApiListenJobDefinitionStrategy(ApiEventEmitter.getInstance());
            // case 'api':
            //     return new ApiJobDefinitionStrategy(this.eventEmitter); // assuming you have an ApiJobDefinitionStrategy
            default:
                throw new Error(`Unsupported strategy: ${name}`);
        }
    }
}