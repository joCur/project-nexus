/**
 * TextCardRenderer - Renders text cards with background, border, and text content
 *
 * Supports both plain text and markdown content with proper styling
 * and visual feedback for selection, hover, and drag states.
 */

import React from 'react';
import { Rect, Text, Group } from 'react-konva';
import type { TextCard } from '@/types/card.types';
import { CARD_CONFIG } from './cardConfig';

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
  const selectionAlpha = isSelected ? CARD_CONFIG.opacity.selection : 0;
  const hoverAlpha = isHovered && !isSelected ? CARD_CONFIG.opacity.hover : 0;
  const highlightAlpha = Math.max(selectionAlpha, hoverAlpha);

  // Calculate border color with selection/hover feedback
  const borderColor = isSelected
    ? CARD_CONFIG.colors.selectedBorder
    : isHovered
    ? CARD_CONFIG.colors.hoverBorder
    : style.borderColor;

  // Calculate border width with selection feedback
  const borderWidth = isSelected
    ? Math.max(style.borderWidth, CARD_CONFIG.borderWidth)
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
  const padding = CARD_CONFIG.padding;
  const textWidth = dimensions.width - (padding * 2);
  const textHeight = dimensions.height - (padding * 2);

  // Determine font size based on card size
  const fontSize = Math.min(
    Math.max(CARD_CONFIG.fontSize.min, Math.floor(dimensions.width / CARD_CONFIG.fontSize.scaleFactor)),
    CARD_CONFIG.fontSize.max
  );

  // Line height calculation
  const lineHeight = fontSize * CARD_CONFIG.lineHeight;

  // Text truncation for large content
  const maxLines = Math.floor(textHeight / lineHeight);
  const displayText = content?.markdown
    ? (content?.content ?? '') // For now, display as plain text - markdown parsing can be added later
    : (content?.content ?? '');

  // Text measurement utilities for accurate text wrapping
  const measureTextWidth = (text: string): number => {
    // Use the more accurate character width estimation from CARD_CONFIG
    return text.length * fontSize * CARD_CONFIG.text.characterWidthEstimate;
  };

  // Improved text truncation with better word wrapping
  const truncateText = (text: string, maxWidth: number, maxHeight: number): string => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    const maxLinesCount = Math.floor(maxHeight / lineHeight);

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = measureTextWidth(testLine);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;

          // Check if adding this word would exceed max lines
          if (lines.length >= maxLinesCount) {
            // Truncate the last line to fit ellipsis
            const lastLine = lines[lines.length - 1];
            const ellipsisWidth = measureTextWidth('...');
            let truncatedLine = lastLine;

            while (measureTextWidth(truncatedLine + '...') > maxWidth && truncatedLine.length > 0) {
              truncatedLine = truncatedLine.slice(0, -1);
            }

            lines[lines.length - 1] = truncatedLine + '...';
            break;
          }
        } else {
          // Single word is too long, truncate it
          let truncatedWord = word;
          const ellipsisWidth = measureTextWidth('...');

          while (measureTextWidth(truncatedWord + '...') > maxWidth && truncatedWord.length > 0) {
            truncatedWord = truncatedWord.slice(0, -1);
          }

          lines.push(truncatedWord + '...');
          break;
        }
      }
    }

    // Add remaining current line if it fits
    if (currentLine && lines.length < maxLinesCount) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  };

  const truncatedText = truncateText(displayText, textWidth, textHeight);

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
          fill={isSelected ? CARD_CONFIG.colors.selectedBorder : CARD_CONFIG.colors.secondaryText}
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
            fill={CARD_CONFIG.colors.secondaryText}
            cornerRadius={2}
            opacity={CARD_CONFIG.opacity.altIndicator}
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
          fontSize={CARD_CONFIG.fontSize.indicator}
          fontFamily="Inter, sans-serif"
          fill={CARD_CONFIG.colors.secondaryText}
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
          stroke={CARD_CONFIG.colors.selectedBorder}
          strokeWidth={2}
          dash={[5, 5]}
          cornerRadius={style.borderRadius}
          opacity={CARD_CONFIG.opacity.dragIndicator}
        />
      )}
    </Group>
  );
};