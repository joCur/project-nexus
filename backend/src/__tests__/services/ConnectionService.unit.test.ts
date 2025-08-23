/**
 * ConnectionService Unit Tests
 * Focused tests for ConnectionMapper and core functionality
 */

import { ConnectionMapper } from '@/services/ConnectionService';
import { 
  DEFAULT_CONNECTION_STYLE 
} from '@/types/ConnectionTypes';
import { ConnectionType } from '@/types/CardTypes';

describe('ConnectionMapper', () => {
  describe('mapDbConnectionToConnection', () => {
    it('should correctly map database connection to Connection interface', () => {
      const dbConnection = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        source_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        target_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        type: 'manual',
        confidence: 1.0,
        style: JSON.stringify(DEFAULT_CONNECTION_STYLE),
        label: JSON.stringify({ text: 'Test Label', position: 'middle', fontSize: 12 }),
        metadata: JSON.stringify({ testKey: 'testValue' }),
        created_by: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
        is_visible: true,
        ai_reasoning: 'Test reasoning',
        keywords: ['keyword1', 'keyword2'],
        concepts: ['concept1', 'concept2'],
        created_at: new Date('2024-01-01T10:00:00.000Z'),
        updated_at: new Date('2024-01-02T10:00:00.000Z')
      };

      const result = ConnectionMapper.mapDbConnectionToConnection(dbConnection as any);

      expect(result).toEqual({
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        sourceCardId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        targetCardId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        type: ConnectionType.MANUAL,
        confidence: 1.0,
        style: DEFAULT_CONNECTION_STYLE,
        label: { text: 'Test Label', position: 'middle', fontSize: 12 },
        metadata: { testKey: 'testValue' },
        createdBy: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
        isVisible: true,
        aiReasoning: 'Test reasoning',
        keywords: ['keyword1', 'keyword2'],
        concepts: ['concept1', 'concept2'],
        createdAt: new Date('2024-01-01T10:00:00.000Z'),
        updatedAt: new Date('2024-01-02T10:00:00.000Z')
      });
    });

    it('should handle null/undefined optional fields', () => {
      const dbConnection = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        source_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        target_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        type: 'manual',
        confidence: 1.0,
        style: JSON.stringify(DEFAULT_CONNECTION_STYLE),
        label: null,
        metadata: JSON.stringify({}),
        created_by: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
        is_visible: true,
        ai_reasoning: null,
        keywords: [],
        concepts: [],
        created_at: new Date('2024-01-01T10:00:00.000Z'),
        updated_at: new Date('2024-01-02T10:00:00.000Z')
      };

      const result = ConnectionMapper.mapDbConnectionToConnection(dbConnection as any);

      expect(result.label).toBeUndefined();
      expect(result.aiReasoning).toBeNull();
      expect(result.keywords).toEqual([]);
      expect(result.concepts).toEqual([]);
      expect(result.metadata).toEqual({});
    });

    it('should handle malformed JSON gracefully with fallback values', () => {
      const dbConnection = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        source_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        target_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        type: 'manual',
        confidence: 1.0,
        style: 'invalid json string',
        label: 'invalid json string',
        metadata: 'invalid json string',
        created_by: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
        is_visible: true,
        ai_reasoning: null,
        keywords: ['keyword1'],
        concepts: ['concept1'],
        created_at: new Date('2024-01-01T10:00:00.000Z'),
        updated_at: new Date('2024-01-02T10:00:00.000Z')
      };

      const result = ConnectionMapper.mapDbConnectionToConnection(dbConnection as any);

      expect(result.style).toEqual(DEFAULT_CONNECTION_STYLE);
      expect(result.label).toBeUndefined(); // Malformed JSON should return undefined
      expect(result.metadata).toEqual({}); // Fallback to empty object
      expect(result.keywords).toEqual(['keyword1']);
      expect(result.concepts).toEqual(['concept1']);
    });

    it('should handle all connection types correctly', () => {
      const connectionTypes = [
        'manual',
        'ai_suggested',
        'ai_generated',
        'reference',
        'dependency',
        'similarity',
        'related'
      ];

      connectionTypes.forEach(type => {
        const dbConnection = {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          source_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
          target_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
          type: type,
          confidence: 0.8,
          style: JSON.stringify(DEFAULT_CONNECTION_STYLE),
          label: null,
          metadata: JSON.stringify({}),
          created_by: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
          is_visible: true,
          ai_reasoning: null,
          keywords: [],
          concepts: [],
          created_at: new Date('2024-01-01T10:00:00.000Z'),
          updated_at: new Date('2024-01-02T10:00:00.000Z')
        };

        const result = ConnectionMapper.mapDbConnectionToConnection(dbConnection as any);
        
        // Should convert snake_case to enum value
        expect(Object.values(ConnectionType)).toContain(result.type);
        expect(result.confidence).toBe(0.8);
        expect(result.isVisible).toBe(true);
      });
    });
  });

  describe('mapConnectionToDbConnection', () => {
    it('should correctly map Connection to database format', () => {
      const connection = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        sourceCardId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        targetCardId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        type: ConnectionType.MANUAL,
        confidence: 1.0,
        style: DEFAULT_CONNECTION_STYLE,
        label: { text: 'Test Label', position: 'middle' as const, fontSize: 12 },
        metadata: { testKey: 'testValue' },
        createdBy: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
        isVisible: true,
        aiReasoning: 'Test reasoning',
        keywords: ['keyword1', 'keyword2'],
        concepts: ['concept1', 'concept2'],
        createdAt: new Date('2024-01-01T10:00:00.000Z'),
        updatedAt: new Date('2024-01-02T10:00:00.000Z')
      };

      const result = ConnectionMapper.mapConnectionToDbConnection(connection);

      expect(result).toEqual({
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        source_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        target_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        type: ConnectionType.MANUAL,
        confidence: 1.0,
        style: JSON.stringify(DEFAULT_CONNECTION_STYLE),
        label: JSON.stringify({ text: 'Test Label', position: 'middle', fontSize: 12 }),
        metadata: JSON.stringify({ testKey: 'testValue' }),
        created_by: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
        is_visible: true,
        ai_reasoning: 'Test reasoning',
        keywords: ['keyword1', 'keyword2'],
        concepts: ['concept1', 'concept2']
      });
    });

    it('should handle undefined label correctly', () => {
      const connection = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        sourceCardId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        targetCardId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        type: ConnectionType.AI_SUGGESTED,
        confidence: 0.7,
        style: DEFAULT_CONNECTION_STYLE,
        metadata: {},
        createdBy: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
        isVisible: false,
        keywords: [],
        concepts: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = ConnectionMapper.mapConnectionToDbConnection(connection);

      expect(result.label).toBeUndefined();
      expect(result.ai_reasoning).toBeUndefined();
      expect(result.is_visible).toBe(false);
      expect(result.confidence).toBe(0.7);
    });
  });

  describe('JSON parsing safety', () => {
    it('should handle various malformed JSON inputs', () => {
      const malformedInputs = [
        '{invalid json}',
        'not json at all',
        '{"incomplete": '
      ];

      malformedInputs.forEach(input => {
        const dbConnection = {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          source_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
          target_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
          type: 'manual',
          confidence: 1.0,
          style: input,
          label: input,
          metadata: input,
          created_by: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
          is_visible: true,
          ai_reasoning: null,
          keywords: [],
          concepts: [],
          created_at: new Date(),
          updated_at: new Date()
        };

        // Should not throw an error and use fallbacks
        expect(() => {
          const result = ConnectionMapper.mapDbConnectionToConnection(dbConnection as any);
          expect(result.style).toEqual(DEFAULT_CONNECTION_STYLE);
          expect(result.metadata).toEqual({});
          expect(result.label).toBeUndefined();
        }).not.toThrow();
      });
    });

    it('should handle null and undefined values correctly', () => {
      const dbConnection = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        source_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        target_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        type: 'manual',
        confidence: 1.0,
        style: undefined,
        label: null,
        metadata: undefined,
        created_by: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
        is_visible: true,
        ai_reasoning: null,
        keywords: [],
        concepts: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = ConnectionMapper.mapDbConnectionToConnection(dbConnection as any);
      
      expect(result.style).toEqual(DEFAULT_CONNECTION_STYLE);
      expect(result.metadata).toEqual({});
      expect(result.label).toBeUndefined();
    });

    it('should handle string "null" and "undefined" correctly', () => {
      const dbConnection = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        source_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        target_card_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        type: 'manual',
        confidence: 1.0,
        style: 'null',
        label: 'undefined',
        metadata: '""',
        created_by: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
        is_visible: true,
        ai_reasoning: null,
        keywords: [],
        concepts: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = ConnectionMapper.mapDbConnectionToConnection(dbConnection as any);
      
      expect(result.style).toBeNull();
      expect(result.metadata).toBe("");
      expect(result.label).toBeUndefined();
    });
  });
});