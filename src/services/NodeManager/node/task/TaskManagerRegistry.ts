import TaskManager from './TaskManager.js';

/**
 * TaskManagerRegistry
 *
 * A singleton registry to track active TaskManager instances, keyed by `jobId`.
 *
 * In a system where jobs are processed via isolated TaskManager instances,
 * this registry provides global visibility and control over running jobs
 * without violating encapsulation or spawning duplicates.
 *
 * ---------------------------------------------------------------------------------------
 * ✅ WHY THIS EXISTS:
 * ---------------------------------------------------------------------------------------
 * - Each `TaskManager` is designed to handle a single job at a time.
 * - The API (or other system components) should not create new instances blindly.
 * - Instead, they can **query the registry** for the job-specific TaskManager.
 * - This avoids duplicate execution and lets the system safely:
 *    - Pause/resume/stop jobs
 *    - Fetch logs or live state
 *    - Broadcast updates via WebSocket
 *
 * ---------------------------------------------------------------------------------------
 *  FUTURE USE CASES:
 * ---------------------------------------------------------------------------------------
 * - **Parallel Job Execution:**
 *   You’ll eventually support multiple jobs running at the same time (concurrently).
 *   This registry is the backbone for that. Each job gets its own `TaskManager`,
 *   but the registry keeps them accessible and uniquely identifiable.
 *
 * - **Safe Shutdown / Cleanup:**
 *   On server shutdown, loop through all managers via the registry
 *   and gracefully shut down active tasks.
 *
 * - Use `.register()` when starting a job
 * - Use `.remove()` once the job finishes (success/fail)
 * - `.get()` to safely access a manager by ID
 * - Singleton ensures the same instance is used everywhere
 */

export class TaskManagerRegistry {
  private static instance: TaskManagerRegistry;
  private registry = new Map<string, TaskManager>();

  private constructor() {}

  public static getInstance(): TaskManagerRegistry {
    if (!TaskManagerRegistry.instance) {
      TaskManagerRegistry.instance = new TaskManagerRegistry();
    }
    return TaskManagerRegistry.instance;
  }

  public register(jobId: string, manager: TaskManager) {
    this.registry.set(jobId, manager);
  }

  public get(jobId: string): TaskManager | undefined {
    return this.registry.get(jobId);
  }

  public remove(jobId: string) {
    this.registry.delete(jobId);
  }

  public has(jobId: string): boolean {
    return this.registry.has(jobId);
  }

  public async stop(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    for (const [jobId, manager] of this.registry.entries()) {
      const p = manager.stop('quit').finally(() => this.registry.delete(jobId));

      stopPromises.push(p);
    }

    await Promise.all(stopPromises);
  }
}
