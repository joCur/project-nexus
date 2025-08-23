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
    switch (_environment) {
      case Environment.development:
        return const String.fromEnvironment(
          'AUTH0_DOMAIN',
          defaultValue: 'your-tenant.auth0.com',
        );
      case Environment.production:
        return const String.fromEnvironment(
          'AUTH0_DOMAIN',
          defaultValue: 'your-tenant.auth0.com',
        );
    }
  }

  static String get auth0ClientId {
    switch (_environment) {
      case Environment.development:
        return const String.fromEnvironment(
          'AUTH0_CLIENT_ID',
          defaultValue: 'your-auth0-client-id',
        );
      case Environment.production:
        return const String.fromEnvironment(
          'AUTH0_CLIENT_ID',
          defaultValue: 'your-auth0-client-id',
        );
    }
  }

  static String get auth0Audience {
    switch (_environment) {
      case Environment.development:
        return const String.fromEnvironment(
          'AUTH0_AUDIENCE',
          defaultValue: 'https://api.nexus.app',
        );
      case Environment.production:
        return const String.fromEnvironment(
          'AUTH0_AUDIENCE',
          defaultValue: 'https://api.nexus.app',
        );
    }
  }

  static String get auth0RedirectUri {
    switch (_environment) {
      case Environment.development:
        return 'dev.curth.nexusmobile://login';
      case Environment.production:
        return 'dev.curth.nexusmobile://login';
    }
  }

  static String get auth0LogoutUri {
    switch (_environment) {
      case Environment.development:
        return 'dev.curth.nexusmobile://logout';
      case Environment.production:
        return 'dev.curth.nexusmobile://logout';
    }
  }

  // Development mode authentication - disabled by default to ensure real Auth0 integration
  static bool get enableDevelopmentAuth => isDevelopment && 
    const bool.fromEnvironment('ENABLE_DEV_AUTH', defaultValue: false);
}