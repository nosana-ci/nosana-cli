import { EventEmitter } from 'events';

export class StateManager<TState extends string, TStateData extends Record<TState, any>> {
    private currentState: TState;
    private currentStateEntry: { state: TState; data: TStateData[TState]; timestamp: Date };
    private stateHistory: { state: TState; data: TStateData[TState]; timestamp: Date }[];
    private eventEmitter: EventEmitter;
    private eventName: string;

    constructor(initialState: TState, initialData: TStateData[TState], eventName: string) {
        this.currentState = initialState;
        this.currentStateEntry = this.createStateHistoryEntry(initialState, initialData);
        this.stateHistory = [this.currentStateEntry];
        this.eventEmitter = new EventEmitter();
        this.eventName = eventName;
    }

    getCurrentState(): TState {
        return this.currentState;
    }

    getCurrentStateEntry(): { state: TState; data: TStateData[TState]; timestamp: Date } {
        return this.currentStateEntry;
    }

    updateState(newState: TState, data: TStateData[TState]): void {
        this.currentState = newState;
        this.currentStateEntry = this.createStateHistoryEntry(newState, data);
        this.addStateToHistory(this.currentStateEntry);
        this.emitStateChange(this.currentStateEntry);
    }

    onStateChange(callback: (entry: { state: TState; data: TStateData[TState]; timestamp: Date }) => void): void {
        this.eventEmitter.on(this.eventName, callback);
    }

    getStateHistory(): { state: TState; data: TStateData[TState]; timestamp: Date }[] {
        return this.stateHistory;
    }

    private createStateHistoryEntry(state: TState, data: TStateData[TState]): { state: TState; data: TStateData[TState]; timestamp: Date } {
        return {
            state,
            data,
            timestamp: new Date(),
        };
    }

    private addStateToHistory(entry: { state: TState; data: TStateData[TState]; timestamp: Date }): void {
        this.stateHistory.push(entry);
    }

    private emitStateChange(entry: { state: TState; data: TStateData[TState]; timestamp: Date }): void {
        this.eventEmitter.emit(this.eventName, entry);
    }
}
