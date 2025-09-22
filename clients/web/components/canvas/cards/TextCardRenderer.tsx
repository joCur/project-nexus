/**
 * TextCardRenderer - Renders text cards with background, border, and text content
 *
 * Supports both plain text and markdown content with proper styling
 * and visual feedback for selection, hover, and drag states.
 */

import React from 'react';
import { Rect, Text, Group } from 'react-konva';
import type { TextCard } from '@/types/card.types';

interface TextCardRendererProps {
  card: TextCard;
  isSelected: boolean;
  isDragged: boolean;
  isHovered: boolean;
}

/**
 * TextCardRenderer component
 */
export const TextCardRenderer: React.FC<TextCardRendererProps> = ({
  card,
  isSelected,
  isDragged,
  isHovered,
}) => {
  const { content, dimensions, style } = card;

  // Calculate visual state modifiers
  const isHighlighted = isSelected || isHovered;
  const selectionAlpha = isSelected ? 0.1 : 0;
  const hoverAlpha = isHovered && !isSelected ? 0.05 : 0;
  const highlightAlpha = Math.max(selectionAlpha, hoverAlpha);

  // Calculate border color with selection/hover feedback
  const borderColor = isSelected
    ? '#3B82F6' // Blue for selection
    : isHovered
    ? '#6B7280' // Gray for hover
    : style.borderColor;

  // Calculate border width with selection feedback
  const borderWidth = isSelected
    ? Math.max(style.borderWidth, 2)
    : style.borderWidth;

  // Calculate shadow for depth
  const shadowConfig = style.shadowConfig || {
    color: '#00000015',
    offsetX: 0,
    offsetY: 2,
    blur: 8,
    spread: 0,
  };

  // Enhanced shadow when selected or hovered
  const enhancedShadow = isHighlighted ? {
    ...shadowConfig,
    offsetY: shadowConfig.offsetY + 2,
    blur: shadowConfig.blur + 4,
  } : shadowConfig;

  // Calculate text metrics and positioning
  const padding = 16;
  const textWidth = dimensions.width - (padding * 2);
  const textHeight = dimensions.height - (padding * 2);

  // Determine font size based on card size
  const fontSize = Math.min(
    Math.max(12, Math.floor(dimensions.width / 20)),
    18
  );

  // Line height calculation
  const lineHeight = fontSize * 1.4;

  // Text truncation for large content
  const maxLines = Math.floor(textHeight / lineHeight);
  const displayText = content?.markdown
    ? (content?.content ?? '') // For now, display as plain text - markdown parsing can be added later
    : (content?.content ?? '');

  // Simple text truncation
  const words = displayText.split(' ');
  const wordsPerLine = Math.max(1, Math.floor(textWidth / (fontSize * 0.6)));
  const maxWords = maxLines * wordsPerLine;
  const truncatedText = words.length > maxWords
    ? words.slice(0, maxWords).join(' ') + '...'
    : displayText;

  return (
    <Group>
      {/* Drop shadow (if enabled) */}
      {style.shadow && (
        <Rect
          x={enhancedShadow.offsetX}
          y={enhancedShadow.offsetY}
          width={dimensions.width}
          height={dimensions.height}
          fill={enhancedShadow.color}
          cornerRadius={style.borderRadius}
          blur={enhancedShadow.blur}
        />
      )}

      {/* Main card background */}
      <Rect
        x={0}
        y={0}
        width={dimensions.width}
        height={dimensions.height}
        fill={style.backgroundColor}
        stroke={borderColor}
        strokeWidth={borderWidth}
        cornerRadius={style.borderRadius}
      />

      {/* Selection/hover highlight overlay */}
      {isHighlighted && (
        <Rect
          x={0}
          y={0}
          width={dimensions.width}
          height={dimensions.height}
          fill={isSelected ? '#3B82F6' : '#6B7280'}
          opacity={highlightAlpha}
          cornerRadius={style.borderRadius}
        />
      )}

      {/* Text content */}
      <Text
        x={padding}
        y={padding}
        width={textWidth}
        height={textHeight}
        text={truncatedText}
        fontSize={fontSize}
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fill={style.textColor}
        align="left"
        verticalAlign="top"
        wrap="word"
        lineHeight={lineHeight / fontSize} // Konva expects ratio
        ellipsis={true}
      />

      {/* Markdown indicator (if markdown is enabled) */}
      {content?.markdown && (
        <Group>
          <Rect
            x={dimensions.width - 24}
            y={8}
            width={16}
            height={12}
            fill="#6B7280"
            cornerRadius={2}
            opacity={0.7}
          />
          <Text
            x={dimensions.width - 22}
            y={10}
            text="M"
            fontSize={8}
            fontFamily="Inter, monospace"
            fill="white"
            align="center"
          />
        </Group>
      )}

      {/* Word count indicator for large content */}
      {(content?.wordCount ?? 0) > 100 && (
        <Text
          x={dimensions.width - 60}
          y={dimensions.height - 20}
          text={`${content?.wordCount ?? 0} words`}
          fontSize={10}
          fontFamily="Inter, sans-serif"
          fill="#9CA3AF"
          align="right"
        />
      )}

      {/* Drag visual feedback */}
      {isDragged && (
        <Rect
          x={0}
          y={0}
          width={dimensions.width}
          height={dimensions.height}
          stroke="#3B82F6"
          strokeWidth={2}
          dash={[5, 5]}
          cornerRadius={style.borderRadius}
          opacity={0.8}
        />
      )}
    </Group>
  );
};