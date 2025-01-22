import { EventEmitter } from 'events';

export const logEmitter = new EventEmitter();

export interface LogEntry {
  class: string;
  method: string;
  arguments: any[];
  timestamp: string;
  type: 'call' | 'return' | 'error';
  result?: any;
  error?: any;
}

export function applyLoggingProxyToClass(instance: any) {
  const properties = [
    'PodmanContainerOrchestration',
    'DockerContainerOrchestration',
    'containerOrchestration',
    'resourceManager',
    'provider',
    'marketHandler',
    'runHandler',
    'jobHandler',
    'flowHandler',
    'apiHandler',
    'repository',
    'jobExternalUtil',
    'healthHandler',
    'stakeHandler',
    'expiryHandler',
    'specsHandler',
    'progressBarReporter',
    'registerHandler',
  ];

  properties.forEach((property) => {
    if (instance.hasOwnProperty(property)) {
      const value = instance[property];
      instance[property] = createLoggingProxy(value);
    }
  });
}

export function createLoggingProxy<T extends object>(target: T): T {
  const className = Object.getPrototypeOf(target).constructor.name;

  const formatArguments = (args: any[]) => {
    return args.map((arg) => {
      if (typeof arg === 'function') {
        return arg.constructor.name === 'AsyncFunction'
          ? '[AsyncFunction]'
          : '[Function]';
      }
      return arg;
    });
  };

  return new Proxy(target, {
    get(target: T, propKey: string | symbol, receiver: any) {
      const originalMethod = target[propKey as keyof T];

      if (typeof originalMethod === 'function') {
        return (...args: any[]) => {
          const logEntry: LogEntry = {
            class: className,
            method: String(propKey),
            arguments: formatArguments(args),
            timestamp: new Date().toISOString(),
            type: 'call',
          };

          logEmitter.emit('log', logEntry);

          try {
            // Check if the method is async (returns a Promise)
            const result = originalMethod.apply(target, args);
            if (result instanceof Promise) {
              return result
                .then((resolvedValue) => {
                  logEntry.type = 'return';
                  logEntry.result = resolvedValue;
                  logEmitter.emit('log', logEntry);
                  return resolvedValue;
                })
                .catch((error) => {
                  logEntry.type = 'error';
                  logEntry.error = error;
                  logEmitter.emit('log', logEntry);
                  throw error;
                });
            } else {
              // If it's a synchronous function, log and return the result immediately
              logEntry.type = 'return';
              logEntry.result = result;
              logEmitter.emit('log', logEntry);
              return result;
            }
          } catch (error) {
            logEntry.type = 'error';
            logEntry.error = error as any;
            logEmitter.emit('log', logEntry);
            throw error;
          }
        };
      }

      return Reflect.get(target, propKey, receiver);
    },
  });
}

export function createFunctionLoggingProxy<T extends (...args: any[]) => any>(
  func: T,
  classLabel: string = 'StandaloneFunction',
): T {
  const formatArguments = (args: any[]) => {
    return args.map((arg) => {
      if (typeof arg === 'function') {
        return arg.constructor.name === 'AsyncFunction'
          ? '[AsyncFunction]'
          : '[Function]';
      }
      return arg;
    });
  };

  return ((...args: Parameters<T>): ReturnType<T> => {
    const logEntry: LogEntry = {
      class: classLabel,
      method: func.name || '[anonymous]',
      arguments: formatArguments(args),
      timestamp: new Date().toISOString(),
      type: 'call',
    };

    logEmitter.emit('log', logEntry);

    try {
      const result = func(...args);
      if (result instanceof Promise) {
        return result
          .then((resolvedValue) => {
            logEntry.type = 'return';
            logEntry.result = resolvedValue;
            logEmitter.emit('log', logEntry);
            return resolvedValue as ReturnType<T>;
          })
          .catch((error) => {
            logEntry.type = 'error';
            logEntry.error = error;
            logEmitter.emit('log', logEntry);
            throw error;
          }) as ReturnType<T>;
      } else {
        logEntry.type = 'return';
        logEntry.result = result;
        logEmitter.emit('log', logEntry);
        return result;
      }
    } catch (error) {
      logEntry.type = 'error';
      logEntry.error = error as any;
      logEmitter.emit('log', logEntry);
      throw error;
    }
  }) as T;
}
