// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_operation.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncOperation _$SyncOperationFromJson(Map<String, dynamic> json) =>
    SyncOperation(
      id: json['id'] as String,
      operation: $enumDecode(_$SyncOperationTypeEnumMap, json['operation']),
      entityType: $enumDecode(_$EntityTypeEnumMap, json['entityType']),
      entityId: json['entityId'] as String,
      data: json['data'] as Map<String, dynamic>? ?? {},
      createdAt: DateTime.parse(json['createdAt'] as String),
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
      lastAttempt: json['lastAttempt'] == null
          ? null
          : DateTime.parse(json['lastAttempt'] as String),
      status: $enumDecode(_$SyncStatusEnumMap, json['status']),
      errorMessage: json['errorMessage'] as String?,
      priority: (json['priority'] as num?)?.toInt() ?? 0,
      userId: json['userId'] as String,
    );

Map<String, dynamic> _$SyncOperationToJson(SyncOperation instance) =>
    <String, dynamic>{
      'id': instance.id,
      'operation': _$SyncOperationTypeEnumMap[instance.operation]!,
      'entityType': _$EntityTypeEnumMap[instance.entityType]!,
      'entityId': instance.entityId,
      'data': instance.data,
      'createdAt': instance.createdAt.toIso8601String(),
      'attempts': instance.attempts,
      'lastAttempt': instance.lastAttempt?.toIso8601String(),
      'status': _$SyncStatusEnumMap[instance.status]!,
      'errorMessage': instance.errorMessage,
      'priority': instance.priority,
      'userId': instance.userId,
    };

const _$SyncOperationTypeEnumMap = {
  SyncOperationType.create: 'CREATE',
  SyncOperationType.update: 'UPDATE',
  SyncOperationType.delete: 'DELETE',
};

const _$EntityTypeEnumMap = {
  EntityType.card: 'CARD',
  EntityType.workspace: 'WORKSPACE',
  EntityType.canvas: 'CANVAS',
};

const _$SyncStatusEnumMap = {
  SyncStatus.pending: 'PENDING',
  SyncStatus.inProgress: 'IN_PROGRESS',
  SyncStatus.completed: 'COMPLETED',
  SyncStatus.failed: 'FAILED',
};

ConflictResolution _$ConflictResolutionFromJson(Map<String, dynamic> json) =>
    ConflictResolution(
      strategy: $enumDecode(_$ConflictStrategyEnumMap, json['strategy']),
      clientVersion: (json['clientVersion'] as num).toInt(),
      serverVersion: (json['serverVersion'] as num).toInt(),
      conflictedFields: (json['conflictedFields'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$ConflictResolutionToJson(ConflictResolution instance) =>
    <String, dynamic>{
      'strategy': _$ConflictStrategyEnumMap[instance.strategy]!,
      'clientVersion': instance.clientVersion,
      'serverVersion': instance.serverVersion,
      'conflictedFields': instance.conflictedFields,
    };

const _$ConflictStrategyEnumMap = {
  ConflictStrategy.clientWins: 'CLIENT_WINS',
  ConflictStrategy.serverWins: 'SERVER_WINS',
  ConflictStrategy.merge: 'MERGE',
  ConflictStrategy.manual: 'MANUAL',
};

CardConflict _$CardConflictFromJson(Map<String, dynamic> json) => CardConflict(
  cardId: json['cardId'] as String,
  clientData: json['clientData'] as Map<String, dynamic>? ?? {},
  serverData: json['serverData'] as Map<String, dynamic>? ?? {},
  resolution: json['resolution'] == null
      ? null
      : ConflictResolution.fromJson(json['resolution'] as Map<String, dynamic>),
);

Map<String, dynamic> _$CardConflictToJson(CardConflict instance) =>
    <String, dynamic>{
      'cardId': instance.cardId,
      'clientData': instance.clientData,
      'serverData': instance.serverData,
      'resolution': instance.resolution,
    };
