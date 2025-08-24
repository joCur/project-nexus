/**
 * Canvas GraphQL Operations Tests
 * 
 * Test suite for GraphQL queries, mutations, and subscriptions
 * to ensure proper operation structure and type safety.
 */

import { describe, it, expect } from '@jest/globals';
import { gql } from '@apollo/client';
import {
  GET_WORKSPACE_CANVASES,
  GET_CANVAS,
  GET_DEFAULT_CANVAS,
  SEARCH_CANVASES,
  CREATE_CANVAS,
  UPDATE_CANVAS,
  DELETE_CANVAS,
  SET_DEFAULT_CANVAS,
  DUPLICATE_CANVAS,
  UPDATE_CANVAS_SETTINGS,
  CANVAS_CREATED_SUBSCRIPTION,
  CANVAS_UPDATED_SUBSCRIPTION,
  CANVAS_DELETED_SUBSCRIPTION,
  CANVAS_SETTINGS_CHANGED_SUBSCRIPTION,
  DEFAULT_CANVAS_CHANGED_SUBSCRIPTION,
  CANVAS_CORE_FIELDS,
  CANVAS_WITH_RELATIONS,
  type WorkspaceCanvasesQueryVariables,
  type CanvasQueryVariables,
  type CreateCanvasMutationVariables,
  type UpdateCanvasMutationVariables,
  type DeleteCanvasMutationVariables,
  type SetDefaultCanvasMutationVariables,
  type DuplicateCanvasMutationVariables,
  type UpdateCanvasSettingsMutationVariables,
  type CanvasResponse,
  type CanvasesConnectionResponse,
} from '@/lib/graphql/canvasOperations';

