import 'dart:convert';
import 'dart:developer' as dev;
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'secure_storage_service.g.dart';

@riverpod
SecureStorageService secureStorageService(Ref ref) {
  return SecureStorageService();
}

/// Service for secure storage operations using platform-specific secure storage
class SecureStorageService {
  late final FlutterSecureStorage _storage;

  SecureStorageService() {
    _storage = const FlutterSecureStorage(
      aOptions: AndroidOptions(
        encryptedSharedPreferences: true,
        keyCipherAlgorithm: KeyCipherAlgorithm.RSA_ECB_PKCS1Padding,
        storageCipherAlgorithm: StorageCipherAlgorithm.AES_GCM_NoPadding,
      ),
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
        synchronizable: false,
      ),
      wOptions: WindowsOptions(),
      lOptions: LinuxOptions(),
      mOptions: MacOsOptions(),
    );
  }

  /// Write a string value to secure storage
  Future<void> write(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
      dev.log('Stored value for key: ${_sanitizeKey(key)}', name: 'SecureStorage');
    } catch (error) {
      dev.log('Failed to store value for key ${_sanitizeKey(key)}: $error', name: 'SecureStorage');
      rethrow;
    }
  }

  /// Read a string value from secure storage
  Future<String?> read(String key) async {
    try {
      final value = await _storage.read(key: key);
      dev.log('Retrieved value for key: ${_sanitizeKey(key)} (${value != null ? 'found' : 'not found'})', 
              name: 'SecureStorage');
      return value;
    } catch (error) {
      dev.log('Failed to read value for key ${_sanitizeKey(key)}: $error', name: 'SecureStorage');
      return null;
    }
  }

  /// Delete a value from secure storage
  Future<void> delete(String key) async {
    try {
      await _storage.delete(key: key);
      dev.log('Deleted value for key: ${_sanitizeKey(key)}', name: 'SecureStorage');
    } catch (error) {
      dev.log('Failed to delete value for key ${_sanitizeKey(key)}: $error', name: 'SecureStorage');
      rethrow;
    }
  }

  /// Check if a key exists in secure storage
  Future<bool> containsKey(String key) async {
    try {
      final exists = await _storage.containsKey(key: key);
      dev.log('Key ${_sanitizeKey(key)} exists: $exists', name: 'SecureStorage');
      return exists;
    } catch (error) {
      dev.log('Failed to check existence of key ${_sanitizeKey(key)}: $error', name: 'SecureStorage');
      return false;
    }
  }

  /// Delete all values from secure storage
  Future<void> deleteAll() async {
    try {
      await _storage.deleteAll();
      dev.log('Deleted all stored values', name: 'SecureStorage');
    } catch (error) {
      dev.log('Failed to delete all values: $error', name: 'SecureStorage');
      rethrow;
    }
  }

  /// Get all keys from secure storage
  Future<Map<String, String>> readAll() async {
    try {
      final values = await _storage.readAll();
      dev.log('Retrieved ${values.length} stored values', name: 'SecureStorage');
      return values;
    } catch (error) {
      dev.log('Failed to read all values: $error', name: 'SecureStorage');
      return {};
    }
  }

  /// Store a JSON-serializable object
  Future<void> writeJson(String key, Map<String, dynamic> value) async {
    try {
      final jsonString = jsonEncode(value);
      await write(key, jsonString);
    } catch (error) {
      dev.log('Failed to store JSON for key ${_sanitizeKey(key)}: $error', name: 'SecureStorage');
      rethrow;
    }
  }

  /// Read a JSON object from secure storage
  Future<Map<String, dynamic>?> readJson(String key) async {
    try {
      final jsonString = await read(key);
      if (jsonString == null) return null;
      
      return jsonDecode(jsonString) as Map<String, dynamic>;
    } catch (error) {
      dev.log('Failed to read JSON for key ${_sanitizeKey(key)}: $error', name: 'SecureStorage');
      return null;
    }
  }

  /// Store a list of strings
  Future<void> writeStringList(String key, List<String> value) async {
    try {
      final jsonString = jsonEncode(value);
      await write(key, jsonString);
    } catch (error) {
      dev.log('Failed to store string list for key ${_sanitizeKey(key)}: $error', name: 'SecureStorage');
      rethrow;
    }
  }

  /// Read a list of strings from secure storage
  Future<List<String>?> readStringList(String key) async {
    try {
      final jsonString = await read(key);
      if (jsonString == null) return null;
      
      final decoded = jsonDecode(jsonString);
      if (decoded is List) {
        return decoded.map((e) => e.toString()).toList();
      }
      return null;
    } catch (error) {
      dev.log('Failed to read string list for key ${_sanitizeKey(key)}: $error', name: 'SecureStorage');
      return null;
    }
  }

  /// Generate and store a master encryption key if it doesn't exist
  Future<String> getMasterEncryptionKey() async {
    try {
      String? existingKey = await read(SecureStorageKeys.masterEncryptionKey);
      
      if (existingKey != null) {
        return existingKey;
      }
      
      // Generate new master key (32 bytes = 256 bits) using secure random
      final random = Random.secure();
      final bytes = List<int>.generate(32, (i) => random.nextInt(256));
      final key = base64.encode(bytes);
      
      await write(SecureStorageKeys.masterEncryptionKey, key);
      dev.log('Generated and stored new master encryption key', name: 'SecureStorage');
      
      return key;
    } catch (error) {
      dev.log('Failed to get master encryption key: $error', name: 'SecureStorage');
      rethrow;
    }
  }

  /// Store an encryption key for a specific card
  Future<void> storeCardEncryptionKey(String cardId, String key) async {
    try {
      await write(SecureStorageKeys.cardEncryptionKey(cardId), key);
      dev.log('Stored encryption key for card: $cardId', name: 'SecureStorage');
    } catch (error) {
      dev.log('Failed to store encryption key for card $cardId: $error', name: 'SecureStorage');
      rethrow;
    }
  }

  /// Retrieve an encryption key for a specific card
  Future<String?> getCardEncryptionKey(String cardId) async {
    try {
      final key = await read(SecureStorageKeys.cardEncryptionKey(cardId));
      dev.log('Retrieved encryption key for card: $cardId (${key != null ? 'found' : 'not found'})', 
              name: 'SecureStorage');
      return key;
    } catch (error) {
      dev.log('Failed to get encryption key for card $cardId: $error', name: 'SecureStorage');
      return null;
    }
  }

  /// Delete an encryption key for a specific card
  Future<void> deleteCardEncryptionKey(String cardId) async {
    try {
      await delete(SecureStorageKeys.cardEncryptionKey(cardId));
      dev.log('Deleted encryption key for card: $cardId', name: 'SecureStorage');
    } catch (error) {
      dev.log('Failed to delete encryption key for card $cardId: $error', name: 'SecureStorage');
      rethrow;
    }
  }

  /// Sanitize sensitive keys for logging to prevent data leakage
  String _sanitizeKey(String key) {
    // List of sensitive key patterns
    const sensitivePatterns = [
      'token',
      'key', 
      'password',
      'secret',
      'auth',
      'credential',
    ];

    final lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive patterns
    for (final pattern in sensitivePatterns) {
      if (lowerKey.contains(pattern)) {
        // Obfuscate the key - show first 4 and last 2 characters
        if (key.length > 6) {
          return '${key.substring(0, 4)}***${key.substring(key.length - 2)}';
        } else {
          return '***';
        }
      }
    }
    
    return key; // Non-sensitive keys can be logged as-is
  }
}

/// Secure storage keys for consistent key management
class SecureStorageKeys {
  // Auth0 tokens
  static const String accessToken = 'auth0_access_token';
  static const String refreshToken = 'auth0_refresh_token';
  static const String idToken = 'auth0_id_token';
  
  // User data
  static const String userProfile = 'auth0_user_profile';
  static const String userPreferences = 'user_preferences';
  
  // App settings
  static const String lastSyncTimestamp = 'last_sync_timestamp';
  static const String deviceId = 'device_id';
  
  // Development
  static const String devAuthEnabled = 'dev_auth_enabled';
  
  // Encryption keys - moved from database to secure storage for security
  static const String masterEncryptionKey = 'master_encryption_key';
  static String cardEncryptionKey(String cardId) => 'card_encryption_key_$cardId';
}