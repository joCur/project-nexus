/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

declare global {
  var fetch: jest.MockedFunction<typeof fetch>;
  var mockFetch: (response: any, ok?: boolean) => void;
  
  namespace NodeJS {
    interface Global {
      fetch: jest.MockedFunction<typeof fetch>;
      mockFetch: (response: any, ok?: boolean) => void;
    }
  }
}

export {};