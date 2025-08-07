import TaskManager from '../TaskManager.js';

export async function moveTaskManagerGroupOperations(
  this: TaskManager,
  group: string,
): Promise<void> {
  /**
   * Look up the group context to get its operation IDs.
   * If the group doesn't exist in the execution plan, it's invalid.
   */
  const groupContext = this.executionPlan.find((ctx) => ctx.group === group);
  if (!groupContext) {
    throw new Error('GROUP_NOT_FOUND');
  }

  /**
   * Ensure we're currently within the provided group context before proceeding.
   * Prevents stopping inactive or completed groups.
   */
  if (this.currentGroup == group) {
    throw new Error('GROUP_ACTIVE');
  }

  const currentGroupContext = this.executionPlan.find(
    (ctx) => ctx.group === this.currentGroup,
  );
  if (!currentGroupContext) {
    throw new Error('GROUP_NOT_FOUND');
  }

  /**
   * The following block creates a "placeholder promise" that we temporarily insert into the group’s
   * operation map. This ensures that even if all the original ops complete while we're restarting,
   * the group will not advance to the next one until we explicitly release this block.
   *
   * This is CRITICAL to prevent race conditions where the restart is too late, and the system
   * thinks the group has completed.
   */
  const groupHold = (() => {
    let release!: () => void;
    const placeholder = new Promise<void>((res) => (release = res));

    const abortHandler = () => {
      release();
      this.mainAbortController.signal.removeEventListener(
        'abort',
        abortHandler,
      );
    };

    this.mainAbortController.signal.addEventListener('abort', abortHandler);

    return {
      groupHoldPromisePlaceHolder: placeholder,
      releaseGroupOperationBlock: () => {
        release();
        this.mainAbortController.signal.removeEventListener(
          'abort',
          abortHandler,
        );
      },
    };
  })();

  // Use a special ID to register this placeholder in the group tracking map
  // The op will still retain its original ID for restart purposes
  const placeholderId = `${group}::restart-group`;
  this.trackGroupOperationPromise(
    placeholderId,
    groupHold.groupHoldPromisePlaceHolder,
  );

  if (this.currentGroup) {
    await this.stopTaskManagerGroupOperations(this.currentGroup);
  }

  /**
   * update the current group to the group we about to start
   */
  this.currentGroup = group;

  /**
   * restart the new current group
   */
  await this.restartTaskManagerGroupOperations(group);

  /**
   * Now that we've re-launched the op and it's being tracked,
   * we can safely release the group hold so the group can eventually complete.
   */
  groupHold.releaseGroupOperationBlock();
}