describe('Canvas GraphQL Operations', () => {
  describe('Fragments', () => {
    it('should define core canvas fields fragment', () => {
      expect(CANVAS_CORE_FIELDS).toBeDefined();
      expect(CANVAS_CORE_FIELDS.kind).toBe('Document');
      
      const fragmentDef = CANVAS_CORE_FIELDS.definitions[0];
      expect(fragmentDef.kind).toBe('FragmentDefinition');
      expect((fragmentDef as any).name.value).toBe('CanvasCoreFields');
    });

    it('should define canvas with relations fragment', () => {
      expect(CANVAS_WITH_RELATIONS).toBeDefined();
      expect(CANVAS_WITH_RELATIONS.kind).toBe('Document');
      
      const fragmentDefs = CANVAS_WITH_RELATIONS.definitions.filter(
        def => def.kind === 'FragmentDefinition'
      );
      const canvasWithRelationsFragment = fragmentDefs.find(
        def => (def as any).name.value === 'CanvasWithRelations'
      );
      expect(canvasWithRelationsFragment).toBeDefined();
      expect((canvasWithRelationsFragment as any).name.value).toBe('CanvasWithRelations');
    });
  });

  describe('Queries', () => {
    it('should define GET_WORKSPACE_CANVASES query', () => {
      expect(GET_WORKSPACE_CANVASES).toBeDefined();
      expect(GET_WORKSPACE_CANVASES.kind).toBe('Document');
      
      const queryDef = GET_WORKSPACE_CANVASES.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((queryDef as any).operation).toBe('query');
      expect((queryDef as any).name.value).toBe('GetWorkspaceCanvases');
    });

    it('should define GET_CANVAS query', () => {
      expect(GET_CANVAS).toBeDefined();
      
      const queryDef = GET_CANVAS.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((queryDef as any).name.value).toBe('GetCanvas');
    });

    it('should define GET_DEFAULT_CANVAS query', () => {
      expect(GET_DEFAULT_CANVAS).toBeDefined();
      
      const queryDef = GET_DEFAULT_CANVAS.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((queryDef as any).name.value).toBe('GetDefaultCanvas');
    });

    it('should define SEARCH_CANVASES query', () => {
      expect(SEARCH_CANVASES).toBeDefined();
      
      const queryDef = SEARCH_CANVASES.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((queryDef as any).name.value).toBe('SearchCanvases');
    });
  });

  describe('Mutations', () => {
    it('should define CREATE_CANVAS mutation', () => {
      expect(CREATE_CANVAS).toBeDefined();
      
      const mutationDef = CREATE_CANVAS.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((mutationDef as any).operation).toBe('mutation');
      expect((mutationDef as any).name.value).toBe('CreateCanvas');
    });

    it('should define UPDATE_CANVAS mutation', () => {
      expect(UPDATE_CANVAS).toBeDefined();
      
      const mutationDef = UPDATE_CANVAS.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((mutationDef as any).name.value).toBe('UpdateCanvas');
    });

    it('should define DELETE_CANVAS mutation', () => {
      expect(DELETE_CANVAS).toBeDefined();
      
      const mutationDef = DELETE_CANVAS.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((mutationDef as any).name.value).toBe('DeleteCanvas');
    });

    it('should define SET_DEFAULT_CANVAS mutation', () => {
      expect(SET_DEFAULT_CANVAS).toBeDefined();
      
      const mutationDef = SET_DEFAULT_CANVAS.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((mutationDef as any).name.value).toBe('SetDefaultCanvas');
    });

    it('should define DUPLICATE_CANVAS mutation', () => {
      expect(DUPLICATE_CANVAS).toBeDefined();
      
      const mutationDef = DUPLICATE_CANVAS.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((mutationDef as any).name.value).toBe('DuplicateCanvas');
    });

    it('should define UPDATE_CANVAS_SETTINGS mutation', () => {
      expect(UPDATE_CANVAS_SETTINGS).toBeDefined();
      
      const mutationDef = UPDATE_CANVAS_SETTINGS.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((mutationDef as any).name.value).toBe('UpdateCanvasSettings');
    });
  });

  describe('Subscriptions', () => {
    it('should define CANVAS_CREATED_SUBSCRIPTION', () => {
      expect(CANVAS_CREATED_SUBSCRIPTION).toBeDefined();
      
      const subscriptionDef = CANVAS_CREATED_SUBSCRIPTION.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((subscriptionDef as any).operation).toBe('subscription');
      expect((subscriptionDef as any).name.value).toBe('CanvasCreated');
    });

    it('should define CANVAS_UPDATED_SUBSCRIPTION', () => {
      expect(CANVAS_UPDATED_SUBSCRIPTION).toBeDefined();
      
      const subscriptionDef = CANVAS_UPDATED_SUBSCRIPTION.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((subscriptionDef as any).name.value).toBe('CanvasUpdated');
    });

    it('should define CANVAS_DELETED_SUBSCRIPTION', () => {
      expect(CANVAS_DELETED_SUBSCRIPTION).toBeDefined();
      
      const subscriptionDef = CANVAS_DELETED_SUBSCRIPTION.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((subscriptionDef as any).name.value).toBe('CanvasDeleted');
    });

    it('should define CANVAS_SETTINGS_CHANGED_SUBSCRIPTION', () => {
      expect(CANVAS_SETTINGS_CHANGED_SUBSCRIPTION).toBeDefined();
      
      const subscriptionDef = CANVAS_SETTINGS_CHANGED_SUBSCRIPTION.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((subscriptionDef as any).name.value).toBe('CanvasSettingsChanged');
    });

    it('should define DEFAULT_CANVAS_CHANGED_SUBSCRIPTION', () => {
      expect(DEFAULT_CANVAS_CHANGED_SUBSCRIPTION).toBeDefined();
      
      const subscriptionDef = DEFAULT_CANVAS_CHANGED_SUBSCRIPTION.definitions.find(
        def => def.kind === 'OperationDefinition'
      );
      expect((subscriptionDef as any).name.value).toBe('DefaultCanvasChanged');
    });
  });

  describe('Type Definitions', () => {
    it('should validate WorkspaceCanvasesQueryVariables interface', () => {
      const validVariables: WorkspaceCanvasesQueryVariables = {
        workspaceId: 'workspace-1',
        filter: {
          isDefault: true,
          searchQuery: 'test',
          createdDateRange: {
            start: '2024-01-01T00:00:00Z',
            end: '2024-01-31T23:59:59Z',
          },
        },
        pagination: {
          page: 1,
          limit: 50,
          sortBy: 'name',
          sortOrder: 'ASC',
        },
      };

      expect(validVariables.workspaceId).toBe('workspace-1');
      expect(validVariables.filter?.isDefault).toBe(true);
      expect(validVariables.pagination?.page).toBe(1);
    });

    it('should validate CanvasQueryVariables interface', () => {
      const validVariables: CanvasQueryVariables = {
        id: 'canvas-1',
      };

      expect(validVariables.id).toBe('canvas-1');
    });

    it('should validate CreateCanvasMutationVariables interface', () => {
      const validVariables: CreateCanvasMutationVariables = {
        input: {
          workspaceId: 'workspace-1',
          name: 'Test Canvas',
          description: 'Test Description',
          settings: {
            isDefault: false,
            position: { x: 0, y: 0, z: 0 },
            zoom: 1.0,
            grid: {
              enabled: true,
              size: 20,
              color: '#e5e7eb',
              opacity: 0.3,
            },
            background: {
              type: 'COLOR',
              color: '#ffffff',
              opacity: 1.0,
            },
          },
          metadata: { custom: 'value' },
        },
      };

      expect(validVariables.input.name).toBe('Test Canvas');
      expect(validVariables.input.settings?.zoom).toBe(1.0);
    });

    it('should validate UpdateCanvasMutationVariables interface', () => {
      const validVariables: UpdateCanvasMutationVariables = {
        id: 'canvas-1',
        input: {
          name: 'Updated Canvas',
          description: 'Updated Description',
          settings: {
            zoom: 1.5,
          },
        },
      };

      expect(validVariables.id).toBe('canvas-1');
      expect(validVariables.input.name).toBe('Updated Canvas');
    });

    it('should validate DeleteCanvasMutationVariables interface', () => {
      const validVariables: DeleteCanvasMutationVariables = {
        id: 'canvas-1',
      };

      expect(validVariables.id).toBe('canvas-1');
    });

    it('should validate SetDefaultCanvasMutationVariables interface', () => {
      const validVariables: SetDefaultCanvasMutationVariables = {
        workspaceId: 'workspace-1',
        canvasId: 'canvas-1',
      };

      expect(validVariables.workspaceId).toBe('workspace-1');
      expect(validVariables.canvasId).toBe('canvas-1');
    });

    it('should validate DuplicateCanvasMutationVariables interface', () => {
      const validVariables: DuplicateCanvasMutationVariables = {
        id: 'canvas-1',
        input: {
          name: 'Duplicated Canvas',
          description: 'Duplicated Description',
          includeCards: true,
          includeConnections: false,
        },
      };

      expect(validVariables.id).toBe('canvas-1');
      expect(validVariables.input.name).toBe('Duplicated Canvas');
      expect(validVariables.input.includeCards).toBe(true);
    });

    it('should validate UpdateCanvasSettingsMutationVariables interface', () => {
      const validVariables: UpdateCanvasSettingsMutationVariables = {
        id: 'canvas-1',
        settings: {
          position: { x: 100, y: 200, z: 0 },
          zoom: 1.5,
          grid: {
            enabled: false,
            size: 25,
            color: '#f0f0f0',
            opacity: 0.5,
          },
        },
      };

      expect(validVariables.id).toBe('canvas-1');
      expect(validVariables.settings.zoom).toBe(1.5);
      expect(validVariables.settings.grid?.enabled).toBe(false);
    });
  });

  describe('Response Types', () => {
    it('should validate CanvasResponse interface', () => {
      const validResponse: CanvasResponse = {
        id: 'canvas-1',
        workspaceId: 'workspace-1',
        name: 'Test Canvas',
        description: 'Test Description',
        settings: {
          isDefault: false,
          position: { x: 0, y: 0, z: 0 },
          zoom: 1.0,
          grid: {
            enabled: true,
            size: 20,
            color: '#e5e7eb',
            opacity: 0.3,
          },
          background: {
            type: 'COLOR',
            color: '#ffffff',
            opacity: 1.0,
          },
        },
        metadata: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        version: 1,
        workspace: {
          id: 'workspace-1',
          name: 'Test Workspace',
          ownerId: 'user-1',
        },
        owner: {
          id: 'user-1',
          email: 'test@example.com',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      };

      expect(validResponse.id).toBe('canvas-1');
      expect(validResponse.settings.zoom).toBe(1.0);
      expect(validResponse.workspace?.name).toBe('Test Workspace');
      expect(validResponse.owner?.email).toBe('test@example.com');
    });

    it('should validate CanvasesConnectionResponse interface', () => {
      const validResponse: CanvasesConnectionResponse = {
        items: [
          {
            id: 'canvas-1',
            workspaceId: 'workspace-1',
            name: 'Canvas 1',
            settings: {
              isDefault: true,
              position: { x: 0, y: 0, z: 0 },
              zoom: 1.0,
              grid: {
                enabled: true,
                size: 20,
                color: '#e5e7eb',
                opacity: 0.3,
              },
              background: {
                type: 'COLOR',
                color: '#ffffff',
                opacity: 1.0,
              },
            },
            metadata: {},
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            version: 1,
          },
        ],
        totalCount: 1,
        page: 0,
        limit: 50,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      };

      expect(validResponse.items).toHaveLength(1);
      expect(validResponse.items[0].name).toBe('Canvas 1');
      expect(validResponse.totalCount).toBe(1);
      expect(validResponse.hasNextPage).toBe(false);
    });
  });

  describe('GraphQL Structure Validation', () => {
    it('should have valid GraphQL operation structures', () => {
      // Test that all operations are valid GraphQL documents
      const operations = [
        GET_WORKSPACE_CANVASES,
        GET_CANVAS,
        GET_DEFAULT_CANVAS,
        SEARCH_CANVASES,
        CREATE_CANVAS,
        UPDATE_CANVAS,
        DELETE_CANVAS,
        SET_DEFAULT_CANVAS,
        DUPLICATE_CANVAS,
        UPDATE_CANVAS_SETTINGS,
        CANVAS_CREATED_SUBSCRIPTION,
        CANVAS_UPDATED_SUBSCRIPTION,
        CANVAS_DELETED_SUBSCRIPTION,
        CANVAS_SETTINGS_CHANGED_SUBSCRIPTION,
        DEFAULT_CANVAS_CHANGED_SUBSCRIPTION,
      ];

      operations.forEach(operation => {
        expect(operation.kind).toBe('Document');
        expect(operation.definitions.length).toBeGreaterThan(0);
      });
    });

    it('should include fragments in operations that use them', () => {
      // Check that operations using fragments include the fragment definitions
      const operationsWithFragments = [
        GET_WORKSPACE_CANVASES,
        GET_CANVAS,
        GET_DEFAULT_CANVAS,
        SEARCH_CANVASES,
        CREATE_CANVAS,
        UPDATE_CANVAS,
        SET_DEFAULT_CANVAS,
        DUPLICATE_CANVAS,
        UPDATE_CANVAS_SETTINGS,
        CANVAS_CREATED_SUBSCRIPTION,
        CANVAS_UPDATED_SUBSCRIPTION,
        CANVAS_SETTINGS_CHANGED_SUBSCRIPTION,
      ];

      operationsWithFragments.forEach(operation => {
        const hasFragmentDefinition = operation.definitions.some(
          def => def.kind === 'FragmentDefinition'
        );
        expect(hasFragmentDefinition).toBe(true);
      });
    });

    it('should have proper variable definitions in operations', () => {
      // Test that operations have proper variable definitions
      const queryDef = GET_WORKSPACE_CANVASES.definitions.find(
        def => def.kind === 'OperationDefinition'
      ) as any;

      expect(queryDef.variableDefinitions).toBeDefined();
      expect(queryDef.variableDefinitions.length).toBeGreaterThan(0);
      
      const workspaceIdVar = queryDef.variableDefinitions.find(
        (varDef: any) => varDef.variable.name.value === 'workspaceId'
      );
      expect(workspaceIdVar).toBeDefined();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing required fields gracefully', () => {
      // Test that TypeScript types enforce required fields
      
      // This should cause TypeScript errors if uncommented:
      // const invalidVariables: CreateCanvasMutationVariables = {
      //   input: {
      //     // Missing required workspaceId and name
      //   },
      // };

      // Valid minimal variables
      const validVariables: CreateCanvasMutationVariables = {
        input: {
          workspaceId: 'workspace-1',
          name: 'Test Canvas',
          metadata: {},
        },
      };

      expect(validVariables.input.workspaceId).toBeDefined();
      expect(validVariables.input.name).toBeDefined();
    });

    it('should handle optional fields correctly', () => {
      const minimalVariables: UpdateCanvasMutationVariables = {
        id: 'canvas-1',
        input: {}, // All fields optional
      };

      expect(minimalVariables.id).toBeDefined();
      expect(minimalVariables.input).toBeDefined();
    });
  });
});