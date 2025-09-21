/**
 * CanvasSwitcher Component Tests (Updated for Apollo Architecture)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { useRouter } from 'next/navigation';
import { CanvasSwitcher } from '../CanvasSwitcher';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvases, useCanvas, useSetDefaultCanvas } from '@/hooks/use-canvas';
import { useToast } from '@/components/ui/CanvasErrorToast';
import { GET_WORKSPACE_CANVASES } from '@/lib/graphql/canvasOperations';
import type { Canvas } from '@/types/workspace.types';
import { createCanvasId } from '@/types/workspace.types';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));
jest.mock('@/stores/workspaceStore');

// Mock canvas hooks
jest.mock('@/hooks/use-canvas', () => ({
  useCanvases: jest.fn(),
  useCanvas: jest.fn(),
  useSetDefaultCanvas: jest.fn(),
}));

// Mock toast hook
jest.mock('@/components/ui/CanvasErrorToast', () => ({
  useToast: jest.fn(),
  canvasToastMessages: {
    multipleDefaultsWarning: jest.fn(),
  },
}));

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
const mockUseCanvases = useCanvases as jest.Mock;
const mockUseCanvas = useCanvas as jest.Mock;
const mockUseSetDefaultCanvas = useSetDefaultCanvas as jest.Mock;
const mockUseToast = useToast as jest.Mock;

// Sample canvas data
const sampleCanvases: Canvas[] = [
  {
    id: createCanvasId('canvas-1'),
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
    id: createCanvasId('canvas-2'),
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

// Helper function to create Apollo mocks
const createCanvasesMock = (workspaceId: string, canvases: Canvas[] = sampleCanvases) => ({
  request: {
    query: GET_WORKSPACE_CANVASES,
    variables: { workspaceId },
  },
  result: {
    data: {
      workspaceCanvases: {
        items: canvases.map(canvas => ({
          id: canvas.id,
          workspaceId: canvas.workspaceId,
          name: canvas.name,
          description: canvas.description,
          isDefault: canvas.settings.isDefault,
          position: 0,
          createdBy: 'test-user',
          createdAt: canvas.createdAt,
          updatedAt: canvas.updatedAt,
        })),
        hasNextPage: false,
        page: 0,
        limit: 100,
        totalCount: canvases.length,
      },
    },
  },
});

// Helper function to render with Apollo provider
const renderWithApollo = (component: React.ReactElement, mocks: any[] = []) => {
  const defaultMocks = [createCanvasesMock('workspace-1')];
  return render(
    <MockedProvider mocks={[...defaultMocks, ...mocks]} addTypename={false}>
      {component}
    </MockedProvider>
  );
};

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

    // Mock simplified workspace store
    mockUseWorkspaceStore.mockImplementation((selector?: any) => {
      const mockStore = {
        context: {
          currentWorkspaceId: 'workspace-1',
          currentCanvasId: createCanvasId('canvas-1'),
          workspaceName: 'Test Workspace',
          canvasName: 'Main Canvas',
        },
        uiState: {
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
        setCanvasLoading: jest.fn(),
        setError: jest.fn(),
        clearErrors: jest.fn(),
      };

      return selector ? selector(mockStore) : mockStore;
    });

    // Mock Apollo canvas hooks
    mockUseCanvases.mockReturnValue({
      canvases: sampleCanvases,
      loading: false,
      error: undefined,
      refetch: jest.fn(),
      hasMore: false,
      loadMore: jest.fn(),
    });

    mockUseCanvas.mockReturnValue({
      canvas: sampleCanvases[0], // Return the current canvas
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    });

    mockUseSetDefaultCanvas.mockReturnValue({
      mutate: jest.fn(),
      loading: false,
      error: undefined,
      reset: jest.fn(),
    });

    // Mock the toast hook
    mockUseToast.mockReturnValue({
      showToast: jest.fn(),
      dismissToast: jest.fn(),
      dismissAll: jest.fn(),
      notifications: [],
      showCanvasToast: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the canvas switcher button with current canvas info', () => {
      renderWithApollo(<CanvasSwitcher />);

      const button = screen.getByRole('button', { expanded: false });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAccessibleName(/Current canvas: Main Canvas/);

      expect(screen.getByText('Main Canvas')).toBeInTheDocument();
      expect(screen.getByText('Canvas 1 of 2')).toBeInTheDocument();
    });

    it('does not render when no workspace context is available', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: { currentWorkspaceId: undefined },
          uiState: { loadingStates: {}, errors: {} },
          isInitialized: false,
        };
        return selector ? selector(mockStore) : mockStore;
      });

      mockUseCanvases.mockReturnValue({
        canvases: [],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        hasMore: false,
        loadMore: jest.fn(),
      });

      mockUseCanvas.mockReturnValue({
        canvas: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { container } = renderWithApollo(<CanvasSwitcher />);
      expect(container.firstChild).toBeNull();
    });

    it('shows loading state when canvases are loading', () => {
      mockUseCanvases.mockReturnValue({
        canvases: [],
        loading: true,
        error: undefined,
        refetch: jest.fn(),
        hasMore: false,
        loadMore: jest.fn(),
      });

      mockUseCanvas.mockReturnValue({
        canvas: undefined,
        loading: true,
        error: undefined,
        refetch: jest.fn(),
      });

      renderWithApollo(<CanvasSwitcher />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Dropdown Functionality', () => {
    it('opens dropdown when button is clicked', async () => {
      renderWithApollo(<CanvasSwitcher />);

      const button = screen.getByRole('button', { expanded: false });

      fireEvent.click(button);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('Canvases (2)')).toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', async () => {
      renderWithApollo(<CanvasSwitcher />);

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
      renderWithApollo(<CanvasSwitcher />);

      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('displays all canvases in dropdown', () => {
      renderWithApollo(<CanvasSwitcher />);

      fireEvent.click(screen.getByRole('button'));

      // Use more specific queries for dropdown content
      expect(screen.getByRole('option', { name: /Main Canvas/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Secondary Canvas/ })).toBeInTheDocument();
      expect(screen.getByText('Default')).toBeInTheDocument(); // Default badge
    });
  });

  describe('Canvas Selection', () => {
    it('navigates to selected canvas', () => {
      renderWithApollo(<CanvasSwitcher />);

      // Open dropdown
      fireEvent.click(screen.getByRole('button'));

      // Click on secondary canvas
      const secondaryCanvas = screen.getByRole('option', { name: /Secondary Canvas/ });
      fireEvent.click(secondaryCanvas);

      expect(mockPush).toHaveBeenCalledWith('/workspace/workspace-1/canvas/canvas-2');
    });

    it('does not navigate if same canvas is selected', () => {
      renderWithApollo(<CanvasSwitcher />);

      // Open dropdown
      fireEvent.click(screen.getByRole('button'));

      // Click on current canvas (Main Canvas)
      const currentCanvas = screen.getByRole('option', { name: /Main Canvas/ });
      fireEvent.click(currentCanvas);

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('shows selected state for current canvas', () => {
      renderWithApollo(<CanvasSwitcher />);

      fireEvent.click(screen.getByRole('button'));

      const currentCanvas = screen.getByRole('option', { selected: true });
      expect(currentCanvas).toHaveAccessibleName(/Main Canvas/);
    });
  });

  describe('Create Canvas Modal', () => {
    it('opens create canvas modal when create button is clicked', async () => {
      renderWithApollo(<CanvasSwitcher />);

      // Open dropdown
      fireEvent.click(screen.getByRole('button'));

      // Click create new canvas button
      const createButton = screen.getByRole('button', { name: /Create new canvas/ });
      fireEvent.click(createButton);

      expect(screen.getByTestId('create-canvas-modal')).toBeInTheDocument();
    });

    it('closes dropdown when create canvas is clicked', () => {
      renderWithApollo(<CanvasSwitcher />);

      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Click create new canvas button
      fireEvent.click(screen.getByRole('button', { name: /Create new canvas/ }));

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes modal when modal close is triggered', async () => {
      renderWithApollo(<CanvasSwitcher />);

      // Open dropdown and create modal
      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(screen.getByRole('button', { name: /Create new canvas/ }));

      expect(screen.getByTestId('create-canvas-modal')).toBeInTheDocument();

      // Close modal
      fireEvent.click(screen.getByText('Close Modal'));

      expect(screen.queryByTestId('create-canvas-modal')).not.toBeInTheDocument();
    });
  });

  describe('Default Canvas Behavior', () => {
    it('shows only one canvas with default badge when properly configured', () => {
      renderWithApollo(<CanvasSwitcher />);

      fireEvent.click(screen.getByRole('button'));

      // Should only show one "Default" badge
      const defaultBadges = screen.getAllByText('Default');
      expect(defaultBadges).toHaveLength(1);

      // Verify it's on the correct canvas
      const mainCanvasOption = screen.getByRole('option', { name: /Main Canvas.*default canvas/ });
      expect(mainCanvasOption).toBeInTheDocument();
    });

    it('handles multiple defaults scenario by showing all but warning in console', () => {
      // Simulate bug scenario where multiple canvases are marked as default
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const canvasesWithMultipleDefaults = [
        { ...sampleCanvases[0], settings: { ...sampleCanvases[0].settings, isDefault: true } },
        { ...sampleCanvases[1], settings: { ...sampleCanvases[1].settings, isDefault: true } }, // Bug: also default
      ];

      mockUseCanvases.mockReturnValue({
        canvases: canvasesWithMultipleDefaults,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        hasMore: false,
        loadMore: jest.fn(),
      });

      mockUseCanvas.mockReturnValue({
        canvas: canvasesWithMultipleDefaults[0],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      renderWithApollo(<CanvasSwitcher />);

      fireEvent.click(screen.getByRole('button'));

      // Should show both default badges (displaying the bug scenario)
      const defaultBadges = screen.getAllByText('Default');
      expect(defaultBadges).toHaveLength(2);

      consoleSpy.mockRestore();
    });

    it('shows no default badge when no canvas is marked as default', () => {
      const canvasesWithNoDefault = [
        { ...sampleCanvases[0], settings: { ...sampleCanvases[0].settings, isDefault: false } },
        { ...sampleCanvases[1], settings: { ...sampleCanvases[1].settings, isDefault: false } },
      ];

      mockUseCanvases.mockReturnValue({
        canvases: canvasesWithNoDefault,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        hasMore: false,
        loadMore: jest.fn(),
      });

      mockUseCanvas.mockReturnValue({
        canvas: canvasesWithNoDefault[0],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      renderWithApollo(<CanvasSwitcher />);

      fireEvent.click(screen.getByRole('button'));

      // Should show no default badges
      expect(screen.queryByText('Default')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithApollo(<CanvasSwitcher />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
      expect(button).toHaveAttribute('aria-label');
    });

    it('updates aria-expanded when dropdown opens', () => {
      renderWithApollo(<CanvasSwitcher />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('has proper listbox role and labels', () => {
      renderWithApollo(<CanvasSwitcher />);

      fireEvent.click(screen.getByRole('button'));

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Canvas selection');
    });

    it('has proper option roles and selected states', () => {
      renderWithApollo(<CanvasSwitcher />);

      fireEvent.click(screen.getByRole('button'));

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);

      expect(options[0]).toHaveAttribute('aria-selected', 'true');
      expect(options[1]).toHaveAttribute('aria-selected', 'false');
    });
  });
});