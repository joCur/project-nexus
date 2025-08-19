/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

declare global {
  namespace NodeJS {
    interface Global {
      fetch: jest.MockedFunction<typeof fetch>;
      mockFetch: (response: any, ok?: boolean) => void;
      mockFetchError: (error: any) => void;
      restoreConsole: () => void;
      mockConsole: () => void;
      mockRouter: {
        push: jest.MockedFunction<any>;
        replace: jest.MockedFunction<any>;
        prefetch: jest.MockedFunction<any>;
        back: jest.MockedFunction<any>;
        forward: jest.MockedFunction<any>;
        refresh: jest.MockedFunction<any>;
        pathname: string;
        query: any;
        asPath: string;
      };
      testHelpers: {
        mockAuthUser: (user?: any, isLoading?: boolean, error?: any) => void;
        mockOnboardingStatusResponse: (status: any) => void;
        testUser: any;
        defaultOnboardingStatus: any;
        completeOnboardingStatus: any;
      };
    }
  }
  
  var fetch: jest.MockedFunction<typeof fetch>;
  var mockFetch: (response: any, ok?: boolean) => void;
  var mockFetchError: (error: any) => void;
  var restoreConsole: () => void;
  var mockConsole: () => void;
  var mockRouter: {
    push: jest.MockedFunction<any>;
    replace: jest.MockedFunction<any>;
    prefetch: jest.MockedFunction<any>;
    back: jest.MockedFunction<any>;
    forward: jest.MockedFunction<any>;
    refresh: jest.MockedFunction<any>;
    pathname: string;
    query: any;
    asPath: string;
  };
  var testHelpers: {
    mockAuthUser: (user?: any, isLoading?: boolean, error?: any) => void;
    mockOnboardingStatusResponse: (status: any) => void;
    testUser: any;
    defaultOnboardingStatus: any;
    completeOnboardingStatus: any;
  };
}

// Extend fetch to have Jest mock properties
declare global {
  interface Window {
    fetch: jest.MockedFunction<typeof fetch>;
  }
}

export {};