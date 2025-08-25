/**
 * Workspace Components Integration Tests
 * 
 * Tests the core functionality and integration between workspace components
 * without getting caught up in detailed CSS class assertions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceLayout } from '../WorkspaceLayout';
import { WorkspaceHeader } from '../WorkspaceHeader';
import { WorkspaceBreadcrumbs } from '../WorkspaceBreadcrumbs';
import { CanvasSwitcher } from '../CanvasSwitcher';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuth } from '@/hooks/use-auth';

// Mock dependencies
jest.mock('@/stores/workspaceStore');
jest.mock('@/hooks/use-auth');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Mock child components for integration testing
jest.mock('../CanvasSwitcher', () => ({
  CanvasSwitcher: () => <div data-testid="canvas-switcher">Canvas Switcher</div>,
}));

jest.mock('../CreateCanvasModal', () => ({
  CreateCanvasModal: ({ isOpen }: any) => 
    isOpen ? <div data-testid="create-modal">Create Modal</div> : null,
}));

const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('Workspace Components Integration', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { 
        name: 'Test User', 
        email: 'test@example.com',
        sub: 'auth0|123',
      },
      login: jest.fn(),
      logout: jest.fn(),
      checkPermission: jest.fn().mockReturnValue(true),
      hasRole: jest.fn().mockReturnValue(true),
      refreshUser: jest.fn(),
      announceAuthStatus: jest.fn(),
      isLoading: false,
      isAuthenticated: true,
    });

    mockUseWorkspaceStore.mockImplementation((selector?: any) => {
      const mockStore = {
        context: {
          currentWorkspaceId: 'workspace-1',
          currentCanvasId: 'canvas-1',
          workspaceName: 'Test Workspace',
          canvasName: 'Test Canvas',
        },
        canvasManagement: {
          canvases: new Map([
            ['canvas-1', { id: 'canvas-1', name: 'Canvas 1' }],
            ['canvas-2', { id: 'canvas-2', name: 'Canvas 2' }],
          ]),
        },
      };

      if (!selector) return mockStore;
      
      if (selector.toString().includes('getCurrentCanvas')) {
        return {
          id: 'canvas-1',
          name: 'Test Canvas',
          canvas: { name: 'Test Canvas' },
        };
      }
      
      if (selector.toString().includes('getCanvasCount')) {
        return 2;
      }
      
      return selector(mockStore);
    });
  });

  describe('WorkspaceLayout Integration', () => {
    it('renders complete workspace layout with header and breadcrumbs', () => {
      render(
        <WorkspaceLayout>
          <div data-testid="canvas-content">Canvas Content</div>
        </WorkspaceLayout>
      );

      // Check main structure elements are present
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByTestId('canvas-content')).toBeInTheDocument();
    });
  });

  describe('WorkspaceHeader Integration', () => {
    it('displays project branding and user information', () => {
      render(<WorkspaceHeader />);

      expect(screen.getByText('Project Nexus')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Logout/ })).toBeInTheDocument();
    });

    it('shows canvas switcher when workspace context exists', () => {
      render(<WorkspaceHeader />);
      expect(screen.getByTestId('canvas-switcher')).toBeInTheDocument();
    });

    it('calls logout when logout button is clicked', () => {
      const mockLogout = jest.fn();
      mockUseAuth.mockReturnValue({
        user: { 
          name: 'Test User', 
          email: 'test@example.com',
          sub: 'auth0|123',
        },
        login: jest.fn(),
        logout: mockLogout,
        checkPermission: jest.fn().mockReturnValue(true),
        hasRole: jest.fn().mockReturnValue(true),
        refreshUser: jest.fn(),
        announceAuthStatus: jest.fn(),
        isLoading: false,
        isAuthenticated: true,
      });

      render(<WorkspaceHeader />);
      
      fireEvent.click(screen.getByRole('button', { name: /Logout/ }));
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('WorkspaceBreadcrumbs Integration', () => {
    it('renders breadcrumb navigation with proper hierarchy', () => {
      render(<WorkspaceBreadcrumbs />);

      const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(nav).toBeInTheDocument();

      // Check breadcrumb items
      expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Test Workspace/ })).toBeInTheDocument();
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });

    it('handles workspace-only context correctly', () => {
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

      render(<WorkspaceBreadcrumbs />);

      expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
      expect(screen.queryByText('Test Canvas')).not.toBeInTheDocument();
    });
  });

  describe('Error Boundaries', () => {
    it('gracefully handles missing workspace context', () => {
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
        
        if (selector.toString().includes('getCanvasCount')) {
          return 0;
        }
        
        return selector(mockStore);
      });

      // WorkspaceBreadcrumbs should not render without workspace context
      const { container: breadcrumbContainer } = render(<WorkspaceBreadcrumbs />);
      expect(breadcrumbContainer.firstChild).toBeNull();

      // WorkspaceHeader should render but without canvas switcher
      render(<WorkspaceHeader />);
      expect(screen.getByText('Project Nexus')).toBeInTheDocument();
      expect(screen.queryByTestId('canvas-switcher')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('maintains proper semantic structure across components', () => {
      render(
        <WorkspaceLayout>
          <div>Test Content</div>
        </WorkspaceLayout>
      );

      // Check semantic structure
      expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
      expect(screen.getByRole('navigation')).toBeInTheDocument(); // Breadcrumbs
      expect(screen.getByRole('main')).toBeInTheDocument(); // Main content
    });

    it('provides proper navigation labels and descriptions', () => {
      render(<WorkspaceBreadcrumbs />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('aria-label');
      });
    });
  });
});