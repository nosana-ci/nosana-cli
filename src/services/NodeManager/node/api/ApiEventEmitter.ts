import { EventEmitter } from 'events';

class ApiEventEmitter extends EventEmitter {
    private static instance: ApiEventEmitter;

    private constructor() {
        super();
    }

    public static getInstance(): ApiEventEmitter {
        if (!ApiEventEmitter.instance) {
            ApiEventEmitter.instance = new ApiEventEmitter();
        }
        return ApiEventEmitter.instance;
    }
}

export default ApiEventEmitter;
