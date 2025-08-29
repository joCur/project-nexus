import 'dart:convert';
import 'package:json_annotation/json_annotation.dart';

part 'user_preferences.g.dart';

/// User preference value types
enum PreferenceType {
  @JsonValue('STRING')
  string('STRING'),
  @JsonValue('NUMBER')
  number('NUMBER'),
  @JsonValue('BOOLEAN')
  boolean('BOOLEAN'),
  @JsonValue('OBJECT')
  object('OBJECT'),
  @JsonValue('ARRAY')
  array('ARRAY');

  const PreferenceType(this.value);
  final String value;

  static PreferenceType fromString(String value) {
    switch (value.toUpperCase()) {
      case 'STRING':
        return PreferenceType.string;
      case 'NUMBER':
        return PreferenceType.number;
      case 'BOOLEAN':
        return PreferenceType.boolean;
      case 'OBJECT':
        return PreferenceType.object;
      case 'ARRAY':
        return PreferenceType.array;
      default:
        throw ArgumentError('Invalid PreferenceType: $value');
    }
  }
}

/// Individual user preference model
@JsonSerializable()
class UserPreference {
  final String id;
  final String key;
  final dynamic value;
  final PreferenceType type;
  final String userId;
  final DateTime createdAt;
  final DateTime updatedAt;

