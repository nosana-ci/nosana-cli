jest.mock('../json/JsonOutputFormatter', () => {
  return {
    JsonOutputFormatter: jest.fn().mockImplementation(() => {
      return {
        events: {},
        finalize: jest.fn(),
      };
    }),
  };
});

jest.mock('../text/TextOutputFormatter', () => {
  return {
    TextOutputFormatter: jest.fn().mockImplementation(() => {
      return {
        events: {},
        finalize: jest.fn(),
      };
    }),
  };
});
