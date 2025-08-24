/**
 * Multi-Canvas Accessibility Tests (NEX-177)
 * 
 * Comprehensive accessibility testing and WCAG 2.1 AA compliance verification including:
 * - Screen reader navigation
 * - Keyboard-only navigation
 * - Focus management
 * - ARIA compliance
 * - Color contrast and visual accessibility
 * - Alternative text and descriptions
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MockedProvider } from '@apollo/client/testing';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Import components
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import CanvasSwitcher from '@/components/workspace/CanvasSwitcher';
import CreateCanvasModal from '@/components/workspace/CreateCanvasModal';
import WorkspaceHeader from '@/components/workspace/WorkspaceHeader';
import WorkspaceBreadcrumbs from '@/components/workspace/WorkspaceBreadcrumbs';
import { InfiniteCanvas } from '@/components/canvas';

// Import GraphQL operations
import {
  GET_WORKSPACE_CANVASES,
  GET_CANVAS,
} from '@/lib/graphql/canvasOperations';

// Import stores
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvasStore } from '@/stores/canvasStore';

// Import types
import type { EntityId } from '@/types/common.types';
import type { CanvasId } from '@/types/workspace.types';

// Mock stores
jest.mock('@/stores/workspaceStore');
jest.mock('@/stores/canvasStore');

// Mock navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useParams: () => ({
    workspaceId: 'test-workspace-id',
    canvasId: 'test-canvas-id',
  }),
}));

describe('Multi-Canvas Accessibility Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  // Test data
  const mockWorkspace = {
    id: 'test-workspace-id' as EntityId,
    name: 'Accessibility Test Workspace',
    ownerId: 'user-1' as EntityId,
  };

  const mockCanvases = [
    {
      id: 'canvas-1' as CanvasId,
      workspaceId: mockWorkspace.id,
      name: 'Main Canvas',
      description: 'Primary workspace canvas',
      settings: {
        isDefault: true,
        position: { x: 0, y: 0, z: 0 },
        zoom: 1.0,
        grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
        background: { type: 'COLOR' as const, color: '#ffffff', opacity: 1.0 },
      },
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
    {
      id: 'canvas-2' as CanvasId,
      workspaceId: mockWorkspace.id,
      name: 'Design Canvas',
      description: 'Canvas for design work',
      settings: {
        isDefault: false,
        position: { x: 0, y: 0, z: 0 },
        zoom: 1.0,
        grid: { enabled: false, size: 20, color: '#e5e7eb', opacity: 0.3 },
        background: { type: 'COLOR' as const, color: '#f8f9fa', opacity: 1.0 },
      },
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  ];

  const mockCards = [
    {
      id: 'card-1' as EntityId,
      canvasId: mockCanvases[0].id,
      workspaceId: mockWorkspace.id,
      type: 'NOTE' as const,
      title: 'Important Note',
      content: 'This is an important note for testing accessibility features.',
      position: { x: 100, y: 100, z: 0 },
      size: { width: 200, height: 150 },
      style: {
        backgroundColor: '#ffffff',
        textColor: '#000000',
        borderColor: '#e5e7eb',
        borderWidth: 1,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  ];

  beforeEach(() => {
    user = userEvent.setup({ delay: null });

    // Setup default store mocks
    const mockWorkspaceStore = {
      currentWorkspace: mockWorkspace,
      canvasManagement: {
        canvases: new Map(mockCanvases.map(c => [c.id, c])),
        currentCanvasId: mockCanvases[0].id,
      },
      getCanvases: jest.fn().mockReturnValue(mockCanvases),
      getCurrentCanvas: jest.fn().mockReturnValue(mockCanvases[0]),
      switchToCanvas: jest.fn(),
      createCanvas: jest.fn(),
    };

    const mockCanvasStore = {
      cards: new Map(mockCards.map(c => [c.id, c])),
      getCards: jest.fn().mockReturnValue(mockCards),
      loadCanvasData: jest.fn(),
    };

    (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);
    (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createWrapper = (mocks: any[] = []) => {
    return ({ children }: { children: React.ReactNode }) => (
      <BrowserRouter>
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      </BrowserRouter>
    );
  };

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations in workspace layout', async () => {
      const mocks = [
        {
          request: {
            query: GET_WORKSPACE_CANVASES,
            variables: { workspaceId: mockWorkspace.id },
          },
          result: {
            data: {
              workspaceCanvases: {
                items: mockCanvases,
                totalCount: 2,
                page: 0,
                limit: 50,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            },
          },
        },
      ];

      const wrapper = createWrapper(mocks);
      const { container } = render(
        <WorkspaceLayout>
          <CanvasSwitcher />
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('Main Canvas')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in canvas switcher', async () => {
      const wrapper = createWrapper([]);
      const { container } = render(<CanvasSwitcher />, { wrapper });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in create canvas modal', async () => {
      const wrapper = createWrapper([]);
      const { container } = render(<CreateCanvasModal />, { wrapper });

      // Open modal
      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in workspace header and breadcrumbs', async () => {
      const wrapper = createWrapper([]);
      const { container } = render(
        <>
          <WorkspaceHeader />
          <WorkspaceBreadcrumbs />
        </>,
        { wrapper }
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Screen Reader Navigation', () => {
    it('should provide proper screen reader labels for canvas switcher', async () => {
      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      // Canvas switcher should have proper label
      const switcher = screen.getByRole('combobox');
      expect(switcher).toHaveAccessibleName(/select canvas/i);
      expect(switcher).toHaveAccessibleDescription(/choose which canvas to work on/i);

      // Should announce current selection
      expect(switcher).toHaveValue('Main Canvas');
    });

    it('should provide descriptive labels for canvas operations', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Create canvas button
      const createButton = screen.getByRole('button', { name: /create new canvas/i });
      expect(createButton).toHaveAccessibleDescription(/add a new canvas to this workspace/i);

      // Canvas options button
      const optionsButton = screen.getByRole('button', { name: /canvas options/i });
      expect(optionsButton).toHaveAccessibleDescription(/manage canvas settings and actions/i);

      await user.click(optionsButton);

      // Menu items should have clear labels
      const editOption = screen.getByRole('menuitem', { name: /edit canvas properties/i });
      const duplicateOption = screen.getByRole('menuitem', { name: /duplicate this canvas/i });
      const deleteOption = screen.getByRole('menuitem', { name: /delete this canvas/i });

      expect(editOption).toBeInTheDocument();
      expect(duplicateOption).toBeInTheDocument();
      expect(deleteOption).toBeInTheDocument();
    });

    it('should announce canvas switching to screen readers', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      const switcher = screen.getByRole('combobox');
      await user.click(switcher);

      // Select different canvas
      const designCanvas = screen.getByRole('option', { name: /design canvas/i });
      await user.click(designCanvas);

      // Should have live region announcing the switch
      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/switched to design canvas/i);
      });
    });

    it('should provide alternative text for visual elements', async () => {
      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      // Canvas should have description for screen readers
      const canvas = screen.getByRole('main');
      expect(canvas).toHaveAccessibleName(/canvas workspace/i);
      expect(canvas).toHaveAccessibleDescription(/infinite canvas for organizing cards and connections/i);

      // Card elements should have meaningful labels
      const cardElements = screen.getAllByRole('article');
      cardElements.forEach(card => {
        expect(card).toHaveAccessibleName();
        expect(card).toHaveAttribute('aria-describedby');
      });
    });

    it('should provide context for canvas hierarchy', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <WorkspaceBreadcrumbs />
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Breadcrumbs should show navigation hierarchy
      const breadcrumbs = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(breadcrumbs).toBeInTheDocument();

      const workspaceLink = screen.getByRole('link', { name: mockWorkspace.name });
      const currentCanvas = screen.getByText(/main canvas/i);

      expect(workspaceLink).toBeInTheDocument();
      expect(currentCanvas).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Keyboard-only Navigation', () => {
    it('should support full keyboard navigation in canvas switcher', async () => {
      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      const switcher = screen.getByRole('combobox');

      // Focus switcher with tab
      await user.tab();
      expect(switcher).toHaveFocus();

      // Open dropdown with Enter or Space
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByRole('option', { name: /main canvas/i })).toBeInTheDocument();
      });

      // Navigate options with arrow keys
      await user.keyboard('{ArrowDown}');
      const designCanvas = screen.getByRole('option', { name: /design canvas/i });
      expect(designCanvas).toHaveAttribute('aria-selected', 'true');

      // Select with Enter
      await user.keyboard('{Enter}');
      
      expect(switcher).toHaveValue('Design Canvas');
    });

    it('should support keyboard navigation in canvas operations menu', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Navigate to options button
      await user.tab();
      await user.tab(); // Skip switcher, go to options

      const optionsButton = screen.getByRole('button', { name: /canvas options/i });
      expect(optionsButton).toHaveFocus();

      // Open menu with Enter
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Navigate menu items with arrow keys
      await user.keyboard('{ArrowDown}');
      const editOption = screen.getByRole('menuitem', { name: /edit canvas/i });
      expect(editOption).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      const duplicateOption = screen.getByRole('menuitem', { name: /duplicate/i });
      expect(duplicateOption).toHaveFocus();

      // Close menu with Escape
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(optionsButton).toHaveFocus();
    });

    it('should support keyboard shortcuts for common canvas actions', async () => {
      const mockWorkspaceStore = (useWorkspaceStore as jest.Mock).mock.results[0].value;
      
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Focus canvas area
      const canvas = screen.getByRole('main');
      await act(async () => {
        canvas.focus();
      });

      // Test keyboard shortcuts
      await user.keyboard('{Control>}n{/Control}'); // Ctrl+N for new canvas
      expect(mockWorkspaceStore.createCanvas).toHaveBeenCalled();

      await user.keyboard('{Control>}d{/Control}'); // Ctrl+D for duplicate
      expect(mockWorkspaceStore.duplicateCanvas).toHaveBeenCalled();

      // Canvas navigation shortcuts
      await user.keyboard('{Control>}1{/Control}'); // Switch to canvas 1
      expect(mockWorkspaceStore.switchToCanvas).toHaveBeenCalledWith(mockCanvases[0].id);

      await user.keyboard('{Control>}2{/Control}'); // Switch to canvas 2
      expect(mockWorkspaceStore.switchToCanvas).toHaveBeenCalledWith(mockCanvases[1].id);
    });

    it('should maintain focus trap in modal dialogs', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CreateCanvasModal />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Open modal
      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Focus should be on first focusable element
      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      expect(nameInput).toHaveFocus();

      // Tab through modal elements
      await user.tab();
      const descriptionInput = screen.getByRole('textbox', { name: /description/i });
      expect(descriptionInput).toHaveFocus();

      await user.tab();
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveFocus();

      await user.tab();
      const createButtonInModal = screen.getByRole('button', { name: /create canvas/i });
      expect(createButtonInModal).toHaveFocus();

      // Tab should wrap back to first element
      await user.tab();
      expect(nameInput).toHaveFocus();

      // Shift+Tab should go to last element
      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(createButtonInModal).toHaveFocus();
    });

    it('should handle keyboard navigation on infinite canvas', async () => {
      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      const canvas = screen.getByRole('main');
      
      // Focus canvas
      await act(async () => {
        canvas.focus();
      });

      expect(canvas).toHaveFocus();

      // Arrow keys should pan canvas
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowDown}');

      // Plus/minus should zoom
      await user.keyboard('{+}');
      await user.keyboard('{-}');

      // Space should enable pan mode
      await user.keyboard(' ');

      // Escape should reset canvas view
      await user.keyboard('{Escape}');
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly when switching canvases', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      const switcher = screen.getByRole('combobox');
      const canvas = screen.getByRole('main');

      // Focus switcher and select different canvas
      switcher.focus();
      expect(switcher).toHaveFocus();

      await user.click(switcher);
      const designOption = screen.getByRole('option', { name: /design canvas/i });
      await user.click(designOption);

      // Focus should return to canvas after switch
      await waitFor(() => {
        expect(canvas).toHaveFocus();
      });
    });

    it('should restore focus after modal operations', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
          <CreateCanvasModal />
        </WorkspaceLayout>,
        { wrapper }
      );

      const createButton = screen.getByRole('button', { name: /create canvas/i });
      
      // Focus and click create button
      createButton.focus();
      await user.click(createButton);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Cancel modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Focus should return to create button
      await waitFor(() => {
        expect(createButton).toHaveFocus();
      });
    });

    it('should provide visible focus indicators', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      const switcher = screen.getByRole('combobox');
      const createButton = screen.getByRole('button', { name: /create canvas/i });

      // Tab to elements and verify focus styles
      await user.tab();
      expect(switcher).toHaveFocus();
      expect(switcher).toHaveClass('focus:ring-2'); // Assuming Tailwind focus classes

      await user.tab();
      expect(createButton).toHaveFocus();
      expect(createButton).toHaveClass('focus:ring-2');
    });

    it('should skip hidden or disabled elements in tab order', async () => {
      const mockWorkspaceStore = {
        ...((useWorkspaceStore as jest.Mock).mock.results[0].value),
        canUserEditCanvas: jest.fn().mockReturnValue(false), // Disable edit permissions
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      const switcher = screen.getByRole('combobox');
      const createButton = screen.getByRole('button', { name: /create canvas/i });

      // Tab should skip disabled edit button
      await user.tab();
      expect(switcher).toHaveFocus();

      await user.tab();
      expect(createButton).toHaveFocus();

      // Options button should be disabled or hidden when no edit permissions
      const optionsButton = screen.queryByRole('button', { name: /canvas options/i });
      if (optionsButton) {
        expect(optionsButton).toBeDisabled();
      }
    });
  });

  describe('ARIA Compliance', () => {
    it('should use proper ARIA roles and properties in canvas switcher', async () => {
      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      const switcher = screen.getByRole('combobox');
      
      expect(switcher).toHaveAttribute('aria-haspopup', 'listbox');
      expect(switcher).toHaveAttribute('aria-expanded', 'false');
      expect(switcher).toHaveAttribute('aria-labelledby');

      // Open dropdown
      await user.click(switcher);

      expect(switcher).toHaveAttribute('aria-expanded', 'true');
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-labelledby');

      // Options should have proper roles
      const options = screen.getAllByRole('option');
      options.forEach(option => {
        expect(option).toHaveAttribute('aria-selected');
      });
    });

    it('should use proper ARIA in canvas operations menu', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      const optionsButton = screen.getByRole('button', { name: /canvas options/i });
      expect(optionsButton).toHaveAttribute('aria-haspopup', 'menu');
      expect(optionsButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(optionsButton);

      expect(optionsButton).toHaveAttribute('aria-expanded', 'true');

      const menu = screen.getByRole('menu');
      expect(menu).toHaveAttribute('aria-labelledby', optionsButton.id);

      const menuItems = screen.getAllByRole('menuitem');
      menuItems.forEach(item => {
        expect(item).toHaveAttribute('tabindex', '-1'); // Menu items should not be in tab order
      });
    });

    it('should provide proper ARIA labels for canvas state', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      const canvas = screen.getByRole('main');
      
      expect(canvas).toHaveAttribute('aria-label');
      expect(canvas).toHaveAttribute('aria-describedby');

      // Canvas should announce its state
      const canvasInfo = screen.getByRole('region', { name: /canvas information/i });
      expect(canvasInfo).toHaveTextContent(/main canvas/i);

      // Should announce number of elements
      expect(canvasInfo).toHaveTextContent(/1 card/i);
    });

    it('should use appropriate ARIA live regions for dynamic updates', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Should have live regions for announcements
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');

      const alertRegion = screen.getByRole('alert');
      expect(alertRegion).toHaveAttribute('aria-live', 'assertive');
    });

    it('should provide proper ARIA for modal dialogs', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CreateCanvasModal />
        </WorkspaceLayout>,
        { wrapper }
      );

      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      const modal = screen.getByRole('dialog');
      
      expect(modal).toHaveAttribute('aria-labelledby');
      expect(modal).toHaveAttribute('aria-describedby');
      expect(modal).toHaveAttribute('aria-modal', 'true');

      // Modal should have proper heading structure
      const modalTitle = screen.getByRole('heading', { level: 2 });
      expect(modalTitle).toBeInTheDocument();
      
      const titleId = modalTitle.getAttribute('id');
      expect(modal).toHaveAttribute('aria-labelledby', titleId);
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should have sufficient color contrast for text elements', async () => {
      const wrapper = createWrapper([]);
      const { container } = render(<CanvasSwitcher />, { wrapper });

      // Check for contrast violations in axe results
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      });

      expect(results).toHaveNoViolations();
    });

    it('should not rely solely on color for information', async () => {
      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Default canvas should have visual indicator beyond color
      const switcher = screen.getByRole('combobox');
      await user.click(switcher);

      const defaultOption = screen.getByRole('option', { name: /main canvas/i });
      
      // Should have icon or text indicator, not just color
      expect(defaultOption).toHaveTextContent(/default/i);
      
      const defaultIcon = defaultOption.querySelector('[data-testid="default-icon"]');
      expect(defaultIcon).toBeInTheDocument();
    });

    it('should support high contrast mode', async () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      // Elements should have high contrast styles
      const switcher = screen.getByRole('combobox');
      const computedStyle = window.getComputedStyle(switcher);
      
      // Should have explicit borders/outlines in high contrast
      expect(computedStyle.border).not.toBe('none');
    });

    it('should support reduced motion preferences', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      const canvas = screen.getByRole('main');
      
      // Animations should be disabled or reduced
      const computedStyle = window.getComputedStyle(canvas);
      expect(computedStyle.animationDuration).toBe('0s');
    });

    it('should scale properly with browser zoom', async () => {
      const wrapper = createWrapper([]);
      const { container } = render(<CanvasSwitcher />, { wrapper });

      // Simulate browser zoom
      Object.defineProperty(document.documentElement, 'style', {
        value: { fontSize: '200%' },
        writable: true,
      });

      // Re-render to apply zoom
      const { rerender } = render(<CanvasSwitcher />, { wrapper });
      rerender(<CanvasSwitcher />);

      // Elements should remain accessible at higher zoom levels
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Error States Accessibility', () => {
    it('should announce errors to screen readers', async () => {
      const mockWorkspaceStore = {
        ...((useWorkspaceStore as jest.Mock).mock.results[0].value),
        createCanvas: jest.fn().mockRejectedValue(new Error('Canvas name already exists')),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CreateCanvasModal />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Open modal and trigger error
      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      await user.type(nameInput, 'Duplicate Name');

      const submitButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(submitButton);

      // Error should be announced
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/canvas name already exists/i);
      });

      // Form field should be marked as invalid
      expect(nameInput).toHaveAttribute('aria-invalid', 'true');
      expect(nameInput).toHaveAttribute('aria-describedby');
    });

    it('should provide accessible error recovery options', async () => {
      const mockWorkspaceStore = {
        ...((useWorkspaceStore as jest.Mock).mock.results[0].value),
        loadCanvases: jest.fn().mockRejectedValue(new Error('Network error')),
        retryLoadCanvases: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Error state should be accessible
      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveTextContent(/network error/i);
      });

      // Retry button should be properly labeled
      const retryButton = screen.getByRole('button', { name: /retry loading canvases/i });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toHaveAccessibleDescription(/attempt to reload the canvas list/i);
    });
  });

  describe('Loading States Accessibility', () => {
    it('should provide accessible loading indicators', async () => {
      const wrapper = createWrapper([]);
      
      // Mock loading state
      const mockWorkspaceStore = {
        ...((useWorkspaceStore as jest.Mock).mock.results[0].value),
        isLoading: true,
        loadingMessage: 'Loading canvases...',
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      render(<CanvasSwitcher />, { wrapper });

      // Loading indicator should be announced to screen readers
      const loadingIndicator = screen.getByRole('status');
      expect(loadingIndicator).toHaveAccessibleName(/loading/i);
      expect(loadingIndicator).toHaveTextContent(/loading canvases/i);

      // Progress bar should have proper ARIA attributes if present
      const progressBar = screen.queryByRole('progressbar');
      if (progressBar) {
        expect(progressBar).toHaveAttribute('aria-valuemin');
        expect(progressBar).toHaveAttribute('aria-valuemax');
        expect(progressBar).toHaveAttribute('aria-valuenow');
      }
    });

    it('should handle skeleton loading states accessibly', async () => {
      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      // Skeleton elements should be properly labeled
      const skeletonElements = screen.queryAllByTestId(/skeleton/i);
      skeletonElements.forEach(skeleton => {
        expect(skeleton).toHaveAttribute('aria-label', 'Loading...');
        expect(skeleton).toHaveAttribute('aria-busy', 'true');
      });
    });
  });
});