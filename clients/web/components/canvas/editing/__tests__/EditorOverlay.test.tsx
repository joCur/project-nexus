/**
 * EditorOverlay Component - Comprehensive Test Suite
 *
 * Tests all aspects of the EditorOverlay component:
 * - Rendering and card type routing
 * - Save operations and data transformation
 * - Error handling and recovery
 * - Accessibility features
 * - Animations and transitions
 * - User interactions
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useQuery } from '@apollo/client';
import { useCardStore } from '@/stores/cardStore';
import { useCardOperations } from '@/hooks/useCardOperations';
import { EditorOverlay } from '../EditorOverlay';
import type { CardResponse } from '@/lib/graphql/cardOperations';

// Mock dependencies
jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useQuery: jest.fn()
}));

jest.mock('@/stores/cardStore');
jest.mock('@/hooks/useCardOperations');
jest.mock('@/contexts/WorkspacePermissionContext', () => ({
  useWorkspacePermissionContextSafe: () => ({
    currentWorkspaceId: 'test-workspace',
    canEdit: true
  })
}));

// Mock editors with proper types
jest.mock('../TextEditor', () => ({
  TextEditor: ({ card, onSave, onCancel }: { card: { content: { content: string } }; onSave: (data: { type: string; content: string }) => void; onCancel: () => void }) => (
    <div data-testid="text-editor">
      <div contentEditable suppressContentEditableWarning aria-label="Text editor">
        {card.content.content}
      </div>
      <button onClick={() => onSave({ type: 'text', content: 'Modified content' })}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}));

jest.mock('../CodeEditor', () => ({
  CodeEditor: ({ card, onSave, onCancel }: { card: { content: { content: string } }; onSave: (data: { type: string; content: string; language: string }) => void; onCancel: () => void }) => (
    <div data-testid="code-editor">
      <div contentEditable suppressContentEditableWarning aria-label="Code editor">
        {card.content.content}
      </div>
      <button onClick={() => onSave({ type: 'code', content: 'Modified code', language: 'javascript' })}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}));

jest.mock('../LinkEditor', () => ({
  LinkEditor: ({ initialValue, onSave, onCancel }: { initialValue: { url: string; text: string }; onSave: (data: { url: string; text: string }) => void; onCancel: () => void }) => (
    <div data-testid="link-editor">
      <input aria-label="URL" defaultValue={initialValue.url} />
      <input aria-label="Link text" defaultValue={initialValue.text} />
      <button onClick={() => onSave({ url: 'https://modified.com', text: 'Modified link' })}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}));

jest.mock('../ImageEditor', () => ({
  ImageEditor: ({ initialData, onSave, onCancel }: { initialData: { url: string; alt: string; caption: string }; onSave: (data: { url: string; alt: string; caption: string }) => void; onCancel: () => void }) => (
    <div data-testid="image-editor">
      <input aria-label="Image URL" defaultValue={initialData.url} />
      <input aria-label="Alt text" defaultValue={initialData.alt} />
      <input aria-label="Caption" defaultValue={initialData.caption} />
      <button onClick={() => onSave({ url: 'https://modified.jpg', alt: 'Modified alt', caption: 'Modified caption' })}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}));

// Mock framer-motion to avoid animation issues
jest.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  const mockMotionComponent = (tag: string) => {
    const MockComponent = React.forwardRef((props: Record<string, unknown> & { children?: React.ReactNode }, ref: React.Ref<HTMLElement>) => {
      const { children, onClick, role, className, ...rest } = props;
      return React.createElement(tag, { ref, onClick, role, className, ...rest }, children);
    });
    MockComponent.displayName = `Motion${tag.charAt(0).toUpperCase() + tag.slice(1)}`;
    return MockComponent;
  };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: mockMotionComponent('div'),
      span: mockMotionComponent('span')
    }
  };
});

// Mock logger
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  })
}));

// Mock accessibility announcements
jest.mock('@/utils/accessibility/announcements', () => ({
  announceEditModeEntered: jest.fn(),
  announceEditModeExited: jest.fn(),
  announceSaveStatus: jest.fn()
}));

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseCardStore = useCardStore as jest.MockedFunction<typeof useCardStore>;
const mockUseCardOperations = useCardOperations as jest.MockedFunction<typeof useCardOperations>;

// Helper to create mock useQuery result
const createMockQueryResult = (overrides: Record<string, unknown> = {}): ReturnType<typeof useQuery> => ({
  data: undefined,
  loading: false,
  error: undefined,
  refetch: jest.fn(),
  networkStatus: 7,
  called: true,
  client: {} as never,
  observable: {} as never,
  startPolling: jest.fn(),
  stopPolling: jest.fn(),
  subscribeToMore: jest.fn(),
  updateQuery: jest.fn(),
  reobserve: jest.fn(),
  fetchMore: jest.fn(),
  variables: undefined,
  previousData: undefined,
  ...overrides
} as ReturnType<typeof useQuery>);

// Helper to create complete useCardOperations mock
const createMockCardOperations = (overrides: Record<string, unknown> = {}): ReturnType<typeof useCardOperations> => ({
  serverCards: undefined,
  loading: false,
  error: undefined,
  updateCard: jest.fn().mockResolvedValue(true) as unknown as ReturnType<typeof useCardOperations>['updateCard'],
  deleteCard: jest.fn().mockResolvedValue(true) as unknown as ReturnType<typeof useCardOperations>['deleteCard'],
  createCard: jest.fn().mockResolvedValue({ id: 'new-card' }) as unknown as ReturnType<typeof useCardOperations>['createCard'],
  syncCardsFromServer: jest.fn().mockResolvedValue(undefined) as unknown as ReturnType<typeof useCardOperations>['syncCardsFromServer'],
  refetchCards: jest.fn().mockResolvedValue({ data: { cards: { items: [] } } }) as unknown as ReturnType<typeof useCardOperations>['refetchCards'],
  store: {} as ReturnType<typeof useCardStore>,
  cardSubscriptionErrors: {},
  hasCardSubscriptionErrors: false,
  ...overrides
} as ReturnType<typeof useCardOperations>);

// Helper to create mock card response
const createMockCard = (type: string, id: string = 'test-card'): CardResponse => ({
  id,
  ownerId: 'owner-1',
  workspaceId: 'test-workspace',
  type: type.toUpperCase() as 'TEXT' | 'IMAGE' | 'LINK' | 'CODE',
  content: type === 'text' ? 'Test content' : type === 'code' ? 'console.log("test")' : 'https://example.com',
  title: type === 'link' ? 'Example Link' : '',
  position: { x: 100, y: 100, z: 0 },
  dimensions: { width: 300, height: 200 },
  status: 'ACTIVE',
  priority: 'NORMAL',
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  tags: [],
  metadata: type === 'code' ? { language: 'javascript' } : type === 'image' ? { alt: 'Test image' } : {},
  style: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    textColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 8,
    opacity: 1,
    shadow: true
  }
});

describe('EditorOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: no editing state
    mockUseCardStore.mockReturnValue({
      editingCardId: null,
      clearEditingCard: jest.fn(),
      cards: [],
      selectedCardIds: [],
      setCards: jest.fn(),
      addCard: jest.fn(),
      updateCard: jest.fn(),
      deleteCard: jest.fn(),
      selectCard: jest.fn(),
      deselectCard: jest.fn(),
      clearSelection: jest.fn(),
      setEditingCard: jest.fn()
    });

    mockUseCardOperations.mockReturnValue(createMockCardOperations());

    mockUseQuery.mockReturnValue(createMockQueryResult());
  });

  describe('Rendering and Card Type Routing', () => {
    it('should render nothing when no card is being edited', () => {
      const { container } = render(<EditorOverlay workspaceId="test-workspace" />);
      expect(container.firstChild).toBeNull();
    });

    it('should render portal overlay when a card is being edited', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      expect(screen.getByTestId('editor-backdrop')).toBeInTheDocument();
      // Dialog is inside aria-hidden backdrop, so use hidden: true option
      expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
    });

    it('should render TextEditor for text cards', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);
      expect(screen.getByTestId('text-editor')).toBeInTheDocument();
    });

    it('should render CodeEditor for code cards', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('code')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    it('should render LinkEditor for link cards', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('link')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);
      expect(screen.getByTestId('link-editor')).toBeInTheDocument();
    });

    it('should render ImageEditor for image cards', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('image')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);
      expect(screen.getByTestId('image-editor')).toBeInTheDocument();
    });
  });

  describe('Save Operations', () => {
    it('should successfully save text card changes', async () => {
      const mockUpdateCard = jest.fn().mockResolvedValue(true);
      const mockClearEditingCard = jest.fn();

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: mockClearEditingCard,
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseCardOperations.mockReturnValue(createMockCardOperations({
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
      }));

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalledWith({
          id: 'test-card',
          updates: { content: 'Modified content' }
        });
      });

      // Wait for success state and close
      await waitFor(() => {
        expect(mockClearEditingCard).toHaveBeenCalled();
      }, { timeout: 1500 });
    });

    it('should transform code card data correctly when saving', async () => {
      const mockUpdateCard = jest.fn().mockResolvedValue(true);

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseCardOperations.mockReturnValue(createMockCardOperations({
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
      }));

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('code')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalledWith({
          id: 'test-card',
          updates: {
            content: 'Modified code',
            metadata: {
              language: 'javascript',
              filename: undefined
            }
          }
        });
      });
    });

    it('should transform link card data correctly when saving', async () => {
      const mockUpdateCard = jest.fn().mockResolvedValue(true);

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseCardOperations.mockReturnValue(createMockCardOperations({
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
      }));

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('link')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalledWith({
          id: 'test-card',
          updates: {
            content: 'https://modified.com',
            title: 'Modified link',
            metadata: {
              description: undefined,
              domain: 'modified.com',
              favicon: undefined,
              previewImage: undefined
            }
          }
        });
      });
    });

    it('should transform image card data correctly when saving', async () => {
      const mockUpdateCard = jest.fn().mockResolvedValue(true);

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseCardOperations.mockReturnValue(createMockCardOperations({
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
      }));

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('image')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalledWith({
          id: 'test-card',
          updates: {
            content: 'https://modified.jpg',
            title: 'Modified caption',
            metadata: { alt: 'Modified alt' }
          }
        });
      });
    });

    it('should handle save without server persistence', async () => {
      const mockUpdateCard = jest.fn();
      const mockClearEditingCard = jest.fn();

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: mockClearEditingCard,
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseCardOperations.mockReturnValue(createMockCardOperations({
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
      }));

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" enableServerPersistence={false} />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      // Should not call server update
      expect(mockUpdateCard).not.toHaveBeenCalled();

      // Should close after brief success feedback
      await waitFor(() => {
        expect(mockClearEditingCard).toHaveBeenCalled();
      }, { timeout: 1000 });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when save fails', async () => {
      const mockUpdateCard = jest.fn().mockResolvedValue(false);
      const mockClearEditingCard = jest.fn();

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: mockClearEditingCard,
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseCardOperations.mockReturnValue(createMockCardOperations({
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
      }));

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalled();
      });

      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText('Failed to save changes')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Should not close editor
      expect(mockClearEditingCard).not.toHaveBeenCalled();
    });

    it('should keep editor open for retry when save fails', async () => {
      const mockUpdateCard = jest.fn().mockResolvedValue(false);

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseCardOperations.mockReturnValue(createMockCardOperations({
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
      }));

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalled();
      });

      // Editor should still be visible
      expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
      expect(screen.getByTestId('text-editor')).toBeInTheDocument();
    });

    it('should allow retry after failed save', async () => {
      const mockUpdateCard = jest.fn()
        .mockResolvedValueOnce(false) // First attempt fails
        .mockResolvedValueOnce(true);  // Second attempt succeeds

      const mockClearEditingCard = jest.fn();

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: mockClearEditingCard,
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseCardOperations.mockReturnValue(createMockCardOperations({
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
      }));

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      // First save attempt - fails
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalledTimes(1);
      });

      // Retry - succeeds
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockClearEditingCard).toHaveBeenCalled();
      }, { timeout: 1500 });

      expect(mockUpdateCard).toHaveBeenCalledTimes(2);
    });
  });

  describe('User Interactions', () => {
    it('should close editor when clicking backdrop', () => {
      const mockClearEditingCard = jest.fn();

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: mockClearEditingCard,
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      const backdrop = screen.getByTestId('editor-backdrop');
      fireEvent.click(backdrop);

      expect(mockClearEditingCard).toHaveBeenCalled();
    });

    it('should not close editor when clicking inside dialog', () => {
      const mockClearEditingCard = jest.fn();

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: mockClearEditingCard,
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      const dialog = screen.getByRole('dialog', { hidden: true });
      fireEvent.click(dialog);

      expect(mockClearEditingCard).not.toHaveBeenCalled();
    });

    it('should close editor when clicking cancel button', () => {
      const mockClearEditingCard = jest.fn();

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: mockClearEditingCard,
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockClearEditingCard).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      // Dialog is inside aria-hidden backdrop, use hidden: true
      const dialog = screen.getByRole('dialog', { hidden: true });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Edit text card');
      expect(dialog).toHaveAttribute('aria-describedby', 'editor-description');
    });

    it('should have live region for save status', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      // Status regions are inside aria-hidden backdrop, use hidden: true
      const liveRegion = screen.getByRole('status', { name: 'save status', hidden: true });
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('should have edit mode announcement region', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      // Status regions are inside aria-hidden backdrop, use hidden: true
      const editModeRegion = screen.getByRole('status', { name: 'edit mode', hidden: true });
      expect(editModeRegion).toHaveAttribute('aria-live', 'polite');
      expect(editModeRegion).toHaveTextContent('Edit mode entered for text card');
    });

    it('should have hidden description for screen readers', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      const description = screen.getByText(/Press Escape to cancel/);
      expect(description).toHaveAttribute('id', 'editor-description');
      expect(description).toHaveClass('sr-only');
    });
  });

  describe('GraphQL Integration', () => {
    it('should query cards when editingCardId is set', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay workspaceId="test-workspace" />);

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: expect.objectContaining({
            workspaceId: 'test-workspace'
          }),
          skip: false,
          fetchPolicy: 'cache-first'
        })
      );
    });

    it('should skip query when no editingCardId', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: null,
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      render(<EditorOverlay workspaceId="test-workspace" />);

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skip: true
        })
      );
    });

    it('should use workspace ID from context if not provided', () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card',
        clearEditingCard: jest.fn(),
        cards: [],
        selectedCardIds: [],
        setCards: jest.fn(),
        addCard: jest.fn(),
        updateCard: jest.fn(),
        deleteCard: jest.fn(),
        selectCard: jest.fn(),
        deselectCard: jest.fn(),
        clearSelection: jest.fn(),
        setEditingCard: jest.fn()
      });

      mockUseQuery.mockReturnValue(createMockQueryResult({
        data: { cardsInBounds: [createMockCard('text')] },
        loading: false,
        error: undefined
      }));

      render(<EditorOverlay />); // No workspaceId prop

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: expect.objectContaining({
            workspaceId: 'test-workspace' // From mocked context
          })
        })
      );
    });
  });
});
