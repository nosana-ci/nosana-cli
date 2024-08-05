import { OUTPUT_EVENTS, OutputEvent } from "../outputEvents.js";
import { OutputFormatterAdapter } from "../OutputFormatter.js";
import { jsonOutputEventHandlers } from "./JsonOutputEventHandlers.js";

export class JsonOutputFormatter implements OutputFormatterAdapter {
    private response: { [key: string]: any } = {};
  
    finalize() {
      console.log('\n');
      console.log(JSON.stringify(this.response, null, 2));
    }
  
    events = Object.keys(OUTPUT_EVENTS).reduce((acc, key) => {
      const eventKey = OUTPUT_EVENTS[key as keyof typeof OUTPUT_EVENTS];
      acc[eventKey] = (param: any) => jsonOutputEventHandlers[eventKey](this.response, param);
      return acc;
    }, {} as { [key in OutputEvent]: (param: any) => void });
  }

