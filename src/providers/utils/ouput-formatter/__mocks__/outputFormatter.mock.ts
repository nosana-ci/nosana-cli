jest.mock('../json/JsonOutputFormatter', () => {
  return {
    JsonOutputFormatter: jest.fn().mockImplementation(() => {
      return {
        finalize: jest.fn(),
        output: jest.fn(),
      };
    }),
  };
});

jest.mock('../text/TextOutputFormatter', () => {
  return {
    TextOutputFormatter: jest.fn().mockImplementation(() => {
      return {
        finalize: jest.fn(),
        output: jest.fn(),
      };
    }),
  };
});
