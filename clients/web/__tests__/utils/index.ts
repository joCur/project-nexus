/**
 * Test utilities index - exports all test helpers and mocks
 */

// Konva mocks
export * from './konva-mocks';

// Store mocks
export * from './store-mocks';

// Test helpers
export * from './test-helpers';

// Re-export commonly used testing utilities
export { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';