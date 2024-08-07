import { OutputEvent, OutputEventParams } from "../outputEvents.js";
import { OutputFormatterAdapter } from "../OutputFormatter.js";
import { jsonOutputEventHandlers } from "./JsonOutputEventHandlers.js";

export type JsonResponseType = { [key: string]: any };
export class JsonOutputFormatter implements OutputFormatterAdapter {
    private response: JsonResponseType = {};
  
    finalize() {
      console.log('\n');
      console.log(JSON.stringify(this.response, null, 2));
    }

    output<T extends OutputEvent>(event: T, param: OutputEventParams[T]) {
      this.response.isError = false;
      jsonOutputEventHandlers[event](this.response, param);
    }
  }
