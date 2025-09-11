/**
 * WorkspaceHeader Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceHeader } from '../WorkspaceHeader';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Mock dependencies
jest.mock('@/hooks/use-auth');
jest.mock('@/stores/workspaceStore');

// Mock CanvasSwitcher component
jest.mock('../CanvasSwitcher', () => ({
  CanvasSwitcher: () => <div data-testid="canvas-switcher">Canvas Switcher</div>,
}));

const mockLogout = jest.fn();
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>;

describe('WorkspaceHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth hook
    mockUseAuth.mockReturnValue({
      user: {
        sub: 'auth0|123456',
        name: 'John Doe',
        email: 'john.doe@example.com',
        picture: 'https://example.com/avatar.jpg',
      },
      login: jest.fn(),
      logout: mockLogout,
      checkPermission: jest.fn().mockReturnValue(true),
      hasAnyPermission: jest.fn().mockReturnValue(true),
      hasAllPermissions: jest.fn().mockReturnValue(true),
      hasRole: jest.fn().mockReturnValue(true),
      createPermissionChecker: jest.fn().mockReturnValue({
        hasPermission: jest.fn().mockReturnValue(true),
        hasAnyPermission: jest.fn().mockReturnValue(true),
        hasAllPermissions: jest.fn().mockReturnValue(true),
      }),
      refreshUser: jest.fn(),
      announceAuthStatus: jest.fn(),
      isLoading: false,
      isAuthenticated: true,
    });

    // Mock workspace store
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
      
      if (selector.toString().includes('getCanvasCount')) {
        return 2;
      }
      
      return selector(mockStore);
    });
  });

  describe('Rendering', () => {
    it('renders the header with project branding', () => {
      render(<WorkspaceHeader />);
      
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Project Nexus' })).toBeInTheDocument();
    });

    it('displays workspace name when available', () => {
      render(<WorkspaceHeader />);
      
      // Should find at least one instance of the workspace name (desktop or mobile view)
      expect(screen.getAllByText('Test Workspace')).toHaveLength(2);
    });

    it('shows default workspace name when none provided', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            workspaceName: undefined,
          },
        };
        
        if (!selector) return mockStore;
        if (selector.toString().includes('getCanvasCount')) return 0;
        return selector(mockStore);
      });

      render(<WorkspaceHeader />);
      
      // Should find at least one instance of the default workspace name (desktop or mobile view)
      expect(screen.getAllByText('Knowledge Workspace')).toHaveLength(2);
    });

    it('renders canvas switcher when workspace context exists', () => {
      render(<WorkspaceHeader />);
      
      expect(screen.getByTestId('canvas-switcher')).toBeInTheDocument();
    });

    it('does not render canvas switcher without workspace context', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: undefined,
          },
        };
        
        if (!selector) return mockStore;
        if (selector.toString().includes('getCanvasCount')) return 0;
        return selector(mockStore);
      });

      render(<WorkspaceHeader />);
      
      expect(screen.queryByTestId('canvas-switcher')).not.toBeInTheDocument();
    });

    it('displays canvas count when available', () => {
      render(<WorkspaceHeader />);
      
      expect(screen.getByText('2 canvases')).toBeInTheDocument();
    });

    it('handles singular canvas count correctly', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            workspaceName: 'Test Workspace',
          },
        };
        
        if (!selector) return mockStore;
        if (selector.toString().includes('getCanvasCount')) return 1;
        return selector(mockStore);
      });

      render(<WorkspaceHeader />);
      
      expect(screen.getByText('1 canvas')).toBeInTheDocument();
    });

    it('hides canvas count when none exist', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            workspaceName: 'Test Workspace',
          },
        };
        
        if (!selector) return mockStore;
        if (selector.toString().includes('getCanvasCount')) return 0;
        return selector(mockStore);
      });

      render(<WorkspaceHeader />);
      
      expect(screen.queryByText(/canvas/)).not.toBeInTheDocument();
    });
  });

  describe('User Profile Section', () => {
    it('displays user profile picture when available', () => {
      render(<WorkspaceHeader />);
      
      const avatar = screen.getByRole('img', { name: /Profile picture for John Doe/ });
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('uses fallback alt text when user has no name', () => {
      mockUseAuth.mockReturnValue({
        user: {
          sub: 'auth0|123456',
          email: 'test@example.com',
          picture: 'https://example.com/avatar.jpg',
        },
        login: jest.fn(),
        logout: mockLogout,
        checkPermission: jest.fn().mockReturnValue(true),
        hasAnyPermission: jest.fn().mockReturnValue(true),
        hasAllPermissions: jest.fn().mockReturnValue(true),
        hasRole: jest.fn().mockReturnValue(true),
        createPermissionChecker: jest.fn().mockReturnValue({
          hasPermission: jest.fn().mockReturnValue(true),
          hasAnyPermission: jest.fn().mockReturnValue(true),
          hasAllPermissions: jest.fn().mockReturnValue(true),
        }),
        refreshUser: jest.fn(),
        announceAuthStatus: jest.fn(),
        isLoading: false,
        isAuthenticated: true,
      });

      render(<WorkspaceHeader />);
      
      const avatar = screen.getByRole('img', { name: /Profile picture for test@example.com/ });
      expect(avatar).toBeInTheDocument();
    });

    it('does not render profile picture when none available', () => {
      mockUseAuth.mockReturnValue({
        user: {
          sub: 'auth0|123456',
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        login: jest.fn(),
        logout: mockLogout,
        checkPermission: jest.fn().mockReturnValue(true),
        hasAnyPermission: jest.fn().mockReturnValue(true),
        hasAllPermissions: jest.fn().mockReturnValue(true),
        hasRole: jest.fn().mockReturnValue(true),
        createPermissionChecker: jest.fn().mockReturnValue({
          hasPermission: jest.fn().mockReturnValue(true),
          hasAnyPermission: jest.fn().mockReturnValue(true),
          hasAllPermissions: jest.fn().mockReturnValue(true),
        }),
        refreshUser: jest.fn(),
        announceAuthStatus: jest.fn(),
        isLoading: false,
        isAuthenticated: true,
      });

      render(<WorkspaceHeader />);
      
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('displays user name and email', () => {
      render(<WorkspaceHeader />);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });

    it('shows fallback name when user name is not available', () => {
      mockUseAuth.mockReturnValue({
        user: {
          sub: 'auth0|123456',
          email: 'john.doe@example.com',
        },
        login: jest.fn(),
        logout: mockLogout,
        checkPermission: jest.fn().mockReturnValue(true),
        hasAnyPermission: jest.fn().mockReturnValue(true),
        hasAllPermissions: jest.fn().mockReturnValue(true),
        hasRole: jest.fn().mockReturnValue(true),
        createPermissionChecker: jest.fn().mockReturnValue({
          hasPermission: jest.fn().mockReturnValue(true),
          hasAnyPermission: jest.fn().mockReturnValue(true),
          hasAllPermissions: jest.fn().mockReturnValue(true),
        }),
        refreshUser: jest.fn(),
        announceAuthStatus: jest.fn(),
        isLoading: false,
        isAuthenticated: true,
      });

      render(<WorkspaceHeader />);
      
      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });
  });

  describe('Logout Functionality', () => {
    it('renders logout button', () => {
      render(<WorkspaceHeader />);
      
      const logoutButton = screen.getByRole('button', { name: 'Logout from Project Nexus' });
      expect(logoutButton).toBeInTheDocument();
    });

    it('calls logout function when logout button is clicked', () => {
      render(<WorkspaceHeader />);
      
      const logoutButton = screen.getByRole('button', { name: 'Logout from Project Nexus' });
      fireEvent.click(logoutButton);
      
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Responsive Design', () => {
    it('hides user info on small screens', () => {
      render(<WorkspaceHeader />);
      
      // User info should have sm:block class (hidden on small screens)
      const userInfo = screen.getByText('John Doe').parentElement;
      expect(userInfo).toHaveClass('hidden', 'sm:block');
    });

    it('shows mobile workspace info section', () => {
      render(<WorkspaceHeader />);
      
      // Find the mobile section by its parent div with sm:hidden class
      const mobileSections = document.querySelectorAll('.sm\\:hidden');
      const mobileSection = Array.from(mobileSections).find(section => 
        section.textContent?.includes('Test Workspace')
      );
      expect(mobileSection).toHaveClass('sm:hidden');
    });

    it('hides workspace name on small screens in main header', () => {
      render(<WorkspaceHeader />);
      
      // Find the main header workspace name (not the mobile one)
      const hiddenElements = document.querySelectorAll('.hidden.sm\\:block');
      const mainWorkspaceElement = Array.from(hiddenElements).find(el => 
        el.textContent?.includes('Test Workspace')
      );
      expect(mainWorkspaceElement).toHaveClass('hidden', 'sm:block');
    });

    it('hides canvas count on medium screens', () => {
      render(<WorkspaceHeader />);
      
      // Find element with canvas count and lg:block class
      const hiddenLgElements = document.querySelectorAll('.hidden.lg\\:block');
      const canvasCountElement = Array.from(hiddenLgElements).find(el => 
        el.textContent?.includes('canvases')
      );
      expect(canvasCountElement).toHaveClass('hidden', 'lg:block');
    });
  });

  describe('Accessibility', () => {
    it('uses semantic header element', () => {
      render(<WorkspaceHeader />);
      
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('has proper heading hierarchy', () => {
      render(<WorkspaceHeader />);
      
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Project Nexus');
    });

    it('has accessible button labels', () => {
      render(<WorkspaceHeader />);
      
      expect(screen.getByRole('button', { name: 'Logout from Project Nexus' }))
        .toBeInTheDocument();
    });

    it('has accessible image alt text', () => {
      render(<WorkspaceHeader />);
      
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAccessibleName('Profile picture for John Doe');
    });
  });

  describe('Layout Structure', () => {
    it('has proper CSS classes for layout', () => {
      const { container } = render(<WorkspaceHeader />);
      
      const header = container.querySelector('header');
      expect(header).toHaveClass('flex-none', 'bg-white', 'shadow-sm', 'border-b', 'border-gray-200');
    });

    it('maintains proper spacing and alignment', () => {
      render(<WorkspaceHeader />);
      
      const headerContent = screen.getByRole('banner').querySelector('.px-4');
      expect(headerContent).toHaveClass('px-4', 'sm:px-6', 'lg:px-8');
      
      const flexContainer = headerContent?.querySelector('.flex');
      expect(flexContainer).toHaveClass('flex', 'items-center', 'justify-between', 'h-14');
    });
  });
});