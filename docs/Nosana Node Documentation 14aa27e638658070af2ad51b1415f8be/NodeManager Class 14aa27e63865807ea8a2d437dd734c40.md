# NodeManager Class

## Overview

The **NodeManager** class is the backbone of the Node system, responsible for managing all core operations. It acts as the entry point for initializing, starting, and stopping the Node, ensuring smooth operations across various scenarios. This class is designed for flexibility, making it compatible with both command-line tools and server-based applications.

The **NodeManager** connects multiple modules of the Node system and ensures they work in harmony. For instance, it handles logging, state management, API lifecycle, and job queues. Let’s explore its structure and functionality.

---

## Class Composition

The **NodeManager** class operates with two key private components:

- **`node: BasicNode`**: Represents the Node itself, encapsulating its main functionalities.
- **`apiHandler: ApiHandler`**: Manages the Node's API, ensuring it remains operational even if the Node undergoes restarts or errors.

This separation ensures that the API is "long-lived," meaning it continues to function independently of the Node’s internal states, making interactions seamless during processes like health checks, jobs, or restarts.

---

## Key Features

### Initialization (`init()`)

The `init()` method is the first step in setting up the Node. It:

1. Initializes **state streaming** to allow real-time updates about the Node’s condition.
2. Configures **log streaming** for continuous log monitoring.
3. Performs a **health check**, ensuring the Node's readiness.
4. Starts the Node's API via the **API handler**, allowing external interactions even if the Node hasn’t started job processing.

By starting the API early, you can interact with the Node without waiting for jobs or queue management to begin.

---

### Starting the Node (`start(market?: string)`)

The `start()` method kicks off the main Node processes. Here’s how it works:

1. **Optional Market Entry**: You can specify a `market` if the Node is intended for a specific purpose.
2. **Benchmarking**: Assesses the Node's capabilities (e.g., hardware performance, network speed) to determine job readiness.
3. **Health Check**: Verifies critical components like connectivity and container health.
4. **Job Management**:
    - If there are **pending jobs** from a previous session, the Node picks them up.
    - If not, it joins the **queue** to wait for new jobs.
5. **Execution**: Listens to the queue and begins processing jobs as they arrive.

---

### Stopping the Node (`stop()`)

The `stop()` method gracefully shuts down the Node:

1. Stops the **API** to ensure no further interactions occur.
2. Halts all Node operations, clearing processes.

This method is essential for controlled shutdowns.

## Usage Examples

```tsx
const nodeManager = new NodeManager(options);

function start(){
	await nodeManager.init();
	await nodeManager.start(market);
}

function stop(){
	await nodeManager.stop();
}

// futurestic example
app.post('/start-node', async (req, res) => {
  try {
    await nodeManager.start(req.body.market);
    res.status(200).send('Node started successfully.');
  } catch (error) {
    res.status(500).send('Error starting the Node: ' + error.message);
  }
});

app.post('/stop-node', async (req, res) => {
  try {
    await nodeManager.stop(req.body.market);
    res.status(200).send('Node stopped successfully.');
  } catch (error) {
    res.status(500).send('Error stopping the Node: ' + error.message);
  }
});
```