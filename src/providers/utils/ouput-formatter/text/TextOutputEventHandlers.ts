import { OUTPUT_EVENTS } from "../outputEvents.js";

export const textOutputEventHandlers = {
    [OUTPUT_EVENTS.EXAMPLE_OUTPUT]: (param: any) => {
      console.log(
        `EXAMPLE OUTPUT LOG with data: ${param}`,
      );
    },
  };
