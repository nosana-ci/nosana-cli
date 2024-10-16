import { log, LogObserver } from "../NodeLog.js";

export const consoleLogging = (() => {
    let instance: ConsoleLogger | null = null;
  
    return () => {
      if (!instance) {
        instance = new ConsoleLogger();
      }
      return instance;
    };
})();

export class ConsoleLogger implements LogObserver {
    constructor() {
      log().addObserver(this);
    }
  
    public update(
      _job: string,
      log: string,
      _timestamp: number,
    ) {
        console.log(log)
    }
}
