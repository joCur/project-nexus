import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';

import 'package:nexus_mobile/features/auth/domain/providers/auth_providers.dart';
import 'package:nexus_mobile/shared/services/auth_service.dart';
import 'package:nexus_mobile/shared/models/user_profile.dart';
import 'package:nexus_mobile/core/errors/failures.dart';
import 'package:nexus_mobile/core/utils/result.dart';

// Mock classes
class MockAuthService extends Mock implements AuthService {}
class MockUserProfile extends Mock implements UserProfile {}

void main() {
  group('AuthNotifier', () {
    late MockAuthService mockAuthService;
    late ProviderContainer container;

    setUp(() {
      mockAuthService = MockAuthService();
      
      // Register fallback values for Mocktail
      registerFallbackValue(const UserProfile(sub: 'fallback'));
      
      container = ProviderContainer(
        overrides: [
          authServiceProvider.overrideWithValue(mockAuthService),
        ],
      );
    });

    tearDown(() {
      container.dispose();
    });

    group('build', () {
      test('should return initial AuthState', () {
        // Act
        final authState = container.read(authNotifierProvider);

        // Assert
        expect(authState.isAuthenticated, isFalse);
        expect(authState.user, isNull);
        expect(authState.isLoading, isFalse);
        expect(authState.error, isNull);
      });

      test('should check auth status after build completes', () async {
        // Arrange
        when(() => mockAuthService.isAuthenticated())
            .thenAnswer((_) async => false);

        // Act
        container.read(authNotifierProvider);
        
        // Wait for microtask to complete
        await Future.delayed(Duration.zero);

        // Assert
        verify(() => mockAuthService.isAuthenticated()).called(1);
      });
    });

    group('login', () {
      test('should update state to loading during login', () async {
        // Arrange
        final mockUserProfile = MockUserProfile();
        when(() => mockUserProfile.sub).thenReturn('test-user-id');
        when(() => mockUserProfile.email).thenReturn('test@example.com');
        when(() => mockUserProfile.name).thenReturn('Test User');
        when(() => mockUserProfile.picture).thenReturn('https://example.com/avatar.jpg');
        
        when(() => mockAuthService.login())
            .thenAnswer((_) async => Success(mockUserProfile));

        // Act
        final notifier = container.read(authNotifierProvider.notifier);
        final loginFuture = notifier.login();

        // Assert initial loading state
        final loadingState = container.read(authNotifierProvider);
        expect(loadingState.isLoading, isTrue);
        expect(loadingState.error, isNull);

        // Wait for completion
        await loginFuture;

        final finalState = container.read(authNotifierProvider);
        expect(finalState.isLoading, isFalse);
        expect(finalState.isAuthenticated, isTrue);
        expect(finalState.user?.email, equals('test@example.com'));
      });

      test('should handle login cancellation gracefully', () async {
        // Arrange
        when(() => mockAuthService.login())
            .thenAnswer((_) async => Error(AuthFailure.loginCancelled()));

        // Act
        final notifier = container.read(authNotifierProvider.notifier);
        await notifier.login();

        // Assert
        final finalState = container.read(authNotifierProvider);
        expect(finalState.isLoading, isFalse);
        expect(finalState.isAuthenticated, isFalse);
        expect(finalState.user, isNull);
        expect(finalState.error, isNull); // No error shown for cancellation
      });

      test('should show error on login failure', () async {
        // Arrange
        const errorMessage = 'Login failed';
        when(() => mockAuthService.login())
            .thenAnswer((_) async => Error(AuthFailure.loginFailed(errorMessage)));

        // Act
        final notifier = container.read(authNotifierProvider.notifier);
        await notifier.login();

        // Assert
        final finalState = container.read(authNotifierProvider);
        expect(finalState.isLoading, isFalse);
        expect(finalState.isAuthenticated, isFalse);
        expect(finalState.user, isNull);
        expect(finalState.error, equals(errorMessage));
      });
    });

    group('logout', () {
      test('should clear user state on successful logout', () async {
        // Arrange - start with authenticated state
        final mockUserProfile = MockUserProfile();
        when(() => mockUserProfile.sub).thenReturn('test-user-id');
        when(() => mockUserProfile.email).thenReturn('test@example.com');
        when(() => mockUserProfile.name).thenReturn('Test User');
        
        when(() => mockAuthService.login())
            .thenAnswer((_) async => Success(mockUserProfile));
        when(() => mockAuthService.logout())
            .thenAnswer((_) async => const Success(null));

        // Login first
        final notifier = container.read(authNotifierProvider.notifier);
        await notifier.login();

        // Verify logged in
        expect(container.read(authNotifierProvider).isAuthenticated, isTrue);

        // Act - logout
        await notifier.logout();

        // Assert
        final finalState = container.read(authNotifierProvider);
        expect(finalState.isLoading, isFalse);
        expect(finalState.isAuthenticated, isFalse);
        expect(finalState.user, isNull);
        expect(finalState.error, isNull);
      });

      test('should show error on logout failure', () async {
        // Arrange
        const errorMessage = 'Logout failed';
        when(() => mockAuthService.logout())
            .thenAnswer((_) async => Error(AuthFailure.logoutFailed(errorMessage)));

        // Act
        final notifier = container.read(authNotifierProvider.notifier);
        await notifier.logout();

        // Assert
        final finalState = container.read(authNotifierProvider);
        expect(finalState.isLoading, isFalse);
        expect(finalState.error, equals(errorMessage));
      });
    });

    group('refresh', () {
      test('should update authentication state on refresh', () async {
        // Arrange
        when(() => mockAuthService.isAuthenticated())
            .thenAnswer((_) async => true);
            
        final mockUserProfile = MockUserProfile();
        when(() => mockUserProfile.sub).thenReturn('test-user-id');
        when(() => mockUserProfile.email).thenReturn('test@example.com');
        when(() => mockUserProfile.name).thenReturn('Test User');
        
        when(() => mockAuthService.getUserProfile())
            .thenAnswer((_) async => mockUserProfile);

        // Act
        final notifier = container.read(authNotifierProvider.notifier);
        await notifier.refresh();

        // Assert
        final finalState = container.read(authNotifierProvider);
        expect(finalState.isLoading, isFalse);
        expect(finalState.isAuthenticated, isTrue);
        expect(finalState.user?.email, equals('test@example.com'));
      });

      test('should handle refresh when not authenticated', () async {
        // Arrange
        when(() => mockAuthService.isAuthenticated())
            .thenAnswer((_) async => false);

        // Act
        final notifier = container.read(authNotifierProvider.notifier);
        await notifier.refresh();

        // Assert
        final finalState = container.read(authNotifierProvider);
        expect(finalState.isLoading, isFalse);
        expect(finalState.isAuthenticated, isFalse);
        expect(finalState.user, isNull);
      });
    });
  });

  group('User model', () {
    test('should create User from Auth0 UserProfile', () {
      // Arrange
      final userProfile = UserProfile(
        sub: 'auth0|12345',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      );

      // Act
      final user = User.fromAuth0Profile(userProfile);

      // Assert
      expect(user.id, equals('auth0|12345'));
      expect(user.email, equals('test@example.com'));
      expect(user.name, equals('Test User'));
      expect(user.avatarUrl, equals('https://example.com/avatar.jpg'));
    });

    test('should handle null values in Auth0 UserProfile', () {
      // Arrange
      final userProfile = UserProfile(
        sub: 'auth0|12345',
        email: 'test@example.com',
        name: null,
        picture: null,
      );

      // Act
      final user = User.fromAuth0Profile(userProfile);

      // Assert
      expect(user.id, equals('auth0|12345'));
      expect(user.email, equals('test@example.com'));
      expect(user.name, isNull);
      expect(user.avatarUrl, isNull);
    });
  });
}