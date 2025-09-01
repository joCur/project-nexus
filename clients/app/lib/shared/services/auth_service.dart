import 'dart:convert';
import 'dart:developer' as dev;

import 'package:auth0_flutter/auth0_flutter.dart' as auth0;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/errors/failures.dart';
import '../../core/platform/environment.dart';
import '../../core/utils/result.dart';
import '../models/user_profile.dart';

part 'auth_service.g.dart';

@riverpod
AuthService authService(Ref ref) {
  return AuthService._();
}

class AuthService {
  auth0.Auth0? _auth0;
  FlutterSecureStorage? _storage;
  bool _initialized = false;

  // Private constructor to prevent direct instantiation
  AuthService._();
  
  /// Lazy initialization of Auth0 and storage
  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    
    // Initialize Auth0 client
    _auth0 = auth0.Auth0(
      AppEnvironment.auth0Domain,
      AppEnvironment.auth0ClientId,
    );
    
    // Initialize secure storage
    _storage = const FlutterSecureStorage(
      aOptions: AndroidOptions(
        encryptedSharedPreferences: true,
      ),
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    );
    
    _initialized = true;
  }
  
  /// Get Auth0 client, initializing if necessary
  Future<auth0.Auth0> get _auth0Client async {
    await _ensureInitialized();
    return _auth0!;
  }
  
  /// Get secure storage, initializing if necessary
  Future<FlutterSecureStorage> get storage async {
    await _ensureInitialized();
    return _storage!;
  }

  static const String _accessTokenKey = 'auth0_access_token';
  static const String _refreshTokenKey = 'auth0_refresh_token';
  static const String _idTokenKey = 'auth0_id_token';
  static const String _userProfileKey = 'auth0_user_profile';

  /// Login using Auth0 Universal Login
  Future<Result<UserProfile>> login() async {
    try {
      final auth0Client = await _auth0Client;
      
      final credentials = await auth0Client.webAuthentication(
            scheme: 'dev.curth.nexusmobile'
          ).login(
            audience: AppEnvironment.auth0Audience,
            scopes: {'openid', 'profile', 'email', 'offline_access'},
            redirectUrl: AppEnvironment.auth0RedirectUri,
          );

      await _storeCredentials(credentials);
      
      final auth0User = await auth0Client.api.userProfile(accessToken: credentials.accessToken);
      
      // Convert Auth0 User to our UserProfile
      final user = UserProfile(
        sub: auth0User.sub,
        email: auth0User.email,
        name: auth0User.name,
        picture: auth0User.pictureUrl.toString(),
        nickname: auth0User.nickname,
        emailVerified: auth0User.isEmailVerified,
        updatedAt: auth0User.updatedAt,
      );
      
      await _storeUserProfile(user);

      return Success(user);
    } catch (error) {
      if (error is auth0.WebAuthenticationException) {
        if (error.code == 'a0.authentication_canceled' || error.code == 'a0.authentication_cancelled') {
          return Error(AuthFailure.loginCancelled());
        }
      }
      return Error(AuthFailure.loginFailed(error.toString()));
    }
  }

  /// Logout and clear stored credentials
  Future<Result<void>> logout() async {
    try {
      final auth0Client = await _auth0Client;
      
      await auth0Client.webAuthentication(
            scheme: 'dev.curth.nexusmobile'
          ).logout(
            returnTo: AppEnvironment.auth0LogoutUri,
          );
      
      await _clearStoredCredentials();
      return const Success(null);
    } catch (error) {
      // Even if logout fails, clear local credentials
      await _clearStoredCredentials();
      return Error(AuthFailure.logoutFailed(error.toString()));
    }
  }

  /// Get current access token, refreshing if necessary
  Future<String?> getAccessToken() async {
    try {
      final secureStorage = await storage;
      final refreshToken = await secureStorage.read(key: _refreshTokenKey);
      if (refreshToken == null) {
        return null;
      }

      // Try to refresh the token
      final auth0Client = await _auth0Client;
      final credentials = await auth0Client.api.renewCredentials(refreshToken: refreshToken);
      await _storeCredentials(credentials);
      
      return credentials.accessToken;
    } catch (error) {
      dev.log('Failed to refresh access token: $error', name: 'AuthService');
      final secureStorage = await storage;
      return await secureStorage.read(key: _accessTokenKey);
    }
  }

  /// Check if user is authenticated (optimized for speed)
  Future<bool> isAuthenticated() async {
    final secureStorage = await storage;
    final accessToken = await secureStorage.read(key: _accessTokenKey);
    return accessToken != null;
  }

  /// Get stored user profile
  Future<UserProfile?> getUserProfile() async {
    try {
      final secureStorage = await storage;
      final profileJson = await secureStorage.read(key: _userProfileKey);
      if (profileJson == null) return null;
      
      final profileMap = jsonDecode(profileJson) as Map<String, dynamic>;
      return UserProfile.fromMap(profileMap);
    } catch (error) {
      dev.log('Failed to get user profile: $error', name: 'AuthService');
      return null;
    }
  }

  /// Store credentials securely
  Future<void> _storeCredentials(auth0.Credentials credentials) async {
    final secureStorage = await storage;
    await Future.wait([
      secureStorage.write(key: _accessTokenKey, value: credentials.accessToken),
      if (credentials.refreshToken != null)
        secureStorage.write(key: _refreshTokenKey, value: credentials.refreshToken!),
      secureStorage.write(key: _idTokenKey, value: credentials.idToken),
    ]);
  }

  /// Store user profile securely
  Future<void> _storeUserProfile(UserProfile profile) async {
    final secureStorage = await storage;
    final profileJson = jsonEncode(profile.toMap());
    await secureStorage.write(key: _userProfileKey, value: profileJson);
  }

  /// Clear all stored credentials
  Future<void> _clearStoredCredentials() async {
    final secureStorage = await storage;
    await Future.wait([
      secureStorage.delete(key: _accessTokenKey),
      secureStorage.delete(key: _refreshTokenKey),
      secureStorage.delete(key: _idTokenKey),
      secureStorage.delete(key: _userProfileKey),
    ]);
  }

}

