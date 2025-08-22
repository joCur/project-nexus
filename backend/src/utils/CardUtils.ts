/**
 * Card utility functions
 * Helper functions for card operations, transformations, and data processing
 */

import { 
  Card, 
  DbCard, 
  CardType, 
  CardStatus, 
  CardPriority,
  CardAnimation,
  CardPosition, 
  CardDimensions,
  ConflictResolution,
  CardConflict,
  UpdateCardInput,
  ConflictStrategy,
  DEFAULT_CARD_STYLE
} from '@/types/CardTypes';
import { createHash } from 'crypto';

/**
 * Database transformation utilities
 */
export class CardMapper {
  /**
   * Map database card record to Card interface
   */
  static mapDbCardToCard(dbCard: DbCard): Card {
    const defaultAnimation: CardAnimation = {
      isAnimating: false,
    };

    return {
      id: dbCard.id,
      workspaceId: dbCard.workspace_id,
      type: dbCard.type as CardType,
      title: dbCard.title,
      content: dbCard.content,
      position: {
        x: dbCard.position_x,
        y: dbCard.position_y,
        z: dbCard.z_index,
      },
      dimensions: {
        width: dbCard.width,
        height: dbCard.height,
      },
      metadata: this.parseJsonSafely(dbCard.metadata, {}),
      status: dbCard.status as CardStatus,
      priority: dbCard.priority as CardPriority,
      style: this.parseJsonSafely(dbCard.style, DEFAULT_CARD_STYLE),
      version: dbCard.version,
      createdAt: new Date(dbCard.created_at),
      updatedAt: new Date(dbCard.updated_at),
      createdBy: dbCard.created_by,
      lastModifiedBy: dbCard.last_modified_by,
      tags: this.parseJsonSafely(dbCard.tags, []),
      lastSavedAt: dbCard.last_saved_at ? new Date(dbCard.last_saved_at) : undefined,
      isDirty: dbCard.is_dirty,
      isLocked: dbCard.is_locked,
      isHidden: dbCard.is_hidden,
      isMinimized: dbCard.is_minimized,
      isSelected: dbCard.is_selected,
      rotation: dbCard.rotation,
      animation: this.parseJsonSafely(dbCard.animation, defaultAnimation),
      embeddings: dbCard.embedding,
      analysisResults: dbCard.analysis_results ? this.parseJsonSafely(dbCard.analysis_results, undefined) : undefined,
    };
  }

  /**
   * Map Card interface to database record
   */
  static mapCardToDbCard(card: Card): Omit<DbCard, 'created_at' | 'updated_at'> {
    return {
      id: card.id,
      workspace_id: card.workspaceId,
      type: card.type,
      title: card.title,
      content: card.content,
      position_x: card.position.x,
      position_y: card.position.y,
      z_index: card.position.z,
      width: card.dimensions.width,
      height: card.dimensions.height,
      metadata: JSON.stringify(card.metadata),
      status: card.status,
      priority: card.priority,
      style: JSON.stringify(card.style),
      version: card.version,
      created_by: card.createdBy,
      last_modified_by: card.lastModifiedBy,
      tags: JSON.stringify(card.tags),
      last_saved_at: card.lastSavedAt,
      is_dirty: card.isDirty,
      is_locked: card.isLocked,
      is_hidden: card.isHidden,
      is_minimized: card.isMinimized,
      is_selected: card.isSelected,
      rotation: card.rotation,
      animation: JSON.stringify(card.animation),
      embedding: card.embeddings,
      embedding_model: card.embeddings ? 'text-embedding-ada-002' : undefined,
      embedding_created_at: card.embeddings ? new Date() : undefined,
      content_hash: card.embeddings ? this.generateContentHash(card.content) : undefined,
      analysis_results: card.analysisResults ? JSON.stringify(card.analysisResults) : undefined,
    };
  }

  /**
   * Safely parse JSON with fallback
   */
  private static parseJsonSafely<T>(jsonString: string | undefined, fallback: T): T {
    if (!jsonString) return fallback;
    try {
      return JSON.parse(jsonString);
    } catch {
      return fallback;
    }
  }

  /**
   * Generate content hash for embedding tracking
   */
  private static generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

/**
 * Position and geometry utilities
 */
export class CardGeometry {
  /**
   * Calculate distance between two card positions
   */
  static calculateDistance(pos1: CardPosition, pos2: CardPosition): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if two cards overlap
   */
  static checkOverlap(
    pos1: CardPosition,
    dim1: CardDimensions,
    pos2: CardPosition,
    dim2: CardDimensions
  ): boolean {
    return !(
      pos1.x + dim1.width < pos2.x ||
      pos2.x + dim2.width < pos1.x ||
      pos1.y + dim1.height < pos2.y ||
      pos2.y + dim2.height < pos1.y
    );
  }

