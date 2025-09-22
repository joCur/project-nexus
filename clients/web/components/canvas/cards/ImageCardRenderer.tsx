/**
 * ImageCardRenderer - Renders image cards with loading states and captions
 *
 * Handles image loading, error states, and displays image content with
 * optional captions and metadata. Includes proper aspect ratio handling.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Rect, Text, Group, Image as KonvaImage } from 'react-konva';
import type { ImageCard } from '@/types/card.types';
import { CARD_CONFIG, ImageCache } from './cardConfig';

interface ImageCardRendererProps {
  card: ImageCard;
  isSelected: boolean;
  isDragged: boolean;
  isHovered: boolean;
}

/**
 * ImageCardRenderer component
 */
export const ImageCardRenderer: React.FC<ImageCardRendererProps> = ({
  card,
  isSelected,
  isDragged,
  isHovered,
}) => {
  const { content, dimensions, style } = card;
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imageRef = useRef<HTMLImageElement>();

  // Load image with caching
  useEffect(() => {
    let isMounted = true;

    if (content.url) {
      const imageSrc = content.thumbnail || content.url;

      ImageCache.getImage(imageSrc)
        .then((img) => {
          if (isMounted) {
            setImage(img);
            setImageLoaded(true);
            setImageError(false);
            imageRef.current = img;
          }
        })
        .catch((error) => {
          if (isMounted) {
            console.warn('Image loading failed:', error);
            setImageError(true);
            setImageLoaded(false);
            setImage(null);
          }
        });
    }

    // Cleanup function with better memory management
    return () => {
      isMounted = false;
      if (imageRef.current) {
        // Clear event handlers
        imageRef.current.onload = null;
        imageRef.current.onerror = null;
        // Help with garbage collection
        imageRef.current.src = '';
        imageRef.current = undefined;
      }
    };
  }, [content.url, content.thumbnail]);

  // Calculate visual state modifiers
  const isHighlighted = isSelected || isHovered;
  const selectionAlpha = isSelected ? 0.1 : 0;
  const hoverAlpha = isHovered && !isSelected ? 0.05 : 0;
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

  // Calculate image dimensions and positioning
  const padding = CARD_CONFIG.padding / 2; // Half padding for image area
  const captionHeight = content.caption ? 30 : 0;
  const imageArea = {
    x: padding,
    y: padding,
    width: dimensions.width - (padding * 2),
    height: dimensions.height - (padding * 2) - captionHeight,
  };

  // Calculate scaled image dimensions to fit within bounds
  const getImageDimensions = () => {
    if (!image) return { width: 0, height: 0, x: 0, y: 0 };

    const aspectRatio = image.width / image.height;
    const areaAspectRatio = imageArea.width / imageArea.height;

    let scaledWidth, scaledHeight;

    if (aspectRatio > areaAspectRatio) {
      // Image is wider than area
      scaledWidth = imageArea.width;
      scaledHeight = imageArea.width / aspectRatio;
    } else {
      // Image is taller than area
      scaledHeight = imageArea.height;
      scaledWidth = imageArea.height * aspectRatio;
    }

    // Center the image
    const x = imageArea.x + (imageArea.width - scaledWidth) / 2;
    const y = imageArea.y + (imageArea.height - scaledHeight) / 2;

    return { width: scaledWidth, height: scaledHeight, x, y };
  };

  const imageDims = getImageDimensions();

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

      {/* Image content or placeholder */}
      {imageLoaded && image ? (
        <Group>
          {/* Clip mask for rounded corners */}
          <Rect
            x={imageArea.x}
            y={imageArea.y}
            width={imageArea.width}
            height={imageArea.height}
            cornerRadius={Math.max(0, style.borderRadius - padding)}
            clipFunc={(ctx: CanvasRenderingContext2D) => {
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(
                imageArea.x,
                imageArea.y,
                imageArea.width,
                imageArea.height,
                Math.max(0, style.borderRadius - padding)
              );
              ctx.clip();
            }}
          />

          {/* Actual image */}
          <KonvaImage
            x={imageDims.x}
            y={imageDims.y}
            width={imageDims.width}
            height={imageDims.height}
            image={image}
            cornerRadius={Math.max(0, style.borderRadius - padding)}
          />
        </Group>
      ) : imageError ? (
        // Error state
        <Group>
          <Rect
            x={imageArea.x}
            y={imageArea.y}
            width={imageArea.width}
            height={imageArea.height}
            fill="#FEF2F2"
            stroke="#FECACA"
            strokeWidth={1}
            cornerRadius={Math.max(0, style.borderRadius - padding)}
          />
          <Text
            x={imageArea.x}
            y={imageArea.y + imageArea.height / 2 - 20}
            width={imageArea.width}
            text="⚠️\nImage failed to load"
            fontSize={14}
            fontFamily="Inter, sans-serif"
            fill="#DC2626"
            align="center"
            verticalAlign="middle"
          />
        </Group>
      ) : (
        // Loading state
        <Group>
          <Rect
            x={imageArea.x}
            y={imageArea.y}
            width={imageArea.width}
            height={imageArea.height}
            fill="#F9FAFB"
            stroke="#E5E7EB"
            strokeWidth={1}
            cornerRadius={Math.max(0, style.borderRadius - padding)}
          />
          <Text
            x={imageArea.x}
            y={imageArea.y + imageArea.height / 2 - 10}
            width={imageArea.width}
            text="Loading image..."
            fontSize={12}
            fontFamily="Inter, sans-serif"
            fill="#6B7280"
            align="center"
            verticalAlign="middle"
          />
        </Group>
      )}

      {/* Caption */}
      {content.caption && (
        <Text
          x={padding}
          y={dimensions.height - captionHeight}
          width={dimensions.width - (padding * 2)}
          height={captionHeight}
          text={content.caption}
          fontSize={11}
          fontFamily="Inter, sans-serif"
          fill="#6B7280"
          align="center"
          verticalAlign="middle"
          wrap="word"
          ellipsis={true}
        />
      )}

      {/* Alt text indicator (accessibility) */}
      {content.alt && (
        <Group>
          <Rect
            x={8}
            y={8}
            width={20}
            height={16}
            fill="#059669"
            cornerRadius={3}
            opacity={0.8}
          />
          <Text
            x={10}
            y={11}
            text="ALT"
            fontSize={8}
            fontFamily="Inter, sans-serif"
            fill="white"
            align="left"
          />
        </Group>
      )}

      {/* File size indicator for large images */}
      {content.fileSize && content.fileSize > 1024 * 1024 && (
        <Text
          x={dimensions.width - 60}
          y={8}
          text={`${Math.round(content.fileSize / (1024 * 1024) * 10) / 10}MB`}
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