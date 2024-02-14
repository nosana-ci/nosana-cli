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
  process.stdout.moveCursor(0, -1) // up one line
  process.stdout.clearLine(1) // from cursor to end
}

export { now, sleep, setIntervalImmediately, clearLine };
