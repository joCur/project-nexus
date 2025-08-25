/**
 * CanvasSwitcher Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { CanvasSwitcher } from '../CanvasSwitcher';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Canvas } from '@/types/workspace.types';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));
jest.mock('@/stores/workspaceStore');

// Mock CreateCanvasModal
jest.mock('../CreateCanvasModal', () => ({
  CreateCanvasModal: ({ isOpen, onClose, workspaceId }: any) => 
    isOpen ? (
      <div data-testid="create-canvas-modal">
        <div>Create Canvas Modal for workspace: {workspaceId}</div>
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.Mock;
const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>;

// Sample canvas data
const sampleCanvases: Canvas[] = [
  {
    id: 'canvas-1' as any,
    workspaceId: 'workspace-1',
    name: 'Main Canvas',
    description: 'Primary workspace canvas',
    settings: {
      isDefault: true,
      position: { x: 0, y: 0, z: 0 },
      zoom: 1.0,
      grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
      background: { type: 'COLOR', color: '#ffffff', opacity: 1.0 },
    },
    status: 'active',
    priority: 'normal',
    tags: [],
    metadata: {},
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    version: 1,
  },
  {
    id: 'canvas-2' as any,
    workspaceId: 'workspace-1',
    name: 'Secondary Canvas',
    description: 'Additional canvas for projects',
    settings: {
      isDefault: false,
      position: { x: 0, y: 0, z: 0 },
      zoom: 1.0,
      grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
      background: { type: 'COLOR', color: '#ffffff', opacity: 1.0 },
    },
    status: 'active',
    priority: 'normal',
    tags: [],
    metadata: {},
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    version: 1,
  },
];

describe('CanvasSwitcher', () => {
  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    });

    // Create a mock store implementation
    const mockStore = {
      context: {
        currentWorkspaceId: 'workspace-1',
        currentCanvasId: 'canvas-1',
        workspaceName: 'Test Workspace',
        canvasName: 'Main Canvas',
      },
      canvasManagement: {
        canvases: new Map(sampleCanvases.map(c => [c.id, c])),
        defaultCanvasId: 'canvas-1' as any,
        loadingStates: {
          fetchingCanvases: false,
          creatingCanvas: false,
          updatingCanvas: false,
          deletingCanvas: false,
          settingDefault: false,
          duplicatingCanvas: false,
        },
        errors: {
          fetchError: undefined,
          mutationError: undefined,
        },
      },
      isInitialized: true,
      setCurrentWorkspace: jest.fn(),
      setCurrentCanvas: jest.fn(),
      switchCanvas: jest.fn(),
      clearContext: jest.fn(),
      createCanvas: jest.fn(),
      updateCanvas: jest.fn(),
      deleteCanvas: jest.fn(),
      duplicateCanvas: jest.fn(),
      setDefaultCanvas: jest.fn(),
      loadWorkspaceCanvases: jest.fn(),
      refreshCanvases: jest.fn(),
      updateCanvasSettings: jest.fn(),
      saveCurrentViewport: jest.fn(),
      getCanvas: jest.fn(),
      getDefaultCanvas: jest.fn(),
      getCurrentCanvas: jest.fn(),
      getCanvasesByFilter: jest.fn(),
      clearErrors: jest.fn(),
      setError: jest.fn(),
    };

    mockUseWorkspaceStore.mockImplementation((selector?: any) => {
      if (!selector) return mockStore;
      
      // Handle different selectors
      if (selector.toString().includes('getAllCanvases')) {
        return Array.from(mockStore.canvasManagement.canvases.values());
      }
      if (selector.toString().includes('getCurrentCanvas')) {
        return {
          id: mockStore.context.currentCanvasId,
          name: mockStore.context.canvasName,
          canvas: sampleCanvases.find(c => c.id === mockStore.context.currentCanvasId) || sampleCanvases[0],
        };
      }
      if (selector.toString().includes('getCanvasCount')) {
        return mockStore.canvasManagement.canvases.size;
      }
      if (selector.toString().includes('isLoading')) {
        return false;
      }
      
      return selector(mockStore);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the canvas switcher button with current canvas info', () => {
      render(<CanvasSwitcher />);
      
      const button = screen.getByRole('button', { expanded: false });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAccessibleName(/Current canvas: Main Canvas/);
      
      expect(screen.getByText('Main Canvas')).toBeInTheDocument();
      expect(screen.getByText('Canvas 1 of 2')).toBeInTheDocument();
    });

    it('does not render when no workspace context is available', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        if (selector?.toString().includes('getCurrentCanvas')) {
          return {
            id: undefined,
            name: undefined,
            canvas: undefined,
          };
        }
        if (selector?.toString().includes('getAllCanvases')) {
          return [];
        }
        if (selector?.toString().includes('getCanvasCount')) {
          return 0;
        }
        if (selector?.toString().includes('isLoading')) {
          return false;
        }
        
        const mockStore = {
          context: { currentWorkspaceId: undefined },
        };
        return selector ? selector(mockStore) : mockStore;
      });

      const { container } = render(<CanvasSwitcher />);
      expect(container.firstChild).toBeNull();
    });

    it('shows loading state when canvases are loading', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: { 
            currentWorkspaceId: 'workspace-1', 
            currentCanvasId: 'canvas-1',
            workspaceName: 'Test Workspace',
            canvasName: 'Main Canvas'
          },
        };

        if (!selector) return mockStore;

        if (selector?.toString().includes('isLoading')) {
          return true;
        }
        if (selector?.toString().includes('getCurrentCanvas')) {
          return {
            id: 'canvas-1',
            name: 'Main Canvas',
            canvas: sampleCanvases[0],
          };
        }
        if (selector?.toString().includes('getAllCanvases')) {
          return sampleCanvases;
        }
        if (selector?.toString().includes('getCanvasCount')) {
          return 2;
        }
        
        return selector(mockStore);
      });

      render(<CanvasSwitcher />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Dropdown Functionality', () => {
    it('opens dropdown when button is clicked', async () => {
      render(<CanvasSwitcher />);
      
      const button = screen.getByRole('button', { expanded: false });
      
      fireEvent.click(button);
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('Canvases (2)')).toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', async () => {
      render(<CanvasSwitcher />);
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      
      // Click outside
      fireEvent.mouseDown(document.body);
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('closes dropdown when Escape key is pressed', async () => {
      render(<CanvasSwitcher />);
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      
      // Press Escape
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
      
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('displays all canvases in dropdown', () => {
      render(<CanvasSwitcher />);
      
      fireEvent.click(screen.getByRole('button'));
      
      // Use more specific queries for dropdown content
      expect(screen.getByRole('option', { name: /Main Canvas/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Secondary Canvas/ })).toBeInTheDocument();
      expect(screen.getByText('Default')).toBeInTheDocument(); // Default badge
    });
  });

  describe('Canvas Selection', () => {
    it('navigates to selected canvas', () => {
      render(<CanvasSwitcher />);
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      // Click on secondary canvas
      const secondaryCanvas = screen.getByRole('option', { name: /Secondary Canvas/ });
      fireEvent.click(secondaryCanvas);
      
      expect(mockPush).toHaveBeenCalledWith('/workspace/workspace-1/canvas/canvas-2');
    });

    it('does not navigate if same canvas is selected', () => {
      render(<CanvasSwitcher />);
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      // Click on current canvas (Main Canvas)
      const currentCanvas = screen.getByRole('option', { name: /Main Canvas/ });
      fireEvent.click(currentCanvas);
      
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('shows selected state for current canvas', () => {
      render(<CanvasSwitcher />);
      
      fireEvent.click(screen.getByRole('button'));
      
      const currentCanvas = screen.getByRole('option', { selected: true });
      expect(currentCanvas).toHaveAccessibleName(/Main Canvas/);
    });
  });

  describe('Create Canvas Modal', () => {
    it('opens create canvas modal when create button is clicked', async () => {
      render(<CanvasSwitcher />);
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      // Click create new canvas button
      const createButton = screen.getByRole('button', { name: /Create new canvas/ });
      fireEvent.click(createButton);
      
      expect(screen.getByTestId('create-canvas-modal')).toBeInTheDocument();
    });

    it('closes dropdown when create canvas is clicked', () => {
      render(<CanvasSwitcher />);
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      
      // Click create new canvas button
      fireEvent.click(screen.getByRole('button', { name: /Create new canvas/ }));
      
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes modal when modal close is triggered', async () => {
      render(<CanvasSwitcher />);
      
      // Open dropdown and create modal
      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(screen.getByRole('button', { name: /Create new canvas/ }));
      
      expect(screen.getByTestId('create-canvas-modal')).toBeInTheDocument();
      
      // Close modal
      fireEvent.click(screen.getByText('Close Modal'));
      
      expect(screen.queryByTestId('create-canvas-modal')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<CanvasSwitcher />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
      expect(button).toHaveAttribute('aria-label');
    });

    it('updates aria-expanded when dropdown opens', () => {
      render(<CanvasSwitcher />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('has proper listbox role and labels', () => {
      render(<CanvasSwitcher />);
      
      fireEvent.click(screen.getByRole('button'));
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Canvas selection');
    });

    it('has proper option roles and selected states', () => {
      render(<CanvasSwitcher />);
      
      fireEvent.click(screen.getByRole('button'));
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
      expect(options[1]).toHaveAttribute('aria-selected', 'false');
    });
  });
});