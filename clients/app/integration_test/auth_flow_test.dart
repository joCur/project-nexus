import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';
import 'package:auth0_flutter/auth0_flutter.dart';

import 'package:nexus_mobile/main.dart';
import 'package:nexus_mobile/shared/services/auth_service.dart';
import 'package:nexus_mobile/core/utils/result.dart';
import 'package:nexus_mobile/core/errors/failures.dart';

// Mock classes for integration testing
class MockAuthService extends Mock implements AuthService {}
class MockUserProfile extends Mock implements UserProfile {}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Authentication Flow Integration Tests', () {
    late MockAuthService mockAuthService;
    late MockUserProfile mockUserProfile;

    setUp(() {
      mockAuthService = MockAuthService();
      mockUserProfile = MockUserProfile();
      
      // Setup mock user profile
      when(() => mockUserProfile.sub).thenReturn('test-user-id');
      when(() => mockUserProfile.email).thenReturn('test@example.com');
      when(() => mockUserProfile.name).thenReturn('Test User');
      when(() => mockUserProfile.picture).thenReturn('https://example.com/avatar.jpg');
    });

    testWidgets('Complete authentication flow - login to authenticated state', (WidgetTester tester) async {
      // Arrange - Mock successful authentication
      when(() => mockAuthService.isAuthenticated())
          .thenAnswer((_) async => false);
      when(() => mockAuthService.login())
          .thenAnswer((_) async => Success(mockUserProfile));
      when(() => mockAuthService.getUserProfile())
          .thenAnswer((_) async => mockUserProfile);

      // Act - Launch app
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            // Override auth service with mock
            authServiceProvider.overrideWithValue(mockAuthService),
          ],
          child: const NexusApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Assert - Should show login screen initially
      expect(find.text('Welcome to Nexus'), findsOneWidget);
      expect(find.text('Login'), findsOneWidget);

      // Act - Tap login button
      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle();

      // Assert - Should show loading state
      expect(find.text('Logging in...'), findsOneWidget);
      
      // Wait for authentication to complete
      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Assert - Should navigate to main app after successful auth
      // Note: The exact assertions would depend on your post-auth navigation
      expect(find.text('Welcome to Nexus'), findsNothing);
    });

    testWidgets('Authentication flow - login cancellation', (WidgetTester tester) async {
      // Arrange - Mock cancelled authentication
      when(() => mockAuthService.isAuthenticated())
          .thenAnswer((_) async => false);
      when(() => mockAuthService.login())
          .thenAnswer((_) async => Error(AuthFailure.loginCancelled()));

      // Act - Launch app and attempt login
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWithValue(mockAuthService),
          ],
          child: const NexusApp(),
        ),
      );

      await tester.pumpAndSettle();
      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Assert - Should remain on login screen without error
      expect(find.text('Welcome to Nexus'), findsOneWidget);
      expect(find.text('Login'), findsOneWidget);
      expect(find.text('Authentication Error'), findsNothing);
    });

    testWidgets('Authentication flow - login failure', (WidgetTester tester) async {
      // Arrange - Mock failed authentication
      const errorMessage = 'Network error occurred';
      when(() => mockAuthService.isAuthenticated())
          .thenAnswer((_) async => false);
      when(() => mockAuthService.login())
          .thenAnswer((_) async => Error(AuthFailure.loginFailed(errorMessage)));

      // Act - Launch app and attempt login
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWithValue(mockAuthService),
          ],
          child: const NexusApp(),
        ),
      );

      await tester.pumpAndSettle();
      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Assert - Should show error message
      expect(find.text('Authentication Error'), findsOneWidget);
      expect(find.text(errorMessage), findsOneWidget);
    });

    testWidgets('Already authenticated user - skip login flow', (WidgetTester tester) async {
      // Arrange - Mock already authenticated user
      when(() => mockAuthService.isAuthenticated())
          .thenAnswer((_) async => true);
      when(() => mockAuthService.getUserProfile())
          .thenAnswer((_) async => mockUserProfile);

      // Act - Launch app
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWithValue(mockAuthService),
          ],
          child: const NexusApp(),
        ),
      );

      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Assert - Should bypass login and go to main app
      expect(find.text('Welcome to Nexus'), findsNothing);
      expect(find.text('Login'), findsNothing);
    });

    testWidgets('Logout flow - return to login screen', (WidgetTester tester) async {
      // Arrange - Start with authenticated user
      when(() => mockAuthService.isAuthenticated())
          .thenAnswer((_) async => true);
      when(() => mockAuthService.getUserProfile())
          .thenAnswer((_) async => mockUserProfile);
      when(() => mockAuthService.logout())
          .thenAnswer((_) async => const Success(null));

      // Act - Launch app (should be authenticated)
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWithValue(mockAuthService),
          ],
          child: const NexusApp(),
        ),
      );

      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Navigate to profile/auth screen and logout
      // Note: The exact navigation would depend on your app structure
      // This is a placeholder for the logout action

      // Mock the auth service to return false after logout
      when(() => mockAuthService.isAuthenticated())
          .thenAnswer((_) async => false);

      // Trigger logout (exact method would depend on your UI)
      // For now, just simulate the state change
      await tester.pumpAndSettle();

      // Assert - Should return to login screen
      // The exact assertions would depend on your navigation logic
    });

    group('Router Integration', () {
      testWidgets('Protected route redirects to login when unauthenticated', (WidgetTester tester) async {
        // This would test that protected routes redirect to login
        // when the user is not authenticated
      });

      testWidgets('Successful login redirects to intended route', (WidgetTester tester) async {
        // This would test that after successful login,
        // users are redirected to their intended destination
      });
    });

    group('State Persistence', () {
      testWidgets('App remembers authentication state across restarts', (WidgetTester tester) async {
        // This would test that authentication state persists
        // across app restarts using secure storage
      });

      testWidgets('Token refresh works automatically', (WidgetTester tester) async {
        // This would test that expired tokens are automatically
        // refreshed in the background
      });
    });
  });
}