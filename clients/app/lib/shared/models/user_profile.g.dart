// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_profile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UserProfile _$UserProfileFromJson(Map<String, dynamic> json) => UserProfile(
  sub: json['sub'] as String,
  email: json['email'] as String?,
  name: json['name'] as String?,
  picture: json['picture'] as String?,
  nickname: json['nickname'] as String?,
  emailVerified: json['emailVerified'] as bool?,
  updatedAt: json['updatedAt'] == null
      ? null
      : DateTime.parse(json['updatedAt'] as String),
);

Map<String, dynamic> _$UserProfileToJson(UserProfile instance) =>
    <String, dynamic>{
      'sub': instance.sub,
      'email': instance.email,
      'name': instance.name,
      'picture': instance.picture,
      'nickname': instance.nickname,
      'emailVerified': instance.emailVerified,
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };
