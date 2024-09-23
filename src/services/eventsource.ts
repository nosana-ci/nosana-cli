import EventSource from 'eventsource';
import { SignatureHeaders } from './api';

export const listenToEventSource = <T>(
  url: string,
  headers: SignatureHeaders,
  onMessageCallback: (data: T) => void,
  onErrorCallback?: (err: MessageEvent) => void,
): EventSource => {
  const eventSource = new EventSource(url, { headers: { ...headers } });

  eventSource.onopen = () => console.log('OPENING');

  eventSource.onmessage = (event: MessageEvent) => {
    const data: T = JSON.parse(event.data);
    onMessageCallback(data);
  };

  eventSource.onerror = (err: MessageEvent) => {
    if (onErrorCallback) {
      onErrorCallback(err);
    }
  };

  return eventSource;
};

export const closeEventSource = (eventSorce: EventSource): void => {
  eventSorce.close();
};
