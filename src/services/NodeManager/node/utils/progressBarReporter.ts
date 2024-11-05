import { Options, Preset } from "cli-progress";

export class ProgressBarReporter {
    private running: boolean = false;
    private current: {
        optProgressBar: Options | null, 
        total: number, 
        startValue: number, 
        payload?: object, 
        progressBarPreset?: Preset
    } = {
        optProgressBar: null,
        total: 0,
        startValue: 0,
    };

    async start(name: string, optProgressBar: Options, total: number, startValue: number, payload?: object, progressBarPreset?: Preset): Promise<void>{
        this.current = {
            optProgressBar,
            total,
            startValue,
            payload,
            progressBarPreset,
        };
        this.running = true;
    }

    async update(current: number, payload?: object): Promise<void>{

    }

    async stop(name: string): Promise<string>{
        this.running = false;
        return name;
    }

    async completed(): Promise<void>{
        this.running = false;
    }
}
