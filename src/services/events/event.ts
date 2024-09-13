import { State } from "./state";

export interface BaseNodeEvent {
    type: string;
    state: State;
}

export interface ExampleNodeEvent extends BaseNodeEvent {
}

export type Event = ExampleNodeEvent;

export class NodeEvent {
    private events: Event[] = [];

    public addEvent(event: Event): void {
        this.events.push(event);
    }

    public getEvents(): Event[] {
        return this.events;
    }
}
