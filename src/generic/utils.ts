/**
 * Method to pause the process
 * @param seconds Number of seconds to pause
 */
const sleep = (seconds: number): Promise<void> =>
  new Promise((res) => setTimeout(res, seconds * 1e3));

/**
 * Method to easily get a universal timestamp
 */
const now = (): number => Math.floor(Date.now() / 1e3);

function setIntervalImmediately(callback: (args: void) => void, ms?: number) {
  callback();
  return setInterval(callback, ms);
}

const clearLine = () => {
  process.stdout.moveCursor(0, -1); // up one line
  process.stdout.clearLine(1); // from cursor to end
};

const colors = {
  RED: '\u001b[1;31m',
  GREEN: '\u001b[1;32m',
  YELLOW: '\u001b[1;33m',
  BLUE: '\u001b[1;34m',
  CYAN: '\u001b[1;36m',
  WHITE: '\u001b[1;38;5;231m',
  RESET: '\u001b[0m',
};

function isCallback<T>(maybeFunc: T | unknown): maybeFunc is T {
  return maybeFunc instanceof Function;
}

export { now, sleep, setIntervalImmediately, clearLine, colors, isCallback };
