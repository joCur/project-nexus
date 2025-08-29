import 'dart:convert';
import 'package:json_annotation/json_annotation.dart';
import 'card_enums.dart';

part 'sync_operation.g.dart';

/// Sync operation model for offline operations queue
@JsonSerializable()
class SyncOperation {
  final String id;
  final SyncOperationType operation;
  final EntityType entityType;
  final String entityId;
  @JsonKey(defaultValue: <String, dynamic>{})
  final Map<String, dynamic> data;
  final DateTime createdAt;
  @JsonKey(defaultValue: 0)
  final int attempts;
  final DateTime? lastAttempt;
  final SyncStatus status;
  final String? errorMessage;
  @JsonKey(defaultValue: 0)
  final int priority;
  final String userId;

  const SyncOperation({
    required this.id,
    required this.operation,
    required this.entityType,
    required this.entityId,
    this.data = const <String, dynamic>{},
    required this.createdAt,
    this.attempts = 0,
    this.lastAttempt,
    required this.status,
    this.errorMessage,
    this.priority = 0,
    required this.userId,
  });

  factory SyncOperation.fromJson(Map<String, dynamic> json) =>
      _$SyncOperationFromJson(json);

  Map<String, dynamic> toJson() => _$SyncOperationToJson(this);

  /// Create a new sync operation
  factory SyncOperation.create({
    required String id,
    required SyncOperationType operation,
    required EntityType entityType,
    required String entityId,
    Map<String, dynamic>? data,
    required String userId,
    int priority = 0,
  }) {
    return SyncOperation(
      id: id,
      operation: operation,
      entityType: entityType,
      entityId: entityId,
      data: data ?? <String, dynamic>{},
      createdAt: DateTime.now(),
      status: SyncStatus.pending,
      userId: userId,
      priority: priority,
    );
  }

  SyncOperation copyWith({
    String? id,
    SyncOperationType? operation,
    EntityType? entityType,
    String? entityId,
    Map<String, dynamic>? data,
    DateTime? createdAt,
    int? attempts,
    DateTime? lastAttempt,
    SyncStatus? status,
    String? errorMessage,
    int? priority,
    String? userId,
  }) {
    return SyncOperation(
      id: id ?? this.id,
      operation: operation ?? this.operation,
      entityType: entityType ?? this.entityType,
      entityId: entityId ?? this.entityId,
      data: data ?? this.data,
      createdAt: createdAt ?? this.createdAt,
      attempts: attempts ?? this.attempts,
      lastAttempt: lastAttempt ?? this.lastAttempt,
      status: status ?? this.status,
      errorMessage: errorMessage ?? this.errorMessage,
      priority: priority ?? this.priority,
      userId: userId ?? this.userId,
    );
  }

  /// Mark operation as in progress
  SyncOperation markInProgress() {
    return copyWith(
      status: SyncStatus.inProgress,
      lastAttempt: DateTime.now(),
    );
  }

  /// Mark operation as completed
  SyncOperation markCompleted() {
    return copyWith(
      status: SyncStatus.completed,
      errorMessage: null,
    );
  }

  /// Mark operation as failed with error
  SyncOperation markFailed(String error) {
    return copyWith(
      status: SyncStatus.failed,
      errorMessage: error,
      attempts: attempts + 1,
      lastAttempt: DateTime.now(),
    );
  }

  /// Increment attempt count
  SyncOperation incrementAttempts() {
    return copyWith(
      attempts: attempts + 1,
      lastAttempt: DateTime.now(),
    );
  }

  /// Convert to database map for storage
  Map<String, dynamic> toDbMap() {
    return {
      'id': id,
      'operation': operation.value,
      'entity_type': entityType.value,
      'entity_id': entityId,
      'data': jsonEncode(data),
      'created_at': createdAt.millisecondsSinceEpoch,
      'attempts': attempts,
      'last_attempt': lastAttempt?.millisecondsSinceEpoch,
      'status': status.value,
      'error_message': errorMessage,
      'priority': priority,
      'user_id': userId,
    };
  }

  /// Create SyncOperation from database map
  factory SyncOperation.fromDbMap(Map<String, dynamic> map) {
    return SyncOperation(
      id: map['id'],
      operation: SyncOperationType.fromString(map['operation']),
      entityType: EntityType.fromString(map['entity_type']),
      entityId: map['entity_id'],
      data: jsonDecode(map['data']) as Map<String, dynamic>,
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['created_at']),
      attempts: map['attempts'] ?? 0,
      lastAttempt: map['last_attempt'] != null
          ? DateTime.fromMillisecondsSinceEpoch(map['last_attempt'])
          : null,
      status: SyncStatus.fromString(map['status']),
      errorMessage: map['error_message'],
      priority: map['priority'] ?? 0,
      userId: map['user_id'],
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SyncOperation &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

/// Conflict resolution model for sync conflicts
@JsonSerializable()
class ConflictResolution {
  final ConflictStrategy strategy;
  final int clientVersion;
  final int serverVersion;
  final List<String> conflictedFields;

  const ConflictResolution({
    required this.strategy,
    required this.clientVersion,
    required this.serverVersion,
    required this.conflictedFields,
  });

  factory ConflictResolution.fromJson(Map<String, dynamic> json) =>
      _$ConflictResolutionFromJson(json);

  Map<String, dynamic> toJson() => _$ConflictResolutionToJson(this);
}

/// Card conflict model for concurrent editing conflicts
@JsonSerializable()
class CardConflict {
  final String cardId;
  @JsonKey(defaultValue: <String, dynamic>{})
  final Map<String, dynamic> clientData;
  @JsonKey(defaultValue: <String, dynamic>{})
  final Map<String, dynamic> serverData;
  final ConflictResolution? resolution;

  const CardConflict({
    required this.cardId,
    this.clientData = const <String, dynamic>{},
    this.serverData = const <String, dynamic>{},
    this.resolution,
  });

  factory CardConflict.fromJson(Map<String, dynamic> json) =>
      _$CardConflictFromJson(json);

  Map<String, dynamic> toJson() => _$CardConflictToJson(this);

  CardConflict copyWith({
    String? cardId,
    Map<String, dynamic>? clientData,
    Map<String, dynamic>? serverData,
    ConflictResolution? resolution,
  }) {
    return CardConflict(
      cardId: cardId ?? this.cardId,
      clientData: clientData ?? this.clientData,
      serverData: serverData ?? this.serverData,
      resolution: resolution ?? this.resolution,
    );
  }
}