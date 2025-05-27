export function promiseTimeoutWrapper<T extends unknown>(
  promise: Promise<T>,
  expiry_time: number,
  abortController: AbortController,
  ignoreAbortedSignal: boolean = false,
): Promise<T> {
  const timeoutError = new Error(
    'Promise took too long to settle, expiry timeout met.',
  );

  const timer = setTimeout(() => {
    abortController.abort();
  }, expiry_time * 1000);

  if (abortController.signal.aborted && !ignoreAbortedSignal) {
    return Promise.reject(timeoutError);
  }

  return new Promise<T>((resolve, reject) => {
    const onSettled = () => {
      clearTimeout(timer);
      abortController.signal.removeEventListener('abort', abortHandler);
    };

    const abortHandler = () => {
      onSettled();
      reject(timeoutError);
    };

    abortController.signal.addEventListener('abort', abortHandler);
    promise
      .then((value) => resolve(value))
      .catch((error) => {
        abortController.abort();
        reject(error);
      })
      .finally(onSettled);
  });
}
