import 'package:flutter_test/flutter_test.dart';

import 'package:nexus_mobile/shared/services/auth_service.dart';

void main() {
  group('AuthService', () {
    // Basic smoke tests that verify the service can be instantiated with environment variables
    test('should instantiate with environment variables', () {
      // This test verifies that AuthService can be created when environment variables are provided
      expect(() => AuthService(), returnsNormally);
    });

    test('should have required methods defined', () {
      final authService = AuthService();
      
      // Verify the service has the expected methods
      expect(authService.login, isA<Function>());
      expect(authService.logout, isA<Function>());
      expect(authService.isAuthenticated, isA<Function>());
      expect(authService.getAccessToken, isA<Function>());
      expect(authService.getUserProfile, isA<Function>());
    });
    
    // Note: More comprehensive integration tests would require mocking Auth0 SDK
    // and FlutterSecureStorage, which is complex and better suited for integration testing
    // The core authentication logic is tested via auth_providers_test.dart
  });
}