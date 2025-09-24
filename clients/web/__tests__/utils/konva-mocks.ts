/**
 * Konva component mocks for testing canvas components
 */

import React from 'react';

// Mock Konva Stage
export const MockStage = ({ children, ...props }: {
  children?: React.ReactNode;
  width?: number;
  height?: number;
  onMouseDown?: (e: any) => void;
  onContextMenu?: (e: any) => void;
  [key: string]: any;
}) => React.createElement('div', {
  'data-testid': 'konva-stage',
  'data-width': props.width,
  'data-height': props.height,
  onClick: props.onMouseDown,
  onContextMenu: props.onContextMenu,
  ...props
}, children);

// Mock Konva Layer
export const MockLayer = ({ children, name, listening, perfectDrawEnabled, ...props }: {
  children?: React.ReactNode;
  name?: string;
  listening?: boolean;
  perfectDrawEnabled?: boolean;
  [key: string]: any;
}) => React.createElement('div', {
  'data-testid': 'konva-layer',
  'data-name': name,
  'data-listening': listening,
  'data-perfect-draw-enabled': perfectDrawEnabled,
  ...props
}, children);

// Mock Konva Group
export const MockGroup = ({ children, ...props }: {
  children?: React.ReactNode;
  x?: number;
  y?: number;
  draggable?: boolean;
  [key: string]: any;
}) => React.createElement('div', {
  'data-testid': 'konva-group',
  'data-x': props.x,
  'data-y': props.y,
  'data-draggable': props.draggable,
  ...props
}, children);

// Mock Konva Rect
export const MockRect = (props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  cornerRadius?: number;
  [key: string]: any;
}) => React.createElement('div', {
  'data-testid': 'konva-rect',
  'data-x': props.x,
  'data-y': props.y,
  'data-width': props.width,
  'data-height': props.height,
  'data-fill': props.fill,
  'data-stroke': props.stroke,
  'data-corner-radius': props.cornerRadius,
  ...props
});

// Mock Konva Text
export const MockText = (props: {
  x?: number;
  y?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  [key: string]: any;
}) => React.createElement('div', {
  'data-testid': 'konva-text',
  'data-x': props.x,
  'data-y': props.y,
  'data-text': props.text,
  'data-font-size': props.fontSize,
  'data-font-family': props.fontFamily,
  'data-fill': props.fill,
  ...props
});

// Mock react-konva components
export const mockKonvaComponents = {
  'react-konva': {
    Stage: MockStage,
    Layer: MockLayer,
    Group: MockGroup,
    Rect: MockRect,
    Text: MockText,
  },
};

// Function to setup Konva mocks
export const setupKonvaMocks = () => {
  // Mock individual Konva modules
  jest.mock('konva/lib/shapes/Rect', () => ({}));
  jest.mock('konva/lib/shapes/Text', () => ({}));
  jest.mock('konva/lib/Group', () => ({}));
  jest.mock('konva/lib/Stage', () => ({}));
  jest.mock('konva/lib/Layer', () => ({}));

  // Mock react-konva
  jest.mock('react-konva', () => ({
    Stage: MockStage,
    Layer: MockLayer,
    Group: MockGroup,
    Rect: MockRect,
    Text: MockText,
  }));
};

export default mockKonvaComponents;