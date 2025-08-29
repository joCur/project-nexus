// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_preferences.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UserPreference _$UserPreferenceFromJson(Map<String, dynamic> json) =>
    UserPreference(
      id: json['id'] as String,
      key: json['key'] as String,
      value: json['value'],
      type: $enumDecode(_$PreferenceTypeEnumMap, json['type']),
      userId: json['userId'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$UserPreferenceToJson(UserPreference instance) =>
    <String, dynamic>{
      'id': instance.id,
      'key': instance.key,
      'value': instance.value,
      'type': _$PreferenceTypeEnumMap[instance.type]!,
      'userId': instance.userId,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

const _$PreferenceTypeEnumMap = {
  PreferenceType.string: 'STRING',
  PreferenceType.number: 'NUMBER',
  PreferenceType.boolean: 'BOOLEAN',
  PreferenceType.object: 'OBJECT',
  PreferenceType.array: 'ARRAY',
};

UserPreferences _$UserPreferencesFromJson(Map<String, dynamic> json) =>
    UserPreferences(
      preferences:
          (json['preferences'] as Map<String, dynamic>?)?.map(
            (k, e) =>
                MapEntry(k, UserPreference.fromJson(e as Map<String, dynamic>)),
          ) ??
          {},
    );

Map<String, dynamic> _$UserPreferencesToJson(UserPreferences instance) =>
    <String, dynamic>{'preferences': instance.preferences};
