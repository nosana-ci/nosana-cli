import { EventEmitter } from 'events';
import { StateData, State, STATE_NAME, StateHistoryEntry } from "./NodeStateTypes";

export class NodeStateManager{
    private currentState: State;
    private currentStateEntry: StateHistoryEntry;
    private stateHistory: StateHistoryEntry[];
    private eventEmitter: EventEmitter;

    constructor() {
        this.currentState = STATE_NAME.NONE;
        this.currentStateEntry = this.createStateHistoryEntry(STATE_NAME.NONE, {});
        this.stateHistory = [this.currentStateEntry];
        this.eventEmitter = new EventEmitter();
    }

    getCurrentState(): State {
        return this.currentState;
    }

    getCurrentStateEntry(): StateHistoryEntry {
        return this.currentStateEntry;
    }

    updateState<T extends State>(newState: T, data: StateData[T]): void {
        this.currentState = newState;
        this.currentStateEntry = this.createStateHistoryEntry(newState, data);
        this.addStateToHistory(this.currentStateEntry);
        this.emitStateChange(this.currentStateEntry);
    }

    onStateChange(callback: (entry: StateHistoryEntry) => void): void {
        this.eventEmitter.on('stateChange', callback);
    }

    getStateHistory(): StateHistoryEntry[] {
        return this.stateHistory;
    }

    private createStateHistoryEntry<T extends State>(state: T, data: StateData[T]): StateHistoryEntry {
        return {
            state,
            data,
            timestamp: new Date(),
        };
    }

    private addStateToHistory(entry: StateHistoryEntry): void {
        this.stateHistory.push(entry);
    }

    private emitStateChange(entry: StateHistoryEntry): void {
        this.eventEmitter.emit('stateChange', entry);
    }
}
