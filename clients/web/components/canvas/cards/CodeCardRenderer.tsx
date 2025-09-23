/**
 * CodeCardRenderer - Renders code snippet cards with syntax highlighting and execution results
 *
 * Displays code content with language indicators, line numbers, execution status,
 * and results. Supports various programming languages and execution feedback.
 */

import React from 'react';
import { Rect, Text, Group } from 'react-konva';
import type { CodeCard } from '@/types/card.types';
import { CARD_CONFIG } from './cardConfig';

interface CodeCardRendererProps {
  card: CodeCard;
  isSelected: boolean;
  isDragged: boolean;
  isHovered: boolean;
}

/**
 * CodeCardRenderer component
 */
export const CodeCardRenderer: React.FC<CodeCardRendererProps> = ({
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

  // Layout calculations
  const padding = 12;
  const headerHeight = 28;
  const footerHeight = content.executionResults ? 24 : 0;
  const lineNumberWidth = 32;

  // Content areas
  const headerArea = {
    x: padding,
    y: padding,
    width: dimensions.width - (padding * 2),
    height: headerHeight,
  };

  const codeArea = {
    x: padding + lineNumberWidth,
    y: padding + headerHeight,
    width: dimensions.width - (padding * 2) - lineNumberWidth,
    height: dimensions.height - padding - headerHeight - footerHeight - padding,
  };

  const lineNumberArea = {
    x: padding,
    y: padding + headerHeight,
    width: lineNumberWidth,
    height: codeArea.height,
  };

  const footerArea = {
    x: padding,
    y: dimensions.height - footerHeight - padding,
    width: dimensions.width - (padding * 2),
    height: footerHeight,
  };

  // Language-specific styling
  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      javascript: '#F7DF1E',
      typescript: '#3178C6',
      python: '#3776AB',
      java: '#ED8B00',
      cpp: '#00599C',
      csharp: '#239120',
      php: '#777BB4',
      ruby: '#CC342D',
      go: '#00ADD8',
      rust: '#000000',
      swift: '#FA7343',
      kotlin: '#7F52FF',
      html: '#E34F26',
      css: '#1572B6',
      sql: '#336791',
      bash: '#4EAA25',
      json: '#000000',
      xml: '#FF6600',
      yaml: '#CB171E',
      markdown: '#083FA1',
    };
    return colors[language.toLowerCase()] || '#6B7280';
  };

  // Generate line numbers
  const lines = content.content.split('\n');
  const lineNumbers = Array.from({ length: Math.min(lines.length, 20) }, (_, i) => i + 1);

  // Truncate code for display
  const maxLines = Math.floor(codeArea.height / 14); // Assuming 14px line height
  const displayLines = lines.slice(0, maxLines);
  const truncatedCode = displayLines.join('\n');
  const isTruncated = lines.length > maxLines;

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
        fill={CARD_CONFIG.colors.codeBackground}
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

      {/* Header */}
      <Group>
        {/* Header background */}
        <Rect
          x={0}
          y={0}
          width={dimensions.width}
          height={headerHeight + padding}
          fill="#2D2D2D"
          cornerRadius={[style.borderRadius, style.borderRadius, 0, 0]}
        />

        {/* Language indicator */}
        <Rect
          x={headerArea.x}
          y={headerArea.y + 4}
          width={Math.min(80, headerArea.width / 3)}
          height={16}
          fill={getLanguageColor(content.language)}
          cornerRadius={8}
        />

        {/* Language text */}
        <Text
          x={headerArea.x + 4}
          y={headerArea.y + 6}
          text={content.language.toUpperCase()}
          fontSize={10}
          fontFamily="Inter, monospace"
          fill="white"
          align="left"
        />

        {/* Filename (if provided) */}
        {content.filename && (
          <Text
            x={headerArea.x + Math.min(80, headerArea.width / 3) + 12}
            y={headerArea.y + 6}
            width={headerArea.width - Math.min(80, headerArea.width / 3) - 60}
            text={content.filename}
            fontSize={11}
            fontFamily="Inter, monospace"
            fill="#A0A0A0"
            align="left"
            ellipsis={true}
          />
        )}

        {/* Execution status */}
        {content.hasExecuted !== undefined && (
          <Group>
            <Rect
              x={headerArea.x + headerArea.width - 48}
              y={headerArea.y + 4}
              width={40}
              height={16}
              fill={content.hasExecuted ? '#10B981' : '#6B7280'}
              cornerRadius={8}
            />
            <Text
              x={headerArea.x + headerArea.width - 46}
              y={headerArea.y + 6}
              text={content.hasExecuted ? 'RUN' : 'CODE'}
              fontSize={9}
              fontFamily="Inter, monospace"
              fill="white"
              align="left"
            />
          </Group>
        )}
      </Group>

      {/* Line numbers background */}
      <Rect
        x={0}
        y={headerHeight + padding}
        width={lineNumberWidth + padding}
        height={codeArea.height}
        fill="#252525"
      />

      {/* Line numbers */}
      {lineNumbers.map((lineNum, index) => (
        <Text
          key={lineNum}
          x={lineNumberArea.x}
          y={lineNumberArea.y + index * 14}
          width={lineNumberWidth - 4}
          text={lineNum.toString()}
          fontSize={11}
          fontFamily="JetBrains Mono, Monaco, 'Cascadia Code', monospace"
          fill="#6B7280"
          align="right"
        />
      ))}

      {/* Vertical separator */}
      <Rect
        x={lineNumberWidth + padding}
        y={headerHeight + padding}
        width={1}
        height={codeArea.height}
        fill="#404040"
      />

      {/* Code content */}
      <Text
        x={codeArea.x + 8}
        y={codeArea.y + 2}
        width={codeArea.width - 8}
        height={codeArea.height - 4}
        text={truncatedCode}
        fontSize={12}
        fontFamily="JetBrains Mono, Monaco, 'Cascadia Code', monospace"
        fill="#F8F8F2" // Light text on dark background
        align="left"
        verticalAlign="top"
        lineHeight={14 / 12} // 14px line height
      />

      {/* Truncation indicator */}
      {isTruncated && (
        <Text
          x={codeArea.x + codeArea.width - 40}
          y={codeArea.y + codeArea.height - 16}
          text="..."
          fontSize={12}
          fontFamily="JetBrains Mono, Monaco, 'Cascadia Code', monospace"
          fill="#6B7280"
          align="right"
        />
      )}

      {/* Footer with execution results */}
      {content.executionResults && (
        <Group>
          {/* Footer background */}
          <Rect
            x={0}
            y={dimensions.height - footerHeight - padding}
            width={dimensions.width}
            height={footerHeight + padding}
            fill={content.executionResults.error ? "#7F1D1D" : "#1E3A8A"}
            cornerRadius={[0, 0, style.borderRadius, style.borderRadius]}
          />

          {/* Execution timestamp */}
          <Text
            x={footerArea.x}
            y={footerArea.y + 4}
            text={`Executed: ${new Date(content.executionResults.timestamp).toLocaleTimeString()}`}
            fontSize={9}
            fontFamily="Inter, monospace"
            fill="#A0A0A0"
            align="left"
          />

          {/* Result indicator */}
          <Text
            x={footerArea.x + footerArea.width - 80}
            y={footerArea.y + 4}
            width={80}
            text={content.executionResults.error ? 'ERROR' : 'SUCCESS'}
            fontSize={10}
            fontFamily="Inter, monospace"
            fontStyle="bold"
            fill="white"
            align="right"
          />
        </Group>
      )}

      {/* Line count indicator */}
      <Text
        x={dimensions.width - 60}
        y={8}
        text={`${content.lineCount} lines`}
        fontSize={10}
        fontFamily="Inter, sans-serif"
        fill="#9CA3AF"
        align="right"
      />

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