// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'card.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CardPosition _$CardPositionFromJson(Map<String, dynamic> json) => CardPosition(
  x: (json['x'] as num).toDouble(),
  y: (json['y'] as num).toDouble(),
  z: (json['z'] as num).toDouble(),
);

Map<String, dynamic> _$CardPositionToJson(CardPosition instance) =>
    <String, dynamic>{'x': instance.x, 'y': instance.y, 'z': instance.z};

CardDimensions _$CardDimensionsFromJson(Map<String, dynamic> json) =>
    CardDimensions(
      width: (json['width'] as num).toDouble(),
      height: (json['height'] as num).toDouble(),
    );

Map<String, dynamic> _$CardDimensionsToJson(CardDimensions instance) =>
    <String, dynamic>{'width': instance.width, 'height': instance.height};

ShadowConfig _$ShadowConfigFromJson(Map<String, dynamic> json) => ShadowConfig(
  color: json['color'] as String,
  offsetX: (json['offsetX'] as num).toDouble(),
  offsetY: (json['offsetY'] as num).toDouble(),
  blur: (json['blur'] as num).toDouble(),
  spread: (json['spread'] as num).toDouble(),
);

Map<String, dynamic> _$ShadowConfigToJson(ShadowConfig instance) =>
    <String, dynamic>{
      'color': instance.color,
      'offsetX': instance.offsetX,
      'offsetY': instance.offsetY,
      'blur': instance.blur,
      'spread': instance.spread,
    };

CardStyle _$CardStyleFromJson(Map<String, dynamic> json) => CardStyle(
  backgroundColor: json['backgroundColor'] as String,
  borderColor: json['borderColor'] as String,
  textColor: json['textColor'] as String,
  borderWidth: (json['borderWidth'] as num).toDouble(),
  borderRadius: (json['borderRadius'] as num).toDouble(),
  opacity: (json['opacity'] as num).toDouble(),
  shadow: json['shadow'] as bool,
  shadowConfig: json['shadowConfig'] == null
      ? null
      : ShadowConfig.fromJson(json['shadowConfig'] as Map<String, dynamic>),
);

Map<String, dynamic> _$CardStyleToJson(CardStyle instance) => <String, dynamic>{
  'backgroundColor': instance.backgroundColor,
  'borderColor': instance.borderColor,
  'textColor': instance.textColor,
  'borderWidth': instance.borderWidth,
  'borderRadius': instance.borderRadius,
  'opacity': instance.opacity,
  'shadow': instance.shadow,
  'shadowConfig': instance.shadowConfig,
};

CardAnimation _$CardAnimationFromJson(Map<String, dynamic> json) =>
    CardAnimation(
      isAnimating: json['isAnimating'] as bool,
      type: json['type'] as String?,
      duration: (json['duration'] as num?)?.toInt(),
      easing: json['easing'] as String?,
      startTime: (json['startTime'] as num?)?.toInt(),
    );

Map<String, dynamic> _$CardAnimationToJson(CardAnimation instance) =>
    <String, dynamic>{
      'isAnimating': instance.isAnimating,
      'type': instance.type,
      'duration': instance.duration,
      'easing': instance.easing,
      'startTime': instance.startTime,
    };

