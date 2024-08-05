import { OUTPUT_EVENTS } from "../outputEvents.js";

export const jsonOutputEventHandlers = {
    [OUTPUT_EVENTS.EXAMPLE_OUTPUT]: (response: any, param: any) => {
      response.params = param;
    },
}