  const UserPreference({
    required this.id,
    required this.key,
    required this.value,
    required this.type,
    required this.userId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory UserPreference.fromJson(Map<String, dynamic> json) =>
      _$UserPreferenceFromJson(json);

  Map<String, dynamic> toJson() => _$UserPreferenceToJson(this);

  /// Create a new user preference
  factory UserPreference.create({
    required String id,
    required String key,
    required dynamic value,
    required String userId,
  }) {
    final now = DateTime.now();
    final type = _inferType(value);
    
    return UserPreference(
      id: id,
      key: key,
      value: value,
      type: type,
      userId: userId,
      createdAt: now,
      updatedAt: now,
    );
  }

  /// Infer preference type from value
  static PreferenceType _inferType(dynamic value) {
    if (value is String) return PreferenceType.string;
    if (value is num) return PreferenceType.number;
    if (value is bool) return PreferenceType.boolean;
    if (value is List) return PreferenceType.array;
    if (value is Map) return PreferenceType.object;
    throw ArgumentError('Unsupported preference value type: ${value.runtimeType}');
  }

  UserPreference copyWith({
    String? id,
    String? key,
    dynamic value,
    PreferenceType? type,
    String? userId,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return UserPreference(
      id: id ?? this.id,
      key: key ?? this.key,
      value: value ?? this.value,
      type: type ?? this.type,
      userId: userId ?? this.userId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  /// Update preference value with new timestamp
  UserPreference updateValue(dynamic newValue) {
    return copyWith(
      value: newValue,
      type: _inferType(newValue),
      updatedAt: DateTime.now(),
    );
  }

  /// Convert to database map for storage
  Map<String, dynamic> toDbMap() {
    return {
      'id': id,
      'key': key,
      'value': jsonEncode(value),
      'type': type.value,
      'user_id': userId,
      'created_at': createdAt.millisecondsSinceEpoch,
      'updated_at': updatedAt.millisecondsSinceEpoch,
    };
  }

  /// Create UserPreference from database map
  factory UserPreference.fromDbMap(Map<String, dynamic> map) {
    final type = PreferenceType.fromString(map['type']);
    final decodedValue = jsonDecode(map['value']);
    
    return UserPreference(
      id: map['id'],
      key: map['key'],
      value: decodedValue,
      type: type,
      userId: map['user_id'],
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['created_at']),
      updatedAt: DateTime.fromMillisecondsSinceEpoch(map['updated_at']),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UserPreference &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

/// Collection of user preferences with typed accessors
@JsonSerializable()
class UserPreferences {
  @JsonKey(defaultValue: <String, UserPreference>{})
  final Map<String, UserPreference> preferences;

  const UserPreferences({
    this.preferences = const <String, UserPreference>{},
  });

  factory UserPreferences.fromJson(Map<String, dynamic> json) =>
      _$UserPreferencesFromJson(json);

  Map<String, dynamic> toJson() => _$UserPreferencesToJson(this);

  /// Get string preference value
  String? getString(String key, [String? defaultValue]) {
    final pref = preferences[key];
    if (pref?.type == PreferenceType.string) {
      return pref!.value as String;
    }
    return defaultValue;
  }

  /// Get number preference value
  num? getNumber(String key, [num? defaultValue]) {
    final pref = preferences[key];
    if (pref?.type == PreferenceType.number) {
      return pref!.value as num;
    }
    return defaultValue;
  }

  /// Get boolean preference value
  bool? getBool(String key, [bool? defaultValue]) {
    final pref = preferences[key];
    if (pref?.type == PreferenceType.boolean) {
      return pref!.value as bool;
    }
    return defaultValue;
  }

  /// Get object preference value
  Map<String, dynamic>? getObject(String key, [Map<String, dynamic>? defaultValue]) {
    final pref = preferences[key];
    if (pref?.type == PreferenceType.object) {
      return pref!.value as Map<String, dynamic>;
    }
    return defaultValue;
  }

  /// Get array preference value
  List<dynamic>? getArray(String key, [List<dynamic>? defaultValue]) {
    final pref = preferences[key];
    if (pref?.type == PreferenceType.array) {
      return pref!.value as List<dynamic>;
    }
    return defaultValue;
  }

  /// Set preference value
  UserPreferences setPreference(String key, dynamic value, String userId) {
    final pref = UserPreference.create(
      id: key, // Using key as ID for simplicity
      key: key,
      value: value,
      userId: userId,
    );
    
    return copyWith(
      preferences: Map<String, UserPreference>.from(preferences)..[key] = pref,
    );
  }

  /// Remove preference
  UserPreferences removePreference(String key) {
    final newPreferences = Map<String, UserPreference>.from(preferences)..remove(key);
    return copyWith(preferences: newPreferences);
  }

  /// Check if preference exists
  bool hasPreference(String key) {
    return preferences.containsKey(key);
  }

  /// Get all preference keys
  List<String> get keys => preferences.keys.toList();

  UserPreferences copyWith({
    Map<String, UserPreference>? preferences,
  }) {
    return UserPreferences(
      preferences: preferences ?? this.preferences,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UserPreferences &&
          runtimeType == other.runtimeType &&
          preferences.length == other.preferences.length &&
          preferences.keys.every((key) => 
              other.preferences.containsKey(key) &&
              preferences[key] == other.preferences[key]);

  @override
  int get hashCode => preferences.hashCode;
}

/// Predefined preference keys for consistent access
class PreferenceKeys {
  // App settings
  static const String theme = 'app.theme';
  static const String language = 'app.language';
  static const String notifications = 'app.notifications';
  
  // Canvas settings
  static const String canvasZoom = 'canvas.zoom';
  static const String canvasBackground = 'canvas.background';
  static const String snapToGrid = 'canvas.snapToGrid';
  static const String gridSize = 'canvas.gridSize';
  static const String showGrid = 'canvas.showGrid';
  
  // Auto-save settings
  static const String autoSaveEnabled = 'autoSave.enabled';
  static const String autoSaveInterval = 'autoSave.interval';
  
  // Sync settings
  static const String syncOnWifi = 'sync.onWifiOnly';
  static const String syncFrequency = 'sync.frequency';
  static const String lastSyncTime = 'sync.lastSyncTime';
  
  // Card settings
  static const String defaultCardType = 'card.defaultType';
  static const String defaultCardStyle = 'card.defaultStyle';
  static const String cardPreviewMode = 'card.previewMode';
  
  // Privacy settings
  static const String analyticsEnabled = 'privacy.analytics';
  static const String crashReporting = 'privacy.crashReporting';
  static const String encryptionEnabled = 'privacy.encryption';
  
  // Performance settings
  static const String cacheSize = 'performance.cacheSize';
  static const String imageQuality = 'performance.imageQuality';
  static const String animationsEnabled = 'performance.animations';
}

/// Default preference values
class DefaultPreferences {
  static const Map<String, dynamic> defaults = {
    PreferenceKeys.theme: 'system',
    PreferenceKeys.language: 'en',
    PreferenceKeys.notifications: true,
    PreferenceKeys.canvasZoom: 1.0,
    PreferenceKeys.canvasBackground: '#FFFFFF',
    PreferenceKeys.snapToGrid: false,
    PreferenceKeys.gridSize: 20,
    PreferenceKeys.showGrid: false,
    PreferenceKeys.autoSaveEnabled: true,
    PreferenceKeys.autoSaveInterval: 5000,
    PreferenceKeys.syncOnWifi: false,
    PreferenceKeys.syncFrequency: 300000, // 5 minutes
    PreferenceKeys.defaultCardType: 'text',
    PreferenceKeys.cardPreviewMode: 'full',
    PreferenceKeys.analyticsEnabled: true,
    PreferenceKeys.crashReporting: true,
    PreferenceKeys.encryptionEnabled: false,
    PreferenceKeys.cacheSize: 100 * 1024 * 1024, // 100MB
    PreferenceKeys.imageQuality: 0.8,
    PreferenceKeys.animationsEnabled: true,
  };
}