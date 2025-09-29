import { EditModeManagerInstance } from '../EditModeManager';

describe('EditModeManager - Keyboard Navigation', () => {
  let manager: any;
  let mockElement1: HTMLElement;
  let mockElement2: HTMLElement;
  let mockElement3: HTMLElement;

  beforeEach(() => {
    // Reset singleton
    (EditModeManagerInstance as any).instance = null;
    manager = EditModeManagerInstance.getInstance();

    // Create mock elements with focus capability
    mockElement1 = document.createElement('input');
    mockElement1.id = 'field1';
    mockElement1.setAttribute('data-field-index', '0');
    mockElement1.focus = jest.fn();

    mockElement2 = document.createElement('input');
    mockElement2.id = 'field2';
    mockElement2.setAttribute('data-field-index', '1');
    mockElement2.focus = jest.fn();

    mockElement3 = document.createElement('input');
    mockElement3.id = 'field3';
    mockElement3.setAttribute('data-field-index', '2');
    mockElement3.focus = jest.fn();

    document.body.appendChild(mockElement1);
    document.body.appendChild(mockElement2);
    document.body.appendChild(mockElement3);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Field Registration', () => {
    it('should register edit fields for navigation', () => {
      manager.registerEditField('card1', mockElement1, 0);
      manager.registerEditField('card1', mockElement2, 1);
      manager.registerEditField('card1', mockElement3, 2);

      const fields = (manager as any).editFields.get('card1');
      expect(fields).toHaveLength(3);
      expect(fields[0]).toBe(mockElement1);
      expect(fields[1]).toBe(mockElement2);
      expect(fields[2]).toBe(mockElement3);
    });

    it('should unregister fields when card exits edit mode', () => {
      manager.registerEditField('card1', mockElement1, 0);
      manager.registerEditField('card1', mockElement2, 1);

      manager.unregisterEditFields('card1');

      const fields = (manager as any).editFields.get('card1');
      expect(fields).toBeUndefined();
    });

    it('should maintain separate field lists for different cards', () => {
      manager.registerEditField('card1', mockElement1, 0);
      manager.registerEditField('card2', mockElement2, 0);

      const fields1 = (manager as any).editFields.get('card1');
      const fields2 = (manager as any).editFields.get('card2');

      expect(fields1).toHaveLength(1);
      expect(fields2).toHaveLength(1);
      expect(fields1[0]).toBe(mockElement1);
      expect(fields2[0]).toBe(mockElement2);
    });
  });

  describe('Focus Navigation', () => {
    beforeEach(() => {
      manager.startEdit('card1');
      manager.registerEditField('card1', mockElement1, 0);
      manager.registerEditField('card1', mockElement2, 1);
      manager.registerEditField('card1', mockElement3, 2);
    });

    it('should focus next field in sequence', () => {
      manager.setCurrentFieldIndex('card1', 0);
      manager.focusNextField('card1');

      expect(mockElement2.focus).toHaveBeenCalled();
      expect((manager as any).currentFieldIndex.get('card1')).toBe(1);
    });

    it('should wrap to first field when at last field', () => {
      manager.setCurrentFieldIndex('card1', 2);
      manager.focusNextField('card1');

      expect(mockElement1.focus).toHaveBeenCalled();
      expect((manager as any).currentFieldIndex.get('card1')).toBe(0);
    });

    it('should focus previous field in sequence', () => {
      manager.setCurrentFieldIndex('card1', 2);
      manager.focusPreviousField('card1');

      expect(mockElement2.focus).toHaveBeenCalled();
      expect((manager as any).currentFieldIndex.get('card1')).toBe(1);
    });

    it('should wrap to last field when at first field', () => {
      manager.setCurrentFieldIndex('card1', 0);
      manager.focusPreviousField('card1');

      expect(mockElement3.focus).toHaveBeenCalled();
      expect((manager as any).currentFieldIndex.get('card1')).toBe(2);
    });

    it('should focus specific field by index', () => {
      manager.focusField('card1', 1);

      expect(mockElement2.focus).toHaveBeenCalled();
      expect((manager as any).currentFieldIndex.get('card1')).toBe(1);
    });

    it('should focus first field when starting edit', () => {
      manager.focusFirstField('card1');

      expect(mockElement1.focus).toHaveBeenCalled();
      expect((manager as any).currentFieldIndex.get('card1')).toBe(0);
    });

    it('should focus last field', () => {
      manager.focusLastField('card1');

      expect(mockElement3.focus).toHaveBeenCalled();
      expect((manager as any).currentFieldIndex.get('card1')).toBe(2);
    });
  });

  describe('Field Navigation with Active Element', () => {
    beforeEach(() => {
      manager.startEdit('card1');
      manager.registerEditField('card1', mockElement1, 0);
      manager.registerEditField('card1', mockElement2, 1);
      manager.registerEditField('card1', mockElement3, 2);
    });

    it('should determine current field from active element', () => {
      Object.defineProperty(document, 'activeElement', {
        value: mockElement2,
        configurable: true,
      });

      const nextField = manager.getNextFieldFromActive('card1');
      expect(nextField).toBe(mockElement3);
    });

    it('should get previous field from active element', () => {
      Object.defineProperty(document, 'activeElement', {
        value: mockElement2,
        configurable: true,
      });

      const prevField = manager.getPreviousFieldFromActive('card1');
      expect(prevField).toBe(mockElement1);
    });

    it('should return null when no fields registered', () => {
      manager.unregisterEditFields('card1');

      const nextField = manager.getNextFieldFromActive('card1');
      expect(nextField).toBeNull();
    });
  });

  describe('Keyboard Shortcut State', () => {
    it('should track keyboard shortcut state', () => {
      manager.setKeyboardShortcutActive('save', true);
      expect(manager.isKeyboardShortcutActive('save')).toBe(true);

      manager.setKeyboardShortcutActive('save', false);
      expect(manager.isKeyboardShortcutActive('save')).toBe(false);
    });

    it('should track multiple shortcuts independently', () => {
      manager.setKeyboardShortcutActive('save', true);
      manager.setKeyboardShortcutActive('cancel', false);

      expect(manager.isKeyboardShortcutActive('save')).toBe(true);
      expect(manager.isKeyboardShortcutActive('cancel')).toBe(false);
    });

    it('should clear all keyboard shortcuts', () => {
      manager.setKeyboardShortcutActive('save', true);
      manager.setKeyboardShortcutActive('cancel', true);

      manager.clearKeyboardShortcuts();

      expect(manager.isKeyboardShortcutActive('save')).toBe(false);
      expect(manager.isKeyboardShortcutActive('cancel')).toBe(false);
    });
  });

  describe('Platform Detection', () => {
    it('should detect Mac platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      });

      expect(manager.isMacPlatform()).toBe(true);
    });

    it('should detect Windows platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });

      expect(manager.isMacPlatform()).toBe(false);
    });

    it('should detect Linux platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Linux x86_64',
        configurable: true,
      });

      expect(manager.isMacPlatform()).toBe(false);
    });

    it('should use correct modifier key for platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      });

      expect(manager.getModifierKey()).toBe('⌘');

      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });

      expect(manager.getModifierKey()).toBe('Ctrl');
    });
  });

  describe('Field Validation', () => {
    beforeEach(() => {
      manager.startEdit('card1');
      manager.registerEditField('card1', mockElement1, 0);
      manager.registerEditField('card1', mockElement2, 1);
    });

    it('should validate all fields before save', () => {
      const validator1 = jest.fn().mockReturnValue(true);
      const validator2 = jest.fn().mockReturnValue(true);

      manager.setFieldValidator('card1', 0, validator1);
      manager.setFieldValidator('card1', 1, validator2);

      const isValid = manager.validateAllFields('card1');

      expect(isValid).toBe(true);
      expect(validator1).toHaveBeenCalled();
      expect(validator2).toHaveBeenCalled();
    });

    it('should return false if any field validation fails', () => {
      const validator1 = jest.fn().mockReturnValue(true);
      const validator2 = jest.fn().mockReturnValue(false);

      manager.setFieldValidator('card1', 0, validator1);
      manager.setFieldValidator('card1', 1, validator2);

      const isValid = manager.validateAllFields('card1');

      expect(isValid).toBe(false);
    });

    it('should focus first invalid field', () => {
      const validator1 = jest.fn().mockReturnValue(false);
      const validator2 = jest.fn().mockReturnValue(true);

      manager.setFieldValidator('card1', 0, validator1);
      manager.setFieldValidator('card1', 1, validator2);

      manager.focusFirstInvalidField('card1');

      expect(mockElement1.focus).toHaveBeenCalled();
    });
  });

  describe('Keyboard Event Coordination', () => {
    it('should coordinate save across all fields', () => {
      const saveCallback = jest.fn();
      manager.onSave(saveCallback);

      manager.startEdit('card1');
      manager.triggerSave('card1');

      expect(saveCallback).toHaveBeenCalledWith('card1');
    });

    it('should coordinate cancel across all fields', () => {
      const cancelCallback = jest.fn();
      manager.onCancel(cancelCallback);

      manager.startEdit('card1');
      manager.triggerCancel('card1');

      expect(cancelCallback).toHaveBeenCalledWith('card1');
    });

    it('should handle global keyboard shortcuts', () => {
      const globalHandler = jest.fn();
      manager.setGlobalKeyboardHandler(globalHandler);

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      manager.handleGlobalKeyboardEvent(event);

      expect(globalHandler).toHaveBeenCalledWith(event);
    });
  });

  describe('Focus Trap', () => {
    beforeEach(() => {
      manager.startEdit('card1');
      manager.registerEditField('card1', mockElement1, 0);
      manager.registerEditField('card1', mockElement2, 1);
      manager.registerEditField('card1', mockElement3, 2);
    });

    it('should trap focus within card fields', () => {
      manager.enableFocusTrap('card1');
      expect(manager.isFocusTrapped('card1')).toBe(true);
    });

    it('should release focus trap', () => {
      manager.enableFocusTrap('card1');
      manager.disableFocusTrap('card1');
      expect(manager.isFocusTrapped('card1')).toBe(false);
    });

    it('should prevent focus outside trapped card', () => {
      manager.enableFocusTrap('card1');

      const outsideElement = document.createElement('input');
      document.body.appendChild(outsideElement);

      const focusEvent = new FocusEvent('focus');
      const prevented = manager.shouldPreventFocus('card1', outsideElement);

      expect(prevented).toBe(true);
    });

    it('should allow focus within trapped card fields', () => {
      manager.enableFocusTrap('card1');

      const prevented = manager.shouldPreventFocus('card1', mockElement2);

      expect(prevented).toBe(false);
    });
  });
});