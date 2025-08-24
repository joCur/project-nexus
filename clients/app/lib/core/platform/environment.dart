/// Environment configuration for the Nexus Mobile app.
/// 
/// Required environment variables:
/// - AUTH0_DOMAIN: Your Auth0 tenant domain (e.g., 'your-tenant.auth0.com')
/// - AUTH0_CLIENT_ID: Your Auth0 application client ID
/// - AUTH0_AUDIENCE: Your Auth0 API audience (e.g., 'https://api.nexus.app')
/// 
/// Optional environment variables:
/// - ENVIRONMENT: 'development' or 'production' (default: 'development')
/// - DEV_BASE_URL: Development API base URL (default: 'http://localhost:4000')
/// - PROD_BASE_URL: Production API base URL (default: 'https://api.nexus.app')
///
/// Usage in Flutter:
/// flutter run --dart-define=AUTH0_DOMAIN=your-tenant.auth0.com --dart-define=AUTH0_CLIENT_ID=your-client-id
enum Environment { development, production }

class AppEnvironment {
  static const String _environmentName = String.fromEnvironment('ENVIRONMENT', defaultValue: 'development');
  
  static Environment get _environment {
    switch (_environmentName) {
      case 'production':
        return Environment.production;
      case 'development':
      default:
        return Environment.development;
    }
  }

  static Environment get current => _environment;

  static bool get isDevelopment => _environment == Environment.development;
  static bool get isProduction => _environment == Environment.production;

  static String get baseUrl {
    switch (_environment) {
      case Environment.development:
        return const String.fromEnvironment(
          'DEV_BASE_URL',
          defaultValue: 'http://localhost:4000',
        );
      case Environment.production:
        return const String.fromEnvironment(
          'PROD_BASE_URL',
          defaultValue: 'https://api.nexus.app',
        );
    }
  }

  static String get appName {
    switch (_environment) {
      case Environment.development:
        return 'Nexus Mobile (Dev)';
      case Environment.production:
        return 'Nexus Mobile';
    }
  }

  static Duration get networkTimeout {
    switch (_environment) {
      case Environment.development:
        return const Duration(seconds: 60); // Longer timeout for debugging
      case Environment.production:
        return const Duration(seconds: 30);
    }
  }

  // Auth0 Configuration
  static String get auth0Domain {
    const domain = String.fromEnvironment('AUTH0_DOMAIN');
    if (domain.isEmpty) {
      throw Exception('AUTH0_DOMAIN environment variable is required but not set');
    }
    return domain;
  }

  static String get auth0ClientId {
    const clientId = String.fromEnvironment('AUTH0_CLIENT_ID');
    if (clientId.isEmpty) {
      throw Exception('AUTH0_CLIENT_ID environment variable is required but not set');
    }
    return clientId;
  }

  static String get auth0Audience {
    const audience = String.fromEnvironment('AUTH0_AUDIENCE');
    if (audience.isEmpty) {
      throw Exception('AUTH0_AUDIENCE environment variable is required but not set');
    }
    return audience;
  }

  static String get auth0RedirectUri {
    switch (_environment) {
      case Environment.development:
        // Using custom scheme for simpler setup (Android: SCHEME://DOMAIN/android/PACKAGE/callback)
        return 'dev.curth.nexusmobile://$auth0Domain/android/dev.curth.nexusmobile/callback';
      case Environment.production:
        return 'dev.curth.nexusmobile://$auth0Domain/android/dev.curth.nexusmobile/callback';
    }
  }

  static String get auth0LogoutUri {
    switch (_environment) {
      case Environment.development:
        return 'dev.curth.nexusmobile://$auth0Domain/android/dev.curth.nexusmobile/callback';
      case Environment.production:
        return 'dev.curth.nexusmobile://$auth0Domain/android/dev.curth.nexusmobile/callback';
    }
  }

}