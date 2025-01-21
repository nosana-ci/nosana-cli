# NodeState

## NodeState Overview

The `NodeState` class is responsible for managing the state and status of a node. It maintains a history of state changes, allows observers to subscribe to state updates, and notifies them when changes occur. This class follows the Observer pattern, enabling external observers to stay informed of state changes in a decoupled manner.

## Singleton Pattern

The `NodeState` class uses a singleton pattern to ensure that there is only one instance of `NodeState` per node throughout the application. The `state()` function returns this single instance, maintaining consistent state handling across different parts of the system.

- **Instance**: The singleton instance is held by `NodeState | null`. If no instance exists, a new one is created and returned.
- **Usage**: The singleton ensures that all operations on the state of a specific node are consistent and managed through the same instance.

## Managing Observers

The `NodeState` class allows multiple observers to subscribe to changes in the node's state. Any class that implements the `StateObserver` interface can be added as an observer, providing a flexible way to handle state changes.

### Observer Functions

- **`addObserver(observer: StateObserver)`**: Adds an observer to receive state updates.
- **`removeObserver(observer: StateObserver)`**: Removes an observer from receiving further updates.
- **`notifyObservers(status: string, state: { [key: string]: string }, timestamp: number)`**: Notifies all registered observers of a state change.

## Fields and Properties

- **`shared: { [key: string]: string }`**: Stores shared properties of the node, such as the node name.
- **`info: { [key: string]: any }`**: Contains general information about the node, such as the node name and uptime.
- **`status: string`**: Represents the current status of the node.
- **`state: { [key: string]: any }`**: Holds the current state information for the node.
- **`history: { status: string; state: { [key: string]: string }; timestamp: number }[]`**: Keeps a history of all state changes.
- **`observers: StateObserver[]`**: List of observers that need to be notified when the state changes.

## Constructor

- **`constructor(node: string)`**: Initializes the `NodeState` instance with the specified node name. Sets up the initial `info` and `shared` properties and starts listening for log events via `logEmitter`.

## State Management Methods

### `getNodeInfo()`

Returns general information about the node, including the classified state.

- **Returns**: An object containing node information such as `node`, `uptime`, and classified `state`.

### `addObserver(observer: StateObserver)`

Adds an observer to the list of observers that will be notified of state changes.

- **Parameters**: `observer: StateObserver` - The observer to be added.

### `removeObserver(observer: StateObserver)`

Removes an observer from the list of observers.

- **Parameters**: `observer: StateObserver` - The observer to be removed.

### `notifyObservers(status: string, state: { [key: string]: string }, timestamp: number)`

Notifies all registered observers of a state change.

- **Parameters**:
    - `status: string`: The current status of the node.
    - `state: { [key: string]: string }`: The current state information of the node.
    - `timestamp: number`: The timestamp when the state change occurred.

### `addState(status: string, state: { [key: string]: string })`

Adds a new state to the node, updates the current status and state, and notifies observers of the change.

- **Parameters**:
    - `status: string`: The new status of the node.
    - `state: { [key: string]: string }`: The new state information to be added.

### State Handling Workflow

1. **History Update**: Adds the previous status and state to the `history` array along with the current timestamp.
2. **Status and State Update**: Updates the current `status` and `state` with the new values.
3. **Notify Observers**: Calls `notifyObservers()` to inform all registered observers of the state change.

### `process(data: LogEntry)`

Processes incoming log data. This method is currently a placeholder for handling log entries and can be extended for specific log processing requirements.

- **Parameters**: `data: LogEntry` - The log entry to be processed.

## StateObserver Interface

- **StateObserver**: Defines an `update(status: string, state: { [key: string]: string }, timestamp: number)` function that any class implementing this interface can use to receive state updates.

## Using the NodeState Class

Here’s how to use the `NodeState` class in your code:

```
const nodeState = state('node1');
nodeState.addState('running', { task: 'initializing' });
```

In this example, we retrieve the singleton instance of `NodeState` for a node and add a new state. The observers are then notified of this change automatically.

## Extending NodeState

To extend the functionality of the `NodeState` class:

- **Add New Observers**: Implement the `StateObserver` interface for components that need to receive state updates and add them using `addObserver()`.
- **Modify State Structure**: Update the `state` object or extend the `NodeState` class if more information needs to be tracked or included in the state.

As of now we have one Observers for the Node State

[StateStreamer](NodeState%2014ba27e6386580e0970ae88ddf58bba8/StateStreamer%2014ba27e6386580d3b246e036f7556a6a.md)