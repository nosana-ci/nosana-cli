# ExpiryHandler

`expiryHandler.ts`

The `ExpiryHandler` class is responsible for managing the expiration lifecycle of jobs in the Nosana ecosystem. It tracks the expiration time for a job, provides callbacks for handling expiry events, and ensures proper cleanup when a job is completed or terminated prematurely. By integrating event emitters and robust timing logic, the `ExpiryHandler` ensures precise control over job expiration.

## **Core Responsibilities**

1. **Initialization and Tracking**
    - Tracks expiration times for jobs based on their start time and the associated market's job timeout.
2. **Timers Management**
    - Manages timers for warnings and expiration events.
    - Resets and adjusts timers as needed.
3. **Event Handling**
    - Responds to events such as job completion or manual termination.
    - Executes a user-defined callback upon expiration.
4. **Lifecycle Management**
    - Ensures proper cleanup of timers and states when a job is completed or terminated.