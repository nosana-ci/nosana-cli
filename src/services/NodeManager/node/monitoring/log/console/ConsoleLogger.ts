import ora, { Ora } from "ora";
import { log, LogObserver, NodeLogEntry } from "../NodeLog.js";

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
    private pending: boolean = false;
    private expecting: string | undefined;
    spinner!: Ora;
    
    constructor() {
      log().addObserver(this);
    }
  
    public update(log: NodeLogEntry) {
      if(this.pending){
        if(log.type == 'error' || log.method == this.expecting || log.type == 'stop'){
          if(log.type == 'error' && log.method !== this.expecting){
            this.spinner.stop()
            this.pending = false;
          }
          if(log.type == 'stop'){
            this.spinner.stop()
            if(log.log != ''){
              console.log(log.log)
            }
            this.pending = false;
          } else {
            if(log.type == 'success'){
              this.spinner.succeed(log.log)
            } else if(log.type == 'error') {
              this.spinner.fail(log.log)
            }
            this.pending = false;
          }

          // if(log.method == this.expecting && log.type == 'process'){
          //   if(log.pending?.isPending){
          //     this.pending = true;
          //     this.expecting = log.pending?.expecting;
          //     this.spinner = ora(log.log).start();
          //   } else {
          //     console.log(log.log)
          //     this.pending = false;
          //   }
          // }
        }
      } else {
        if(log.pending?.isPending){
          this.pending = true;
          this.expecting = log.pending?.expecting;
          this.spinner = ora(log.log).start();
        } else {
          if(log.type === 'log'){
            process.stdout.write(log.log)
          } else {
            console.log(log.log)
          }
        }
      }
    }
}
