/**
 * LinkCardRenderer - Renders link preview cards with favicon, title, and description
 *
 * Displays rich link previews with domain information, accessibility status,
 * and visual indicators for link validity and last check status.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Rect, Text, Group, Image as KonvaImage } from 'react-konva';
import type { LinkCard } from '@/types/card.types';
import { sanitizeImageUrl, createSecureImage, cleanupImage } from './imageSecurityUtils';

interface LinkCardRendererProps {
  card: LinkCard;
  isSelected: boolean;
  isDragged: boolean;
  isHovered: boolean;
}

/**
 * Custom hook for loading images with security validation and cleanup
 */
const useImageLoader = (url: string | undefined) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>();

  useEffect(() => {
    if (!url) {
      setImage(null);
      setLoaded(false);
      return;
    }

    // Validate URL before loading
    const sanitizedUrl = sanitizeImageUrl(url);
    if (!sanitizedUrl) {
      console.warn('Invalid or unsafe image URL:', url);
      setLoaded(false);
      setImage(null);
      return;
    }

    const img = createSecureImage();

    img.onload = () => {
      setImage(img);
      setLoaded(true);
    };

    img.onerror = () => {
      setLoaded(false);
      setImage(null);
    };

    img.src = sanitizedUrl;
    imageRef.current = img;

    // Cleanup with security utility
    return () => {
      cleanupImage(imageRef.current);
      imageRef.current = undefined;
    };
  }, [url]);

  return { image, loaded };
};

/**
 * LinkCardRenderer component
 */
export const LinkCardRenderer: React.FC<LinkCardRendererProps> = ({
  card,
  isSelected,
  isDragged,
  isHovered,
}) => {
  const { content, dimensions, style } = card;

  // Use custom hook for loading images
  const { image: favicon, loaded: faviconLoaded } = useImageLoader(content.favicon);
  const { image: previewImage, loaded: previewLoaded } = useImageLoader(content.previewImage);

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
    : content.isAccessible
    ? style.borderColor
    : '#EF4444'; // Red for inaccessible links

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
  const faviconSize = 16;
  const previewHeight = content.previewImage ? 60 : 0;
  const headerHeight = 24;
  const statusHeight = 16;

  // Content areas
  const headerArea = {
    x: padding,
    y: padding,
    width: dimensions.width - (padding * 2),
    height: headerHeight,
  };

  const previewArea = {
    x: padding,
    y: padding + headerHeight + 4,
    width: dimensions.width - (padding * 2),
    height: previewHeight,
  };

  const contentArea = {
    x: padding,
    y: padding + headerHeight + (previewHeight ? previewHeight + 8 : 4),
    width: dimensions.width - (padding * 2),
    height: dimensions.height - padding - headerHeight - (previewHeight ? previewHeight + 8 : 4) - statusHeight - padding,
  };

  const statusArea = {
    x: padding,
    y: dimensions.height - statusHeight - padding,
    width: dimensions.width - (padding * 2),
    height: statusHeight,
  };

  // Truncate text helper
  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

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

      {/* Header with favicon and domain */}
      <Group>
        {/* Favicon */}
        {faviconLoaded && favicon ? (
          <KonvaImage
            x={headerArea.x}
            y={headerArea.y + (headerHeight - faviconSize) / 2}
            width={faviconSize}
            height={faviconSize}
            image={favicon}
          />
        ) : (
          <Rect
            x={headerArea.x}
            y={headerArea.y + (headerHeight - faviconSize) / 2}
            width={faviconSize}
            height={faviconSize}
            fill="#E5E7EB"
            cornerRadius={2}
          />
        )}

        {/* Domain */}
        <Text
          x={headerArea.x + faviconSize + 8}
          y={headerArea.y}
          width={headerArea.width - faviconSize - 8}
          height={headerHeight}
          text={content.domain}
          fontSize={12}
          fontFamily="Inter, sans-serif"
          fill="#6B7280"
          align="left"
          verticalAlign="middle"
          ellipsis={true}
        />
      </Group>

      {/* Preview image (if available) */}
      {content.previewImage && (
        <Group>
          {previewLoaded && previewImage ? (
            <KonvaImage
              x={previewArea.x}
              y={previewArea.y}
              width={previewArea.width}
              height={previewArea.height}
              image={previewImage}
              cornerRadius={4}
            />
          ) : (
            <Rect
              x={previewArea.x}
              y={previewArea.y}
              width={previewArea.width}
              height={previewArea.height}
              fill="#F3F4F6"
              stroke="#E5E7EB"
              strokeWidth={1}
              cornerRadius={4}
            />
          )}
        </Group>
      )}

      {/* Title */}
      <Text
        x={contentArea.x}
        y={contentArea.y}
        width={contentArea.width}
        text={truncateText(content.title, 60)}
        fontSize={14}
        fontFamily="Inter, sans-serif"
        fontStyle="bold"
        fill={style.textColor}
        align="left"
        wrap="word"
        lineHeight={1.3}
      />

      {/* Description */}
      {content.description && (
        <Text
          x={contentArea.x}
          y={contentArea.y + 20}
          width={contentArea.width}
          height={contentArea.height - 20}
          text={truncateText(content.description, 120)}
          fontSize={12}
          fontFamily="Inter, sans-serif"
          fill="#6B7280"
          align="left"
          wrap="word"
          lineHeight={1.4}
          ellipsis={true}
        />
      )}

      {/* Status bar */}
      <Group>
        {/* Accessibility indicator */}
        <Rect
          x={statusArea.x}
          y={statusArea.y}
          width={8}
          height={8}
          fill={content.isAccessible ? '#10B981' : '#EF4444'}
          cornerRadius={4}
        />

        {/* URL truncated */}
        <Text
          x={statusArea.x + 12}
          y={statusArea.y}
          width={statusArea.width - 80}
          height={statusHeight}
          text={truncateText(content.url, 40)}
          fontSize={10}
          fontFamily="Inter, monospace"
          fill="#9CA3AF"
          align="left"
          verticalAlign="middle"
          ellipsis={true}
        />

        {/* Last checked indicator */}
        {content.lastChecked && (
          <Text
            x={statusArea.x + statusArea.width - 60}
            y={statusArea.y}
            width={60}
            height={statusHeight}
            text={new Date(content.lastChecked).toLocaleDateString()}
            fontSize={9}
            fontFamily="Inter, sans-serif"
            fill="#9CA3AF"
            align="right"
            verticalAlign="middle"
          />
        )}
      </Group>

      {/* External link indicator */}
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
          text="↗"
          fontSize={8}
          fontFamily="Inter, sans-serif"
          fill="white"
          align="center"
        />
      </Group>

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