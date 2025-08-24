import 'package:json_annotation/json_annotation.dart';

part 'user_profile.g.dart';

@JsonSerializable()
class UserProfile {
  final String sub;
  final String? email;
  final String? name;
  final String? picture;
  final String? nickname;
  final bool? emailVerified;
  final DateTime? updatedAt;

  const UserProfile({
    required this.sub,
    this.email,
    this.name,
    this.picture,
    this.nickname,
    this.emailVerified,
    this.updatedAt,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) =>
      _$UserProfileFromJson(json);

  Map<String, dynamic> toJson() => _$UserProfileToJson(this);

  // For backward compatibility with existing code
  Map<String, dynamic> toMap() => toJson();
  factory UserProfile.fromMap(Map<String, dynamic> map) => UserProfile.fromJson(map);

  @override
  String toString() {
    return 'UserProfile(sub: $sub, email: $email, name: $name, picture: $picture)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is UserProfile &&
        other.sub == sub &&
        other.email == email &&
        other.name == name &&
        other.picture == picture &&
        other.nickname == nickname &&
        other.emailVerified == emailVerified &&
        other.updatedAt == updatedAt;
  }

  @override
  int get hashCode {
    return sub.hashCode ^
        email.hashCode ^
        name.hashCode ^
        picture.hashCode ^
        nickname.hashCode ^
        emailVerified.hashCode ^
        updatedAt.hashCode;
  }
}