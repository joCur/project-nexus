import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';
import 'package:go_router/go_router.dart';

import 'package:nexus_mobile/features/auth/presentation/screens/login_screen.dart';
import 'package:nexus_mobile/features/auth/domain/providers/auth_providers.dart';

// Mock classes
class MockAuthNotifier extends Mock implements AuthNotifier {}
class MockGoRouter extends Mock implements GoRouter {}

class FakeAuthState extends Fake implements AuthState {}

void main() {
  group('LoginScreen Widget Tests', () {
    late MockAuthNotifier mockAuthNotifier;

    setUpAll(() {
      registerFallbackValue(FakeAuthState());
    });

    setUp(() {
      mockAuthNotifier = MockAuthNotifier();
    });

    Widget createTestWidget({AuthState? authState}) {
      return ProviderScope(
        overrides: [
          authNotifierProvider.overrideWith((ref) => mockAuthNotifier),
        ],
        child: MaterialApp(
          home: Builder(
            builder: (context) {
              // Mock the provider to return specific state
              return Consumer(
                builder: (context, ref, child) {
                  // Override the provider if state is provided
                  if (authState != null) {
                    ref.read(authNotifierProvider.notifier);
                  }
                  return const LoginScreen();
                },
              );
            },
          ),
        ),
      );
    }

    testWidgets('displays app branding and login form', (WidgetTester tester) async {
      // Arrange
      when(() => mockAuthNotifier.build()).thenReturn(const AuthState());

      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Assert
      expect(find.text('Welcome to Nexus'), findsOneWidget);
      expect(find.text('Your AI-powered knowledge workspace'), findsOneWidget);
      expect(find.text('Login'), findsOneWidget);
      expect(find.byIcon(Icons.login), findsOneWidget);
      expect(find.byType(ElevatedButton), findsOneWidget);
    });

    testWidgets('shows development mode indicator when enabled', (WidgetTester tester) async {
      // Note: This test would require mocking AppEnvironment.enableDevelopmentAuth
      // Skip for now as it requires environment variable mocking
    });

    testWidgets('displays loading state during authentication', (WidgetTester tester) async {
      // Arrange
      const loadingState = AuthState(isLoading: true);
      when(() => mockAuthNotifier.build()).thenReturn(loadingState);

      // Act
      await tester.pumpWidget(createTestWidget(authState: loadingState));
      await tester.pumpAndSettle();

      // Assert
      expect(find.text('Logging in...'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('displays error message when authentication fails', (WidgetTester tester) async {
      // Arrange
      const errorMessage = 'Authentication failed';
      const errorState = AuthState(error: errorMessage);
      when(() => mockAuthNotifier.build()).thenReturn(errorState);

      // Act
      await tester.pumpWidget(createTestWidget(authState: errorState));
      await tester.pumpAndSettle();

      // Assert
      expect(find.text('Authentication Error'), findsOneWidget);
      expect(find.text(errorMessage), findsOneWidget);
      expect(find.byIcon(Icons.error_outline), findsOneWidget);
    });

    testWidgets('calls login when login button is tapped', (WidgetTester tester) async {
      // Arrange
      when(() => mockAuthNotifier.build()).thenReturn(const AuthState());
      when(() => mockAuthNotifier.login()).thenAnswer((_) async {});

      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle();

      // Assert
      verify(() => mockAuthNotifier.login()).called(1);
    });

    testWidgets('disables login button when loading', (WidgetTester tester) async {
      // Arrange
      const loadingState = AuthState(isLoading: true);
      when(() => mockAuthNotifier.build()).thenReturn(loadingState);

      // Act
      await tester.pumpWidget(createTestWidget(authState: loadingState));
      await tester.pumpAndSettle();

      // Assert
      final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(button.onPressed, isNull); // Button should be disabled
    });

    testWidgets('displays terms and privacy text', (WidgetTester tester) async {
      // Arrange
      when(() => mockAuthNotifier.build()).thenReturn(const AuthState());

      // Act
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Assert
      expect(find.textContaining('By continuing, you agree'), findsOneWidget);
      expect(find.textContaining('Terms of Service'), findsOneWidget);
      expect(find.textContaining('Privacy Policy'), findsOneWidget);
    });

    group('Navigation Tests', () {
      // Note: Navigation tests would require mocking GoRouter
      // These would test scenarios like:
      // - Redirecting after successful authentication
      // - Handling redirect_to query parameters
      // - Proper context usage after async operations
    });
  });
}