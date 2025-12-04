vi.mock('../json/JsonOutputFormatter', () => {
  return {
    JsonOutputFormatter: vi.fn().mockImplementation(() => {
      return {
        finalize: vi.fn(),
        output: vi.fn(),
      };
    }),
  };
});

vi.mock('../text/TextOutputFormatter', () => {
  return {
    TextOutputFormatter: vi.fn().mockImplementation(() => {
      return {
        finalize: vi.fn(),
        output: vi.fn(),
      };
    }),
  };
});