  /**
   * Get bounding box for multiple cards
   */
  static getBoundingBox(cards: Array<{ position: CardPosition; dimensions: CardDimensions }>): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  } {
    if (cards.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    cards.forEach(card => {
      minX = Math.min(minX, card.position.x);
      minY = Math.min(minY, card.position.y);
      maxX = Math.max(maxX, card.position.x + card.dimensions.width);
      maxY = Math.max(maxY, card.position.y + card.dimensions.height);
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Check if a point is within a card's bounds
   */
  static isPointInCard(
    point: { x: number; y: number },
    position: CardPosition,
    dimensions: CardDimensions
  ): boolean {
    return point.x >= position.x &&
           point.x <= position.x + dimensions.width &&
           point.y >= position.y &&
           point.y <= position.y + dimensions.height;
  }

  /**
   * Find optimal position to avoid overlaps
   */
  static findNonOverlappingPosition(
    dimensions: CardDimensions,
    existingCards: Array<{ position: CardPosition; dimensions: CardDimensions }>,
    preferredPosition?: CardPosition,
    maxAttempts: number = 50
  ): CardPosition {
    const basePosition = preferredPosition || { x: 0, y: 0, z: 0 };
    
    // Try the preferred position first
    if (!existingCards.some(card => 
      this.checkOverlap(basePosition, dimensions, card.position, card.dimensions)
    )) {
      return basePosition;
    }

    // Try positions in a spiral pattern
    const step = 50;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const radius = Math.ceil(attempt / 8) * step;
      const angle = (attempt % 8) * (Math.PI / 4);
      
      const position: CardPosition = {
        x: basePosition.x + Math.cos(angle) * radius,
        y: basePosition.y + Math.sin(angle) * radius,
        z: basePosition.z,
      };

      if (!existingCards.some(card => 
        this.checkOverlap(position, dimensions, card.position, card.dimensions)
      )) {
        return position;
      }
    }

    // If no non-overlapping position found, return a position far from others
    return {
      x: basePosition.x + 1000,
      y: basePosition.y + 1000,
      z: basePosition.z,
    };
  }
}

/**
 * Content and analysis utilities
 */
export class CardContent {
  /**
   * Extract text content from different card types
   */
  static extractTextContent(card: Card): string {
    switch (card.type) {
      case CardType.TEXT:
      case CardType.CODE:
        return card.content;
      
      case CardType.LINK:
        return card.title || card.content;
      
      case CardType.IMAGE:
      case CardType.FILE:
        return card.title || '';
      
      case CardType.DRAWING:
        try {
          const drawingData = JSON.parse(card.content);
          return drawingData.text || drawingData.description || '';
        } catch {
          return '';
        }
      
      default:
        return card.content;
    }
  }

  /**
   * Calculate content size in bytes
   */
  static calculateContentSize(card: Card): number {
    const content = card.content || '';
    const metadata = JSON.stringify(card.metadata || {});
    const tags = JSON.stringify(card.tags || []);
    const title = card.title || '';
    
    return Buffer.byteLength(content, 'utf8') +
           Buffer.byteLength(metadata, 'utf8') +
           Buffer.byteLength(tags, 'utf8') +
           Buffer.byteLength(title, 'utf8');
  }

  /**
   * Generate search keywords from card content
   */
  static generateSearchKeywords(card: Card): string[] {
    const textContent = this.extractTextContent(card);
    const title = card.title || '';
    const tags = card.tags || [];
    
    const words = [...textContent.split(/\W+/), ...title.split(/\W+/), ...tags]
      .filter(word => word.length > 2)
      .map(word => word.toLowerCase())
      .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
    
    return words.slice(0, 50); // Limit to 50 keywords
  }

  /**
   * Truncate content for preview
   */
  static truncateContent(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) return content;
    
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return lastSpace > maxLength * 0.7 
      ? truncated.substring(0, lastSpace) + '...'
      : truncated + '...';
  }
}

/**
 * Conflict resolution utilities
 */
export class CardConflictResolver {
  /**
   * Detect conflicts between client and server versions
   */
  static detectConflicts(
    clientUpdates: UpdateCardInput,
    serverCard: Card,
    clientVersion: number
  ): CardConflict | null {
    if (clientVersion >= serverCard.version) {
      return null; // No conflict
    }

    const conflictedFields: string[] = [];
    
    // Check for content conflicts
    if (clientUpdates.content !== undefined && clientUpdates.content !== serverCard.content) {
      conflictedFields.push('content');
    }
    
    if (clientUpdates.title !== undefined && clientUpdates.title !== serverCard.title) {
      conflictedFields.push('title');
    }
    
    if (clientUpdates.position && !this.positionsEqual(clientUpdates.position, serverCard.position)) {
      conflictedFields.push('position');
    }
    
    if (clientUpdates.dimensions && !this.dimensionsEqual(clientUpdates.dimensions, serverCard.dimensions)) {
      conflictedFields.push('dimensions');
    }

    if (conflictedFields.length === 0) {
      return null;
    }

    return {
      cardId: serverCard.id,
      clientData: clientUpdates,
      serverData: serverCard,
    };
  }

  /**
   * Resolve conflicts based on strategy
   */
  static resolveConflict(
    conflict: CardConflict,
    strategy: ConflictStrategy
  ): UpdateCardInput {
    // Create resolution metadata for potential logging/audit
    const _resolution: ConflictResolution = {
      strategy,
      clientVersion: conflict.clientData.position ? 0 : 1, // This would come from actual client
      serverVersion: conflict.serverData.version,
      conflictedFields: this.getConflictedFields(conflict),
    };

    switch (strategy) {
      case ConflictStrategy.CLIENT_WINS:
        return conflict.clientData;
      
      case ConflictStrategy.SERVER_WINS:
        return {}; // No updates applied
      
      case ConflictStrategy.MERGE:
        return this.mergeUpdates(conflict.clientData, conflict.serverData);
      
      case ConflictStrategy.MANUAL:
        // Return conflicted data for manual resolution
        return conflict.clientData;
      
      default:
        throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
    }
  }

  /**
   * Merge client and server updates intelligently
   */
  private static mergeUpdates(clientData: UpdateCardInput, serverData: Card): UpdateCardInput {
    const merged: UpdateCardInput = {};

    // For content, prefer client changes if they exist
    if (clientData.content !== undefined) {
      merged.content = clientData.content;
    }

    // For metadata, merge objects
    if (clientData.metadata) {
      merged.metadata = {
        ...serverData.metadata,
        ...clientData.metadata,
      };
    }

    // For tags, merge arrays
    if (clientData.tags) {
      const serverTags = serverData.tags || [];
      const clientTags = clientData.tags;
      merged.tags = [...new Set([...serverTags, ...clientTags])];
    }

    // For position and dimensions, prefer client
    if (clientData.position) {
      merged.position = clientData.position;
    }

    if (clientData.dimensions) {
      merged.dimensions = clientData.dimensions;
    }

    return merged;
  }

  /**
   * Get list of conflicted fields
   */
  private static getConflictedFields(conflict: CardConflict): string[] {
    const fields: string[] = [];
    const { clientData, serverData } = conflict;

    if (clientData.content !== undefined && clientData.content !== serverData.content) {
      fields.push('content');
    }

    if (clientData.title !== undefined && clientData.title !== serverData.title) {
      fields.push('title');
    }

    if (clientData.position && !this.positionsEqual(clientData.position, serverData.position)) {
      fields.push('position');
    }

    if (clientData.dimensions && !this.dimensionsEqual(clientData.dimensions, serverData.dimensions)) {
      fields.push('dimensions');
    }

    return fields;
  }

  /**
   * Compare positions for equality
   */
  private static positionsEqual(pos1: CardPosition, pos2: CardPosition): boolean {
    return pos1.x === pos2.x && pos1.y === pos2.y && pos1.z === pos2.z;
  }

  /**
   * Compare dimensions for equality
   */
  private static dimensionsEqual(dim1: CardDimensions, dim2: CardDimensions): boolean {
    return dim1.width === dim2.width && dim1.height === dim2.height;
  }
}

/**
 * Performance and optimization utilities
 */
export class CardOptimization {
  /**
   * Group cards by spatial proximity for batch operations
   */
  static groupCardsByProximity(
    cards: Card[],
    maxDistance: number = 500
  ): Card[][] {
    const groups: Card[][] = [];
    const processed = new Set<string>();

    cards.forEach(card => {
      if (processed.has(card.id)) return;

      const group = [card];
      processed.add(card.id);

      // Find nearby cards
      cards.forEach(otherCard => {
        if (processed.has(otherCard.id)) return;

        const distance = CardGeometry.calculateDistance(card.position, otherCard.position);
        if (distance <= maxDistance) {
          group.push(otherCard);
          processed.add(otherCard.id);
        }
      });

      groups.push(group);
    });

    return groups;
  }

  /**
   * Calculate memory usage for cards
   */
  static calculateMemoryUsage(cards: Card[]): {
    totalCards: number;
    totalSize: number;
    averageSize: number;
    sizeByType: Record<CardType, number>;
  } {
    const sizeByType: Record<CardType, number> = {
      [CardType.TEXT]: 0,
      [CardType.IMAGE]: 0,
      [CardType.LINK]: 0,
      [CardType.CODE]: 0,
      [CardType.FILE]: 0,
      [CardType.DRAWING]: 0,
    };

    let totalSize = 0;

    cards.forEach(card => {
      const cardSize = CardContent.calculateContentSize(card);
      totalSize += cardSize;
      sizeByType[card.type] += cardSize;
    });

    return {
      totalCards: cards.length,
      totalSize,
      averageSize: cards.length > 0 ? totalSize / cards.length : 0,
      sizeByType,
    };
  }
}