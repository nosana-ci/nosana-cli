class GenericError extends Error {
  get name() {
    return this.constructor.name;
  }
}

class NotQueuedError extends GenericError {}

function showSupportMessage() {
  console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Get support in our Discord Server. Join:');
  console.error('https://nosana.com/discord');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

export { GenericError, NotQueuedError, showSupportMessage };
