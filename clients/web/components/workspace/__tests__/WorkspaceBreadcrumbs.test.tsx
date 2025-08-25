/**
 * WorkspaceBreadcrumbs Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { WorkspaceBreadcrumbs } from '../WorkspaceBreadcrumbs';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Mock dependencies
jest.mock('@/stores/workspaceStore');

// Mock Next.js Link component
jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'Link';
  return MockLink;
});

const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>;

describe('WorkspaceBreadcrumbs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        
        if (selector.toString().includes('getCurrentCanvas')) {
          return { id: undefined, name: undefined, canvas: undefined };
        }
        
        return selector(mockStore);
      });

      const { container } = render(<WorkspaceBreadcrumbs />);
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
        
        if (selector.toString().includes('getCurrentCanvas')) {
          return { id: undefined, name: undefined, canvas: undefined };
        }
        
        return selector(mockStore);
      });
    });

    it('renders breadcrumbs for workspace level', () => {
      render(<WorkspaceBreadcrumbs />);
      
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
        
        if (selector.toString().includes('getCurrentCanvas')) {
          return { id: undefined, name: undefined, canvas: undefined };
        }
        
        return selector(mockStore);
      });

      render(<WorkspaceBreadcrumbs />);
      
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
        
        if (selector.toString().includes('getCurrentCanvas')) {
          return { 
            id: 'canvas-1', 
            name: 'Main Canvas', 
            canvas: { name: 'Main Canvas' } 
          };
        }
        
        return selector(mockStore);
      });
    });

    it('renders full breadcrumb hierarchy', () => {
      render(<WorkspaceBreadcrumbs />);
      
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
        
        if (selector.toString().includes('getCurrentCanvas')) {
          return { 
            id: 'canvas-1', 
            name: undefined, 
            canvas: undefined 
          };
        }
        
        return selector(mockStore);
      });

      render(<WorkspaceBreadcrumbs />);
      
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
        
        if (selector.toString().includes('getCurrentCanvas')) {
          return { 
            id: 'canvas-1', 
            name: 'Main Canvas', 
            canvas: { name: 'Main Canvas' } 
          };
        }
        
        return selector(mockStore);
      });

      const { container } = render(<WorkspaceBreadcrumbs />);
      
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
        
        if (selector.toString().includes('getCurrentCanvas')) {
          return { id: undefined, name: undefined, canvas: undefined };
        }
        
        return selector(mockStore);
      });

      const { container } = render(<WorkspaceBreadcrumbs />);
      
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
        
        if (selector.toString().includes('getCurrentCanvas')) {
          return { 
            id: 'canvas-1', 
            name: 'Main Canvas', 
            canvas: { name: 'Main Canvas' } 
          };
        }
        
        return selector(mockStore);
      });
    });

    it('uses semantic nav element with proper label', () => {
      render(<WorkspaceBreadcrumbs />);
      
      const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(nav).toBeInTheDocument();
    });

    it('uses ordered list for breadcrumb structure', () => {
      render(<WorkspaceBreadcrumbs />);
      
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
      expect(list.tagName).toBe('OL');
    });

    it('marks current page with aria-current', () => {
      render(<WorkspaceBreadcrumbs />);
      
      const currentPage = screen.getByText('Main Canvas');
      expect(currentPage).toHaveAttribute('aria-current', 'page');
    });

    it('has accessible link labels', () => {
      render(<WorkspaceBreadcrumbs />);
      
      expect(screen.getByRole('link', { name: 'Navigate to Dashboard' }))
        .toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Navigate to Test Workspace' }))
        .toBeInTheDocument();
    });

    it('hides decorative separators from screen readers', () => {
      const { container } = render(<WorkspaceBreadcrumbs />);
      
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
        
        if (selector.toString().includes('getCurrentCanvas')) {
          return { 
            id: 'canvas-1', 
            name: 'Main Canvas', 
            canvas: { name: 'Main Canvas' } 
          };
        }
        
        return selector(mockStore);
      });
    });

    it('has correct href attributes', () => {
      render(<WorkspaceBreadcrumbs />);
      
      expect(screen.getByRole('link', { name: 'Navigate to Dashboard' }))
        .toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: 'Navigate to Test Workspace' }))
        .toHaveAttribute('href', '/workspace/workspace-1');
    });

    it('applies hover and focus styles to links', () => {
      render(<WorkspaceBreadcrumbs />);
      
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass('hover:text-gray-700', 'focus:text-gray-700', 'transition-colors');
      });
    });
  });
});