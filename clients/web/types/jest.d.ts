/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

declare global {
  namespace NodeJS {
    interface Global {
      fetch: jest.MockedFunction<typeof fetch>;
      mockFetch: (response: any, ok?: boolean) => void;
      mockFetchError: (error: any) => void;
    }
  }
  
  var fetch: jest.MockedFunction<typeof fetch>;
  var mockFetch: (response: any, ok?: boolean) => void;
  var mockFetchError: (error: any) => void;
}

// Extend fetch to have Jest mock properties
declare global {
  interface Window {
    fetch: jest.MockedFunction<typeof fetch>;
  }
}

export {};