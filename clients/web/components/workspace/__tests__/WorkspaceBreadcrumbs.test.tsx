/**
 * WorkspaceBreadcrumbs Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { WorkspaceBreadcrumbs } from '../WorkspaceBreadcrumbs';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvas } from '@/hooks/use-canvas';

// Mock dependencies
jest.mock('@/stores/workspaceStore');
jest.mock('@/hooks/use-canvas');

// Mock Next.js Link component
jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'Link';
  return MockLink;
});

const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>;
const mockUseCanvas = useCanvas as jest.MockedFunction<typeof useCanvas>;

// Test wrapper with Apollo provider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MockedProvider mocks={[]} addTypename={false}>
    {children}
  </MockedProvider>
);

describe('WorkspaceBreadcrumbs', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for useCanvas hook
    mockUseCanvas.mockReturnValue({
      canvas: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    });
  });

  describe('No workspace context', () => {
    it('does not render when no workspace ID is available', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: undefined,
            currentCanvasId: undefined,
            workspaceName: undefined,
            canvasName: undefined,
          },
        };

        if (!selector) return mockStore;
        return selector(mockStore);
      });

      const { container } = render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Workspace only (no canvas)', () => {
    beforeEach(() => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            currentCanvasId: undefined,
            workspaceName: 'Test Workspace',
            canvasName: undefined,
          },
        };

        if (!selector) return mockStore;
        return selector(mockStore);
      });
    });

    it('renders breadcrumbs for workspace level', () => {
      render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(nav).toBeInTheDocument();

      // Should show Dashboard -> Workspace (current)
      expect(screen.getByRole('link', { name: 'Navigate to Dashboard' })).toHaveAttribute('href', '/');
      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
      expect(screen.getByText('Test Workspace')).toHaveAttribute('aria-current', 'page');
    });

    it('uses default workspace name when none provided', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            currentCanvasId: undefined,
            workspaceName: undefined,
            canvasName: undefined,
          },
        };

        if (!selector) return mockStore;
        return selector(mockStore);
      });

      render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      expect(screen.getByText('Workspace workspace-1')).toBeInTheDocument();
    });
  });

  describe('Workspace with canvas', () => {
    beforeEach(() => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            currentCanvasId: 'canvas-1',
            workspaceName: 'Test Workspace',
            canvasName: 'Main Canvas',
          },
        };

        if (!selector) return mockStore;
        return selector(mockStore);
      });

      // Mock useCanvas to return canvas data
      mockUseCanvas.mockReturnValue({
        canvas: {
          id: 'canvas-1',
          name: 'Main Canvas',
          workspaceId: 'workspace-1',
        } as any,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });
    });

    it('renders full breadcrumb hierarchy', () => {
      render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(nav).toBeInTheDocument();

      // Dashboard link
      expect(screen.getByRole('link', { name: 'Navigate to Dashboard' }))
        .toHaveAttribute('href', '/');

      // Workspace link
      expect(screen.getByRole('link', { name: 'Navigate to Test Workspace' }))
        .toHaveAttribute('href', '/workspace/workspace-1');

      // Current canvas (not a link)
      expect(screen.getByText('Main Canvas')).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByRole('link', { name: /Main Canvas/ })).not.toBeInTheDocument();
    });

    it('uses default canvas name when none provided', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            currentCanvasId: 'canvas-1',
            workspaceName: 'Test Workspace',
            canvasName: undefined,
          },
        };

        if (!selector) return mockStore;
        return selector(mockStore);
      });

      // Mock useCanvas to return no canvas data
      mockUseCanvas.mockReturnValue({
        canvas: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      expect(screen.getByText('Canvas')).toBeInTheDocument();
      expect(screen.getByText('Canvas')).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Visual separators', () => {
    it('renders separators between breadcrumb items', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            currentCanvasId: 'canvas-1',
            workspaceName: 'Test Workspace',
            canvasName: 'Main Canvas',
          },
        };

        if (!selector) return mockStore;
        return selector(mockStore);
      });

      mockUseCanvas.mockReturnValue({
        canvas: {
          id: 'canvas-1',
          name: 'Main Canvas',
          workspaceId: 'workspace-1',
        } as any,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { container } = render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      // Should have 2 separators for 3 breadcrumb items
      const separators = container.querySelectorAll('svg');
      expect(separators).toHaveLength(2);

      separators.forEach(separator => {
        expect(separator).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('does not render separator before first item', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            currentCanvasId: undefined,
            workspaceName: 'Test Workspace',
            canvasName: undefined,
          },
        };

        if (!selector) return mockStore;
        return selector(mockStore);
      });

      const { container } = render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      // Should have 1 separator for 2 breadcrumb items
      const separators = container.querySelectorAll('svg');
      expect(separators).toHaveLength(1);
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            currentCanvasId: 'canvas-1',
            workspaceName: 'Test Workspace',
            canvasName: 'Main Canvas',
          },
        };

        if (!selector) return mockStore;
        return selector(mockStore);
      });

      mockUseCanvas.mockReturnValue({
        canvas: {
          id: 'canvas-1',
          name: 'Main Canvas',
          workspaceId: 'workspace-1',
        } as any,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });
    });

    it('uses semantic nav element with proper label', () => {
      render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(nav).toBeInTheDocument();
    });

    it('uses ordered list for breadcrumb structure', () => {
      render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
      expect(list.tagName).toBe('OL');
    });

    it('marks current page with aria-current', () => {
      render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      const currentPage = screen.getByText('Main Canvas');
      expect(currentPage).toHaveAttribute('aria-current', 'page');
    });

    it('has accessible link labels', () => {
      render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: 'Navigate to Dashboard' }))
        .toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Navigate to Test Workspace' }))
        .toBeInTheDocument();
    });

    it('hides decorative separators from screen readers', () => {
      const { container } = render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      const separators = container.querySelectorAll('svg');
      separators.forEach(separator => {
        expect(separator).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Link behavior', () => {
    beforeEach(() => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            currentCanvasId: 'canvas-1',
            workspaceName: 'Test Workspace',
            canvasName: 'Main Canvas',
          },
        };

        if (!selector) return mockStore;
        return selector(mockStore);
      });

      mockUseCanvas.mockReturnValue({
        canvas: {
          id: 'canvas-1',
          name: 'Main Canvas',
          workspaceId: 'workspace-1',
        } as any,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });
    });

    it('has correct href attributes', () => {
      render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: 'Navigate to Dashboard' }))
        .toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: 'Navigate to Test Workspace' }))
        .toHaveAttribute('href', '/workspace/workspace-1');
    });

    it('applies hover and focus styles to links', () => {
      render(
        <TestWrapper>
          <WorkspaceBreadcrumbs />
        </TestWrapper>
      );

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass('hover:text-gray-700', 'focus:text-gray-700', 'transition-colors');
      });
    });
  });
});