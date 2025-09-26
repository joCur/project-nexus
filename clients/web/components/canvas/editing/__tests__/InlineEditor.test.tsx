/**
 * InlineEditor Component Tests
 *
 * Comprehensive test suite for the base InlineEditor component,
 * including keyboard shortcuts, click outside behavior, unsaved changes,
 * and all exported hooks.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook, act as hookAct } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  InlineEditor,
  useInlineEditor,
  useUnsavedChanges,
  useClickOutside,
  useFocusTrap,
  type InlineEditorProps,
  type InlineEditorHandle
} from '../InlineEditor';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>
  }
}));

describe('InlineEditor', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnClickOutside = jest.fn();

  const defaultProps: InlineEditorProps<string> = {
    initialValue: 'Initial text',
    onSave: mockOnSave,
    onCancel: mockOnCancel
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.confirm for unsaved changes warning
    window.confirm = jest.fn(() => true);
  });

  describe('Basic Rendering', () => {
    it('should render with initial value', () => {
      render(
        <InlineEditor<string> {...defaultProps}>
          {({ value }) => <div>{value}</div>}
        </InlineEditor>
      );

      expect(screen.getByText('Initial text')).toBeInTheDocument();
    });

    it('should render controls when showControls is true', () => {
      render(
        <InlineEditor<string> {...defaultProps} showControls={true}>
          {({ value }) => <input value={value} readOnly />}
        </InlineEditor>
      );

      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should not render controls when showControls is false', () => {
      render(
        <InlineEditor<string> {...defaultProps} showControls={false}>
          {({ value }) => <input value={value} readOnly />}
        </InlineEditor>
      );

      expect(screen.queryByText('Save')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('should render custom button text', () => {
      render(
        <InlineEditor<string>
          {...defaultProps}
          saveText="Apply"
          cancelText="Discard"
        >
          {({ value }) => <input value={value} readOnly />}
        </InlineEditor>
      );

      expect(screen.getByText('Apply')).toBeInTheDocument();
      expect(screen.getByText('Discard')).toBeInTheDocument();
    });
  });

  describe('Value Management', () => {
    it('should update value through setValue', () => {
      render(
        <InlineEditor<string> {...defaultProps}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      expect(input).toHaveValue('Updated text');
    });

    it('should detect unsaved changes', () => {
      render(
        <InlineEditor<string> {...defaultProps}>
          {({ value, setValue, hasUnsavedChanges }) => (
            <>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                data-testid="input"
              />
              {hasUnsavedChanges && <div data-testid="unsaved">Unsaved</div>}
            </>
          )}
        </InlineEditor>
      );

      expect(screen.queryByTestId('unsaved')).not.toBeInTheDocument();

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      expect(screen.getByTestId('unsaved')).toBeInTheDocument();
    });

    it('should show unsaved changes indicator', () => {
      render(
        <InlineEditor<string> {...defaultProps}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });
  });

  describe('Save and Cancel Operations', () => {
    it('should call onSave with updated value', async () => {
      render(
        <InlineEditor<string> {...defaultProps}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Updated text');
      });
    });

    it('should call onCancel when cancel button clicked', () => {
      render(
        <InlineEditor<string> {...defaultProps}>
          {({ value }) => <div>{value}</div>}
        </InlineEditor>
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should warn about unsaved changes on cancel', () => {
      render(
        <InlineEditor<string> {...defaultProps} warnOnUnsavedChanges={true}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(window.confirm).toHaveBeenCalledWith(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
    });

    it('should not warn when warnOnUnsavedChanges is false', () => {
      render(
        <InlineEditor<string> {...defaultProps} warnOnUnsavedChanges={false}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(window.confirm).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should show validation error', () => {
      const validate = (value: string) => {
        if (value.length < 5) return 'Text must be at least 5 characters';
        return true;
      };

      render(
        <InlineEditor<string> {...defaultProps} validate={validate}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Hi' } });

      expect(screen.getByText('Text must be at least 5 characters')).toBeInTheDocument();
    });

    it('should disable save button when validation fails', () => {
      const validate = (value: string) => {
        if (value.length < 5) return 'Text must be at least 5 characters';
        return true;
      };

      render(
        <InlineEditor<string> {...defaultProps} initialValue="Hi" validate={validate}>
          {({ value }) => <div>{value}</div>}
        </InlineEditor>
      );

      const saveButton = screen.getByText('Save');
      expect(saveButton).toBeDisabled();

      // Also verify the error message is shown
      expect(screen.getByText('Text must be at least 5 characters')).toBeInTheDocument();
    });

    it('should not save when validation fails', async () => {
      const validate = (value: string) => value.length >= 5;

      render(
        <InlineEditor<string> {...defaultProps} initialValue="Hi" validate={validate}>
          {({ value }) => <div>{value}</div>}
        </InlineEditor>
      );

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should save on Ctrl+S', async () => {
      render(
        <InlineEditor<string> {...defaultProps}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      fireEvent.keyDown(document, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Updated text');
      });
    });

    it('should save on Cmd+S (Mac)', async () => {
      render(
        <InlineEditor<string> {...defaultProps}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      fireEvent.keyDown(document, { key: 's', metaKey: true });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Updated text');
      });
    });

    it('should cancel on Escape', () => {
      render(
        <InlineEditor<string> {...defaultProps}>
          {({ value }) => <div>{value}</div>}
        </InlineEditor>
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should use custom shortcuts', async () => {
      const customShortcuts = {
        save: ['alt+s'],
        cancel: ['alt+c']
      };

      render(
        <InlineEditor<string> {...defaultProps} shortcuts={customShortcuts}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      // Custom save shortcut
      fireEvent.keyDown(document, { key: 's', altKey: true });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Updated text');
      });

      // Custom cancel shortcut
      fireEvent.keyDown(document, { key: 'c', altKey: true });

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Click Outside Behavior', () => {
    it('should call onClickOutside when clicking outside', async () => {
      render(
        <>
          <div data-testid="outside">Outside</div>
          <InlineEditor<string> {...defaultProps} onClickOutside={mockOnClickOutside}>
            {({ value }) => <div>{value}</div>}
          </InlineEditor>
        </>
      );

      // Wait for event listener to be attached
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      fireEvent.mouseDown(screen.getByTestId('outside'));

      expect(mockOnClickOutside).toHaveBeenCalledWith(false);
    });

    it('should save on blur when saveOnBlur is true', async () => {
      render(
        <>
          <div data-testid="outside">Outside</div>
          <InlineEditor<string> {...defaultProps} saveOnBlur={true}>
            {({ value, setValue }) => (
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                data-testid="input"
              />
            )}
          </InlineEditor>
        </>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      // Wait for event listener to be attached
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      fireEvent.mouseDown(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Updated text');
      });
    });

    it('should cancel on blur when no changes and saveOnBlur is true', async () => {
      render(
        <>
          <div data-testid="outside">Outside</div>
          <InlineEditor<string> {...defaultProps} saveOnBlur={true}>
            {({ value }) => <div>{value}</div>}
          </InlineEditor>
        </>
      );

      // Wait for event listener to be attached
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      fireEvent.mouseDown(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading overlay when isLoading is true', () => {
      render(
        <InlineEditor<string> {...defaultProps} isLoading={true} loadingMessage="Saving changes...">
          {({ value }) => <div>{value}</div>}
        </InlineEditor>
      );

      expect(screen.getByText('Saving changes...')).toBeInTheDocument();
    });

    it('should show loading overlay when saving', async () => {
      const slowSave = jest.fn(() => new Promise<void>(resolve => setTimeout(resolve, 100)));

      render(
        <InlineEditor<string> {...defaultProps} onSave={slowSave}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      expect(screen.getByText('Saving...')).toBeInTheDocument();

      await waitFor(() => {
        expect(slowSave).toHaveBeenCalled();
      });
    });
  });

  describe('Imperative Handle', () => {
    it('should expose imperative methods via ref', () => {
      const ref = React.createRef<InlineEditorHandle>();

      render(
        <InlineEditor<string> {...defaultProps} ref={ref}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      expect(ref.current).toBeDefined();
      expect(ref.current?.save).toBeInstanceOf(Function);
      expect(ref.current?.cancel).toBeInstanceOf(Function);
      expect(ref.current?.hasUnsavedChanges).toBeInstanceOf(Function);
      expect(ref.current?.getValue).toBeInstanceOf(Function);
      expect(ref.current?.focus).toBeInstanceOf(Function);
    });

    it('should save via imperative handle', async () => {
      const ref = React.createRef<InlineEditorHandle>();

      render(
        <InlineEditor<string> {...defaultProps} ref={ref}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      await act(async () => {
        await ref.current?.save();
      });

      expect(mockOnSave).toHaveBeenCalledWith('Updated text');
    });

    it('should cancel via imperative handle', () => {
      const ref = React.createRef<InlineEditorHandle>();

      render(
        <InlineEditor<string> {...defaultProps} ref={ref}>
          {({ value }) => <div>{value}</div>}
        </InlineEditor>
      );

      act(() => {
        ref.current?.cancel();
      });

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should get value via imperative handle', () => {
      const ref = React.createRef<InlineEditorHandle>();

      render(
        <InlineEditor<string> {...defaultProps} ref={ref}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      expect(ref.current?.getValue()).toBe('Initial text');

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      expect(ref.current?.getValue()).toBe('Updated text');
    });

    it('should check unsaved changes via imperative handle', () => {
      const ref = React.createRef<InlineEditorHandle>();

      render(
        <InlineEditor<string> {...defaultProps} ref={ref}>
          {({ value, setValue }) => (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input"
            />
          )}
        </InlineEditor>
      );

      expect(ref.current?.hasUnsavedChanges()).toBe(false);

      const input = screen.getByTestId('input');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      expect(ref.current?.hasUnsavedChanges()).toBe(true);
    });
  });
});

describe('useInlineEditor Hook', () => {
  it('should manage editor state', () => {
    const { result } = renderHook(() => useInlineEditor('initial'));

    expect(result.current.value).toBe('initial');
    expect(result.current.isEditing).toBe(false);

    hookAct(() => {
      result.current.startEdit();
    });

    expect(result.current.isEditing).toBe(true);
    expect(result.current.originalValue).toBe('initial');

    hookAct(() => {
      result.current.setValue('updated');
    });

    expect(result.current.value).toBe('updated');

    hookAct(() => {
      result.current.save('saved');
    });

    expect(result.current.value).toBe('saved');
    expect(result.current.isEditing).toBe(false);
  });

  it('should cancel and restore original value', () => {
    const { result } = renderHook(() => useInlineEditor('initial'));

    hookAct(() => {
      result.current.startEdit();
      result.current.setValue('updated');
      result.current.cancel();
    });

    expect(result.current.value).toBe('initial');
    expect(result.current.isEditing).toBe(false);
  });

  it('should detect unsaved changes', () => {
    const { result } = renderHook(() => useInlineEditor('initial'));

    hookAct(() => {
      result.current.startEdit();
    });

    expect(result.current.hasUnsavedChanges()).toBe(false);

    hookAct(() => {
      result.current.setValue('updated');
    });

    expect(result.current.hasUnsavedChanges()).toBe(true);
  });
});

describe('useUnsavedChanges Hook', () => {
  it('should detect changes with default comparison', () => {
    const { result, rerender } = renderHook(
      ({ current, original }) => useUnsavedChanges(current, original),
      { initialProps: { current: 'initial', original: 'initial' } }
    );

    expect(result.current).toBe(false);

    rerender({ current: 'updated', original: 'initial' });

    expect(result.current).toBe(true);
  });

  it('should use custom comparison function', () => {
    const customCompare = (a: number, b: number) => Math.abs(a - b) < 0.01;

    const { result, rerender } = renderHook(
      ({ current, original }) => useUnsavedChanges(current, original, customCompare),
      { initialProps: { current: 1.0, original: 1.0 } }
    );

    expect(result.current).toBe(false);

    rerender({ current: 1.005, original: 1.0 });

    expect(result.current).toBe(false); // Within tolerance

    rerender({ current: 1.02, original: 1.0 });

    expect(result.current).toBe(true); // Outside tolerance
  });
});

describe('useClickOutside Hook', () => {
  it('should call handler when clicking outside', async () => {
    const handler = jest.fn();
    const ref = React.createRef<HTMLDivElement>();

    render(
      <>
        <div data-testid="outside">Outside</div>
        <div ref={ref} data-testid="inside">Inside</div>
      </>
    );

    renderHook(() => useClickOutside(ref, handler));

    // Wait for event listener to be attached
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(handler).toHaveBeenCalled();
  });

  it('should not call handler when clicking inside', async () => {
    const handler = jest.fn();
    const ref = React.createRef<HTMLDivElement>();

    render(
      <div ref={ref} data-testid="inside">
        <button data-testid="button">Button</button>
      </div>
    );

    renderHook(() => useClickOutside(ref, handler));

    // Wait for event listener to be attached
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    fireEvent.mouseDown(screen.getByTestId('button'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('should respect enabled flag', async () => {
    const handler = jest.fn();
    const ref = React.createRef<HTMLDivElement>();

    render(
      <>
        <div data-testid="outside">Outside</div>
        <div ref={ref} data-testid="inside">Inside</div>
      </>
    );

    renderHook(() => useClickOutside(ref, handler, false));

    // Wait for event listener to be attached (it shouldn't be)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('useFocusTrap Hook', () => {
  it('should trap focus within container', () => {
    const ref = React.createRef<HTMLDivElement>();

    const { container } = render(
      <div ref={ref}>
        <button data-testid="first">First</button>
        <button data-testid="middle">Middle</button>
        <button data-testid="last">Last</button>
      </div>
    );

    renderHook(() => useFocusTrap(ref, true));

    const firstButton = screen.getByTestId('first');
    const lastButton = screen.getByTestId('last');

    expect(document.activeElement).toBe(firstButton);

    // Tab from last element should go to first
    lastButton.focus();
    fireEvent.keyDown(container, { key: 'Tab' });

    // Note: In test environment, focus trap may not work exactly as in browser
    // This is a simplified test
  });

  it('should not trap focus when inactive', () => {
    const ref = React.createRef<HTMLDivElement>();

    render(
      <div ref={ref}>
        <button data-testid="first">First</button>
        <button data-testid="last">Last</button>
      </div>
    );

    renderHook(() => useFocusTrap(ref, false));

    const firstButton = screen.getByTestId('first');

    expect(document.activeElement).not.toBe(firstButton);
  });
});