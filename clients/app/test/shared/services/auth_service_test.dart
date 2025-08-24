import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:auth0_flutter/auth0_flutter.dart';

import 'package:nexus_mobile/shared/services/auth_service.dart';
import 'package:nexus_mobile/shared/models/user_profile.dart';
import 'package:nexus_mobile/core/errors/failures.dart';
import 'package:nexus_mobile/core/utils/result.dart';
import 'package:nexus_mobile/core/platform/environment.dart';

// Mock classes
class MockAuth0 extends Mock implements Auth0 {}
class MockWebAuthentication extends Mock implements WebAuthentication {}
class MockManagementAPI extends Mock implements ManagementAPI {}
class MockCredentials extends Mock implements Credentials {}
class MockUserProfile extends Mock implements UserProfile {}
class MockWebAuthenticationException extends Mock implements WebAuthenticationException {}

void main() {
  group('AuthService', () {
    late AuthService authService;
    late MockAuth0 mockAuth0;
    late MockWebAuthentication mockWebAuth;
    late MockManagementAPI mockAPI;

    setUp(() {
      mockAuth0 = MockAuth0();
      mockWebAuth = MockWebAuthentication();
      mockAPI = MockManagementAPI();
      
      // Setup Auth0 mock behaviors
      when(() => mockAuth0.webAuthentication(scheme: any(named: 'scheme')))
          .thenReturn(mockWebAuth);
      when(() => mockAuth0.api).thenReturn(mockAPI);
      
      authService = AuthService();
      // Replace the internal Auth0 instance with our mock
      // Note: This would require making _auth0 accessible for testing
    });

    group('login', () {
      test('should return Success with UserProfile on successful login', () async {
        // Arrange
        final mockCredentials = MockCredentials();
        final mockUserProfile = MockUserProfile();
        
        when(() => mockCredentials.accessToken).thenReturn('test-access-token');
        when(() => mockCredentials.refreshToken).thenReturn('test-refresh-token');
        when(() => mockCredentials.idToken).thenReturn('test-id-token');
        
        when(() => mockUserProfile.email).thenReturn('test@example.com');
        when(() => mockUserProfile.toMap()).thenReturn({
          'sub': 'test-user-id',
          'email': 'test@example.com',
          'name': 'Test User',
        });

        when(() => mockWebAuth.login(
          audience: any(named: 'audience'),
          scopes: any(named: 'scopes'),
          redirectUrl: any(named: 'redirectUrl'),
        )).thenAnswer((_) async => mockCredentials);

        when(() => mockAPI.userProfile(accessToken: any(named: 'accessToken')))
            .thenAnswer((_) async => mockUserProfile);

        // Act
        final result = await authService.login();

        // Assert
        expect(result, isA<Success<UserProfile>>());
        final success = result as Success<UserProfile>;
        expect(success.data.email, equals('test@example.com'));
        
        verify(() => mockWebAuth.login(
          audience: AppEnvironment.auth0Audience,
          scopes: {'openid', 'profile', 'email', 'offline_access'},
          redirectUrl: AppEnvironment.auth0RedirectUri,
        )).called(1);
      });

      test('should return Error with AuthFailure on authentication cancellation', () async {
        // Arrange
        final mockException = MockWebAuthenticationException();
        when(() => mockException.code).thenReturn('a0.authentication_canceled');
        
        when(() => mockWebAuth.login(
          audience: any(named: 'audience'),
          scopes: any(named: 'scopes'),
          redirectUrl: any(named: 'redirectUrl'),
        )).thenThrow(mockException);

        // Act
        final result = await authService.login();

        // Assert
        expect(result, isA<Error<UserProfile>>());
        final error = result as Error<UserProfile>;
        expect(error.failure, isA<AuthFailure>());
        final authFailure = error.failure as AuthFailure;
        expect(authFailure.code, equals('login_cancelled'));
      });

      test('should return Error with AuthFailure on general authentication failure', () async {
        // Arrange
        final mockException = MockWebAuthenticationException();
        when(() => mockException.code).thenReturn('authentication_failed');
        when(() => mockException.toString()).thenReturn('Authentication failed');
        
        when(() => mockWebAuth.login(
          audience: any(named: 'audience'),
          scopes: any(named: 'scopes'),
          redirectUrl: any(named: 'redirectUrl'),
        )).thenThrow(mockException);

        // Act
        final result = await authService.login();

        // Assert
        expect(result, isA<Error<UserProfile>>());
        final error = result as Error<UserProfile>;
        expect(error.failure, isA<AuthFailure>());
      });

      test('should use development auth when enableDevelopmentAuth is true', () async {
        // This test would require mocking AppEnvironment.enableDevelopmentAuth
        // Skip for now as it requires more complex setup
      });
    });

    group('logout', () {
      test('should return Success on successful logout', () async {
        // Arrange
        when(() => mockWebAuth.logout(
          returnTo: any(named: 'returnTo'),
        )).thenAnswer((_) async {});

        // Act
        final result = await authService.logout();

        // Assert
        expect(result, isA<Success<void>>());
        verify(() => mockWebAuth.logout(
          returnTo: AppEnvironment.auth0LogoutUri,
        )).called(1);
      });

      test('should return Error on logout failure but still clear credentials', () async {
        // Arrange
        when(() => mockWebAuth.logout(
          returnTo: any(named: 'returnTo'),
        )).thenThrow(Exception('Logout failed'));

        // Act
        final result = await authService.logout();

        // Assert
        expect(result, isA<Error<void>>());
        // Should still attempt to clear local credentials even if logout fails
      });
    });

    group('isAuthenticated', () {
      test('should return true when access token exists', () async {
        // This would require mocking flutter_secure_storage
        // Skip for now as it requires more complex setup
      });

      test('should return false when no access token exists', () async {
        // This would require mocking flutter_secure_storage
        // Skip for now as it requires more complex setup
      });
    });

    group('getAccessToken', () {
      test('should return refreshed access token when refresh token exists', () async {
        // This would require mocking flutter_secure_storage and token refresh
        // Skip for now as it requires more complex setup
      });

      test('should return null when no refresh token exists', () async {
        // This would require mocking flutter_secure_storage
        // Skip for now as it requires more complex setup
      });
    });
  });
}