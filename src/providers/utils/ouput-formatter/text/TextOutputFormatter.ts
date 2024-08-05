import { OUTPUT_EVENTS, OutputEvent } from "../outputEvents.js";
import { OutputFormatterAdapter } from "../OutputFormatter.js";
import { textOutputEventHandlers } from "./TextOutputEventHandlers.js";

export class TextOutputFormatter implements OutputFormatterAdapter {
    finalize() {}
  
    events = Object.keys(OUTPUT_EVENTS).reduce((acc, key) => {
      const eventKey = OUTPUT_EVENTS[key as keyof typeof OUTPUT_EVENTS];
      acc[eventKey] = (param: any) => textOutputEventHandlers[eventKey](param);
      return acc;
    }, {} as { [key in OutputEvent]: (param: any) => void });
  }
