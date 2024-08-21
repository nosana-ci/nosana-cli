import EventSource from 'eventsource';

export const listenToEventSource = <T>(
  url: string,
  onMessageCallback: (data: T) => void,
  onErrorCallback?: (err: MessageEvent) => void,
): void => {
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event: MessageEvent) => {
    const data: T = JSON.parse(event.data);
    onMessageCallback(data);
  };

  eventSource.onerror = (err: MessageEvent) => {
    if (onErrorCallback) {
      onErrorCallback(err);
    }
  };
};
