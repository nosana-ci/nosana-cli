class GenericError extends Error {
  get name() {
    return this.constructor.name;
  }
}

class NotQueuedError extends GenericError {}

export { GenericError, NotQueuedError };