CardAnalysisResult _$CardAnalysisResultFromJson(Map<String, dynamic> json) =>
    CardAnalysisResult(
      extractedEntities: (json['extractedEntities'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      suggestedTags: (json['suggestedTags'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      contentSummary: json['contentSummary'] as String?,
      languageDetected: json['languageDetected'] as String?,
      sentiment: $enumDecodeNullable(_$SentimentTypeEnumMap, json['sentiment']),
      topics: (json['topics'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      lastAnalyzed: DateTime.parse(json['lastAnalyzed'] as String),
    );

Map<String, dynamic> _$CardAnalysisResultToJson(CardAnalysisResult instance) =>
    <String, dynamic>{
      'extractedEntities': instance.extractedEntities,
      'suggestedTags': instance.suggestedTags,
      'contentSummary': instance.contentSummary,
      'languageDetected': instance.languageDetected,
      'sentiment': _$SentimentTypeEnumMap[instance.sentiment],
      'topics': instance.topics,
      'lastAnalyzed': instance.lastAnalyzed.toIso8601String(),
    };

const _$SentimentTypeEnumMap = {
  SentimentType.positive: 'positive',
  SentimentType.negative: 'negative',
  SentimentType.neutral: 'neutral',
};

Card _$CardFromJson(Map<String, dynamic> json) => Card(
  id: json['id'] as String,
  workspaceId: json['workspaceId'] as String,
  canvasId: json['canvasId'] as String?,
  type: $enumDecode(_$CardTypeEnumMap, json['type']),
  title: json['title'] as String?,
  content: json['content'] as String,
  position: CardPosition.fromJson(json['position'] as Map<String, dynamic>),
  dimensions: CardDimensions.fromJson(
    json['dimensions'] as Map<String, dynamic>,
  ),
  metadata: json['metadata'] as Map<String, dynamic>? ?? {},
  status: $enumDecode(_$CardStatusEnumMap, json['status']),
  priority: $enumDecode(_$CardPriorityEnumMap, json['priority']),
  style: CardStyle.fromJson(json['style'] as Map<String, dynamic>),
  version: (json['version'] as num).toInt(),
  createdAt: DateTime.parse(json['createdAt'] as String),
  updatedAt: DateTime.parse(json['updatedAt'] as String),
  createdBy: json['createdBy'] as String,
  lastModifiedBy: json['lastModifiedBy'] as String,
  tags:
      (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ?? [],
  lastSavedAt: json['lastSavedAt'] == null
      ? null
      : DateTime.parse(json['lastSavedAt'] as String),
  isDirty: json['isDirty'] as bool? ?? false,
  isLocked: json['isLocked'] as bool? ?? false,
  isHidden: json['isHidden'] as bool? ?? false,
  isMinimized: json['isMinimized'] as bool? ?? false,
  isSelected: json['isSelected'] as bool? ?? false,
  rotation: (json['rotation'] as num?)?.toDouble() ?? 0.0,
  animation: json['animation'] == null
      ? CardAnimation.none
      : CardAnimation.fromJson(json['animation'] as Map<String, dynamic>),
  embeddings: (json['embeddings'] as List<dynamic>?)
      ?.map((e) => (e as num).toDouble())
      .toList(),
  analysisResults: json['analysisResults'] == null
      ? null
      : CardAnalysisResult.fromJson(
          json['analysisResults'] as Map<String, dynamic>,
        ),
  contentHash: json['contentHash'] as String?,
  isEncrypted: json['isEncrypted'] as bool? ?? false,
);

Map<String, dynamic> _$CardToJson(Card instance) => <String, dynamic>{
  'id': instance.id,
  'workspaceId': instance.workspaceId,
  'canvasId': instance.canvasId,
  'type': _$CardTypeEnumMap[instance.type]!,
  'title': instance.title,
  'content': instance.content,
  'position': instance.position,
  'dimensions': instance.dimensions,
  'metadata': instance.metadata,
  'status': _$CardStatusEnumMap[instance.status]!,
  'priority': _$CardPriorityEnumMap[instance.priority]!,
  'style': instance.style,
  'version': instance.version,
  'createdAt': instance.createdAt.toIso8601String(),
  'updatedAt': instance.updatedAt.toIso8601String(),
  'createdBy': instance.createdBy,
  'lastModifiedBy': instance.lastModifiedBy,
  'tags': instance.tags,
  'lastSavedAt': instance.lastSavedAt?.toIso8601String(),
  'isDirty': instance.isDirty,
  'isLocked': instance.isLocked,
  'isHidden': instance.isHidden,
  'isMinimized': instance.isMinimized,
  'isSelected': instance.isSelected,
  'rotation': instance.rotation,
  'animation': instance.animation,
  'embeddings': instance.embeddings,
  'analysisResults': instance.analysisResults,
  'contentHash': instance.contentHash,
  'isEncrypted': instance.isEncrypted,
};

const _$CardTypeEnumMap = {
  CardType.text: 'text',
  CardType.image: 'image',
  CardType.link: 'link',
  CardType.code: 'code',
  CardType.file: 'file',
  CardType.drawing: 'drawing',
};

const _$CardStatusEnumMap = {
  CardStatus.draft: 'draft',
  CardStatus.active: 'active',
  CardStatus.archived: 'archived',
  CardStatus.deleted: 'deleted',
};

const _$CardPriorityEnumMap = {
  CardPriority.low: 'low',
  CardPriority.normal: 'normal',
  CardPriority.high: 'high',
  CardPriority.urgent: 'urgent',
};
