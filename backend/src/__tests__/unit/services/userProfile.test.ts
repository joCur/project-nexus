import { UserProfileService, UserProfile } from '@/services/userProfile';
import { database, knex as _knex } from '@/database/connection';

// Import mocked knex for type casting
const mockKnexDb = jest.requireMock('@/database/connection');
import { ValidationError, NotFoundError } from '@/utils/errors';
import { createMockKnex } from '../../utils/test-helpers';

// Mock database connection
jest.mock('@/database/connection', () => ({
  database: {
    query: jest.fn(),
  },
  knex: jest.fn(),
}));

// Mock logger
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('UserProfileService', () => {
  let userProfileService: UserProfileService;
  const mockDatabase = database as jest.Mocked<typeof database>;
  const typedMockKnex = _knex as jest.MockedFunction<typeof _knex>;

  // Test data
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const testProfileId = 'profile-id-123';
  
  const mockDbProfile = {
    id: testProfileId,
    user_id: testUserId,
    full_name: 'John Doe',
    display_name: 'Johnny',
    timezone: 'UTC',
    role: 'student',
    preferences: {
      workspaceName: 'My Workspace',
      privacy: 'private',
      notifications: true,
    },
    created_at: new Date('2023-01-01'),
    updated_at: new Date('2023-01-01'),
  };

  const expectedProfile: UserProfile = {
    id: testProfileId,
    userId: testUserId,
    fullName: 'John Doe',
    displayName: 'Johnny',
    timezone: 'UTC',
    role: 'STUDENT', // Service converts to uppercase for enum consistency
    preferences: {
      workspaceName: 'My Workspace',
      privacy: 'PRIVATE',
      notifications: true,
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  beforeEach(() => {
    // Setup knex mock - createMockKnex() returns a jest function that returns a query builder
    const mockKnex = createMockKnex();
    
    // Mock the knex function to return a query builder when called with table name
    typedMockKnex.mockImplementation(mockKnex);
    
    userProfileService = new UserProfileService();
    jest.clearAllMocks();
  });

  describe('getProfileByUserId', () => {
    it('should return user profile when found', async () => {
      mockDatabase.query.mockResolvedValue(mockDbProfile);

      const result = await userProfileService.getProfileByUserId(testUserId);

      expect(result).toEqual(expectedProfile);
      expect(typedMockKnex).toHaveBeenCalledWith('user_profiles');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.anything(),
        'user_profile_get_by_user_id'
      );
    });

    it('should return null when profile not found', async () => {
      mockDatabase.query.mockResolvedValue(null);

      const result = await userProfileService.getProfileByUserId(testUserId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockDatabase.query.mockRejectedValue(dbError);

      await expect(userProfileService.getProfileByUserId(testUserId))
        .rejects.toThrow('Database error');
    });
  });

  describe('getProfileById', () => {
    it('should return user profile when found by profile ID', async () => {
      mockDatabase.query.mockResolvedValue(mockDbProfile);

      const result = await userProfileService.getProfileById(testProfileId);

      expect(result).toEqual(expectedProfile);
      expect(typedMockKnex).toHaveBeenCalledWith('user_profiles');
    });

    it('should return null when profile not found by ID', async () => {
      mockDatabase.query.mockResolvedValue(null);

      const result = await userProfileService.getProfileById(testProfileId);

      expect(result).toBeNull();
    });
  });

  describe('createProfile', () => {
    const validCreateInput = {
      userId: testUserId,
      fullName: 'John Doe',
      displayName: 'Johnny',
      timezone: 'UTC',
      role: 'student' as const,
      preferences: {
        workspaceName: 'My Workspace',
        privacy: 'private',
      },
    };

    it('should create a new user profile', async () => {
      // Mock getProfileByUserId to return null (no existing profile)
      jest.spyOn(userProfileService, 'getProfileByUserId').mockResolvedValue(null);

      mockDatabase.query.mockResolvedValue([mockDbProfile]);

      const result = await userProfileService.createProfile(validCreateInput);

      expect(result).toEqual(expectedProfile);
      expect(typedMockKnex).toHaveBeenCalledWith('user_profiles');
    });

    it('should throw ValidationError when profile already exists', async () => {
      // Mock getProfileByUserId to return existing profile
      jest.spyOn(userProfileService, 'getProfileByUserId').mockResolvedValue(expectedProfile);

      await expect(userProfileService.createProfile(validCreateInput))
        .rejects.toThrow(ValidationError);
      await expect(userProfileService.createProfile(validCreateInput))
        .rejects.toThrow('User profile already exists');
    });

    it('should validate input parameters', async () => {
      const invalidInput = {
        userId: 'invalid-uuid',
        fullName: '', // Empty name
        role: 'invalid-role' as any,
      };

      await expect(userProfileService.createProfile(invalidInput))
        .rejects.toThrow(ValidationError);
    });

    it('should handle optional fields', async () => {
      const minimalInput = {
        userId: testUserId,
        fullName: 'John Doe',
      };

      jest.spyOn(userProfileService, 'getProfileByUserId').mockResolvedValue(null);

      const mockKnexQuery = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      const minimalDbProfile = {
        ...mockDbProfile,
        display_name: undefined,
        timezone: undefined,
        role: undefined,
        preferences: {},
      };
      mockDatabase.query.mockResolvedValue([minimalDbProfile]);

      const result = await userProfileService.createProfile(minimalInput);

      expect(result.fullName).toBe('John Doe');
      expect(result.displayName).toBeUndefined();
      expect(mockKnexQuery.insert).toHaveBeenCalledWith({
        user_id: testUserId,
        full_name: 'John Doe',
        display_name: undefined,
        timezone: undefined,
        role: undefined,
        preferences: {},
      });
    });
  });

  describe('updateProfile', () => {
    const validUpdateInput = {
      fullName: 'John Updated',
      displayName: 'Johnny Updated',
      preferences: {
        notifications: false,
      },
    };

    it('should update existing user profile', async () => {
      // Mock getProfileByUserId to return existing profile
      jest.spyOn(userProfileService, 'getProfileByUserId').mockResolvedValue(expectedProfile);

      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      const updatedDbProfile = {
        ...mockDbProfile,
        full_name: 'John Updated',
        display_name: 'Johnny Updated',
        preferences: {
          ...mockDbProfile.preferences,
          notifications: false,
        },
      };
      mockDatabase.query.mockResolvedValue([updatedDbProfile]);

      const result = await userProfileService.updateProfile(testUserId, validUpdateInput);

      expect(result.fullName).toBe('John Updated');
      expect(result.displayName).toBe('Johnny Updated');
      expect(result.preferences.notifications).toBe(false);
      
      // Verify that preferences are merged, not replaced
      expect(result.preferences.workspaceName).toBe('My Workspace');
    });

    it('should throw NotFoundError when profile does not exist', async () => {
      // Mock getProfileByUserId to return null
      jest.spyOn(userProfileService, 'getProfileByUserId').mockResolvedValue(null);

      await expect(userProfileService.updateProfile(testUserId, validUpdateInput))
        .rejects.toThrow(NotFoundError);
    });

    it('should merge preferences correctly', async () => {
      const existingProfile = {
        ...expectedProfile,
        preferences: {
          workspaceName: 'Existing Workspace',
          privacy: 'PRIVATE',
          notifications: true,
          theme: 'dark',
        },
      };
      jest.spyOn(userProfileService, 'getProfileByUserId').mockResolvedValue(existingProfile);

      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      const updateInput = {
        preferences: {
          notifications: false,
          newSetting: 'value',
        },
      };

      const updatedDbProfile = {
        ...mockDbProfile,
        preferences: {
          workspaceName: 'Existing Workspace',
          privacy: 'PRIVATE',
          notifications: false,
          theme: 'dark',
          newSetting: 'value',
        },
      };
      mockDatabase.query.mockResolvedValue([updatedDbProfile]);

      await userProfileService.updateProfile(testUserId, updateInput);

      expect(mockKnexQuery.update).toHaveBeenCalledWith({
        updated_at: expect.any(Date),
        preferences: {
          workspaceName: 'Existing Workspace',
          privacy: 'PRIVATE',
          notifications: false,
          theme: 'dark',
          newSetting: 'value',
        },
      });
    });

    it('should validate update input parameters', async () => {
      const invalidInput = {
        fullName: '', // Empty name
        role: 'invalid-role' as any,
      };

      await expect(userProfileService.updateProfile(testUserId, invalidInput))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('upsertProfile', () => {
    const validUpsertInput = {
      userId: testUserId,
      fullName: 'John Doe',
      displayName: 'Johnny',
      timezone: 'UTC',
      role: 'student' as const,
    };

    it('should create profile when none exists', async () => {
      jest.spyOn(userProfileService, 'getProfileByUserId').mockResolvedValue(null);
      jest.spyOn(userProfileService, 'createProfile').mockResolvedValue(expectedProfile);

      const result = await userProfileService.upsertProfile(validUpsertInput);

      expect(result).toEqual(expectedProfile);
      expect(userProfileService.createProfile).toHaveBeenCalledWith(validUpsertInput);
    });

    it('should update profile when one exists', async () => {
      jest.spyOn(userProfileService, 'getProfileByUserId').mockResolvedValue(expectedProfile);
      
      const updatedProfile = { ...expectedProfile, fullName: 'John Updated' };
      jest.spyOn(userProfileService, 'updateProfile').mockResolvedValue(updatedProfile);

      const result = await userProfileService.upsertProfile(validUpsertInput);

      expect(result).toEqual(updatedProfile);
      expect(userProfileService.updateProfile).toHaveBeenCalledWith(testUserId, {
        fullName: validUpsertInput.fullName,
        displayName: validUpsertInput.displayName,
        timezone: validUpsertInput.timezone,
        role: validUpsertInput.role,
        preferences: undefined,
      });
    });
  });

  describe('deleteProfile', () => {
    it('should delete existing user profile', async () => {
      jest.spyOn(userProfileService, 'getProfileByUserId').mockResolvedValue(expectedProfile);

      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(undefined);

      await userProfileService.deleteProfile(testUserId);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        mockKnexQuery,
        'user_profile_delete'
      );
    });

    it('should throw NotFoundError when profile does not exist', async () => {
      jest.spyOn(userProfileService, 'getProfileByUserId').mockResolvedValue(null);

      await expect(userProfileService.deleteProfile(testUserId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('searchProfiles', () => {
    it('should search profiles by name', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        orWhereILike: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      const searchResults = [mockDbProfile];
      mockDatabase.query.mockResolvedValue(searchResults);

      const result = await userProfileService.searchProfiles('John', 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expectedProfile);
      expect(mockKnexQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should use default limit when not specified', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        orWhereILike: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue([]);

      await userProfileService.searchProfiles('John');

      expect(mockKnexQuery.limit).toHaveBeenCalledWith(20);
    });
  });

  describe('mapDbProfileToProfile (enum handling)', () => {
    it('should correctly map database profile with enum case conversion', async () => {
      const dbProfileWithLowercase = {
        ...mockDbProfile,
        role: 'creative',
        preferences: {
          ...mockDbProfile.preferences,
          privacy: 'team',
        },
      };

      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(dbProfileWithLowercase);

      const result = await userProfileService.getProfileByUserId(testUserId);

      expect(result?.role).toBe('CREATIVE');
      expect(result?.preferences.privacy).toBe('TEAM');
    });

    it('should handle null/undefined enum values', async () => {
      const dbProfileWithNulls = {
        ...mockDbProfile,
        role: null,
        preferences: null,
      };

      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(dbProfileWithNulls);

      const result = await userProfileService.getProfileByUserId(testUserId);

      expect(result?.role).toBeUndefined();
      expect(result?.preferences).toEqual({});
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed database responses', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      const malformedProfile = {
        id: testProfileId,
        user_id: testUserId,
        // Missing other required fields
      };
      mockDatabase.query.mockResolvedValue(malformedProfile);

      const result = await userProfileService.getProfileByUserId(testUserId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testProfileId);
      expect(result?.preferences).toEqual({});
    });

    it('should handle concurrent access scenarios', async () => {
      // Simulate profile being created between checks
      let getProfileCallCount = 0;
      jest.spyOn(userProfileService, 'getProfileByUserId').mockImplementation(async () => {
        getProfileCallCount++;
        return getProfileCallCount === 1 ? null : expectedProfile;
      });

      // Mock database.query to throw a constraint error (simulating concurrent creation)
      const constraintError = new Error('duplicate key value violates unique constraint');
      (constraintError as any).code = '23505'; // PostgreSQL unique violation error code
      mockDatabase.query.mockRejectedValue(constraintError);

      const createInput = {
        userId: testUserId,
        fullName: 'Test User',
      };

      // The second call should throw since profile now exists
      await expect(userProfileService.createProfile(createInput))
        .rejects.toThrow(ValidationError);
    });
  });
});