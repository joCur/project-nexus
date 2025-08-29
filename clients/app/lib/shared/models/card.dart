import 'dart:convert';
import 'package:json_annotation/json_annotation.dart';
import 'card_enums.dart';

part 'card.g.dart';

/// Card position model - mirrors backend CardPosition
@JsonSerializable()
class CardPosition {
  final double x;
  final double y;
  final double z;

  const CardPosition({
    required this.x,
    required this.y,
    required this.z,
  });

  factory CardPosition.fromJson(Map<String, dynamic> json) =>
      _$CardPositionFromJson(json);

  Map<String, dynamic> toJson() => _$CardPositionToJson(this);

  CardPosition copyWith({
    double? x,
    double? y,
    double? z,
  }) {
    return CardPosition(
      x: x ?? this.x,
      y: y ?? this.y,
      z: z ?? this.z,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CardPosition &&
          runtimeType == other.runtimeType &&
          x == other.x &&
          y == other.y &&
          z == other.z;

  @override
  int get hashCode => x.hashCode ^ y.hashCode ^ z.hashCode;
}

/// Card dimensions model - mirrors backend CardDimensions
@JsonSerializable()
class CardDimensions {
  final double width;
  final double height;

  const CardDimensions({
    required this.width,
    required this.height,
  });

  factory CardDimensions.fromJson(Map<String, dynamic> json) =>
      _$CardDimensionsFromJson(json);

  Map<String, dynamic> toJson() => _$CardDimensionsToJson(this);

  CardDimensions copyWith({
    double? width,
    double? height,
  }) {
    return CardDimensions(
      width: width ?? this.width,
      height: height ?? this.height,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CardDimensions &&
          runtimeType == other.runtimeType &&
          width == other.width &&
          height == other.height;

  @override
  int get hashCode => width.hashCode ^ height.hashCode;
}

/// Shadow configuration for card style
@JsonSerializable()
class ShadowConfig {
  final String color;
  final double offsetX;
  final double offsetY;
  final double blur;
  final double spread;

  const ShadowConfig({
    required this.color,
    required this.offsetX,
    required this.offsetY,
    required this.blur,
    required this.spread,
  });

  factory ShadowConfig.fromJson(Map<String, dynamic> json) =>
      _$ShadowConfigFromJson(json);

  Map<String, dynamic> toJson() => _$ShadowConfigToJson(this);

  ShadowConfig copyWith({
    String? color,
    double? offsetX,
    double? offsetY,
    double? blur,
    double? spread,
  }) {
    return ShadowConfig(
      color: color ?? this.color,
      offsetX: offsetX ?? this.offsetX,
      offsetY: offsetY ?? this.offsetY,
      blur: blur ?? this.blur,
      spread: spread ?? this.spread,
    );
  }
}

/// Card style model - mirrors backend CardStyle
@JsonSerializable()
class CardStyle {
  final String backgroundColor;
  final String borderColor;
  final String textColor;
  final double borderWidth;
  final double borderRadius;
  final double opacity;
  final bool shadow;
  final ShadowConfig? shadowConfig;

  const CardStyle({
    required this.backgroundColor,
    required this.borderColor,
    required this.textColor,
    required this.borderWidth,
    required this.borderRadius,
    required this.opacity,
    required this.shadow,
    this.shadowConfig,
  });

  factory CardStyle.fromJson(Map<String, dynamic> json) =>
      _$CardStyleFromJson(json);

  Map<String, dynamic> toJson() => _$CardStyleToJson(this);

  /// Default card style matching backend DEFAULT_CARD_STYLE
  static const CardStyle defaultStyle = CardStyle(
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    textColor: '#1F2937',
    borderWidth: 1.0,
    borderRadius: 8.0,
    opacity: 1.0,
    shadow: true,
    shadowConfig: ShadowConfig(
      color: '#00000015',
      offsetX: 0.0,
      offsetY: 2.0,
      blur: 8.0,
      spread: 0.0,
    ),
  );

  CardStyle copyWith({
    String? backgroundColor,
    String? borderColor,
    String? textColor,
    double? borderWidth,
    double? borderRadius,
    double? opacity,
    bool? shadow,
    ShadowConfig? shadowConfig,
  }) {
    return CardStyle(
      backgroundColor: backgroundColor ?? this.backgroundColor,
      borderColor: borderColor ?? this.borderColor,
      textColor: textColor ?? this.textColor,
      borderWidth: borderWidth ?? this.borderWidth,
      borderRadius: borderRadius ?? this.borderRadius,
      opacity: opacity ?? this.opacity,
      shadow: shadow ?? this.shadow,
      shadowConfig: shadowConfig ?? this.shadowConfig,
    );
  }
}

/// Card animation model - mirrors backend CardAnimation
@JsonSerializable()
class CardAnimation {
  final bool isAnimating;
  final String? type; // 'move', 'resize', 'fade', 'scale', 'rotate'
  final int? duration;
  final String? easing; // 'linear', 'easeIn', 'easeOut', 'easeInOut'
  final int? startTime;

  const CardAnimation({
    required this.isAnimating,
    this.type,
    this.duration,
    this.easing,
    this.startTime,
  });

  factory CardAnimation.fromJson(Map<String, dynamic> json) =>
      _$CardAnimationFromJson(json);

  Map<String, dynamic> toJson() => _$CardAnimationToJson(this);

  static const CardAnimation none = CardAnimation(isAnimating: false);

  CardAnimation copyWith({
    bool? isAnimating,
    String? type,
    int? duration,
    String? easing,
    int? startTime,
  }) {
    return CardAnimation(
      isAnimating: isAnimating ?? this.isAnimating,
      type: type ?? this.type,
      duration: duration ?? this.duration,
      easing: easing ?? this.easing,
      startTime: startTime ?? this.startTime,
    );
  }
}

/// Card analysis result model - mirrors backend CardAnalysisResult
@JsonSerializable()
class CardAnalysisResult {
  final List<String> extractedEntities;
  final List<String> suggestedTags;
  final String? contentSummary;
  final String? languageDetected;
  final SentimentType? sentiment;
  final List<String> topics;
  final DateTime lastAnalyzed;

  const CardAnalysisResult({
    required this.extractedEntities,
    required this.suggestedTags,
    this.contentSummary,
    this.languageDetected,
    this.sentiment,
    required this.topics,
    required this.lastAnalyzed,
  });

  factory CardAnalysisResult.fromJson(Map<String, dynamic> json) =>
      _$CardAnalysisResultFromJson(json);

  Map<String, dynamic> toJson() => _$CardAnalysisResultToJson(this);

  CardAnalysisResult copyWith({
    List<String>? extractedEntities,
    List<String>? suggestedTags,
    String? contentSummary,
    String? languageDetected,
    SentimentType? sentiment,
    List<String>? topics,
    DateTime? lastAnalyzed,
  }) {
    return CardAnalysisResult(
      extractedEntities: extractedEntities ?? this.extractedEntities,
      suggestedTags: suggestedTags ?? this.suggestedTags,
      contentSummary: contentSummary ?? this.contentSummary,
      languageDetected: languageDetected ?? this.languageDetected,
      sentiment: sentiment ?? this.sentiment,
      topics: topics ?? this.topics,
      lastAnalyzed: lastAnalyzed ?? this.lastAnalyzed,
    );
  }
}

/// Main Card model - mirrors backend Card interface
@JsonSerializable()
class Card {
  final String id;
  final String workspaceId;
  final String? canvasId;
  final CardType type;
  final String? title;
  final String content;
  final CardPosition position;
  final CardDimensions dimensions;
  @JsonKey(defaultValue: <String, dynamic>{})
  final Map<String, dynamic> metadata;
  final CardStatus status;
  final CardPriority priority;
  final CardStyle style;
  final int version;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String createdBy;
  final String lastModifiedBy;
  @JsonKey(defaultValue: <String>[])
  final List<String> tags;
  final DateTime? lastSavedAt;
  @JsonKey(defaultValue: false)
  final bool isDirty;
  @JsonKey(defaultValue: false)
  final bool isLocked;
  @JsonKey(defaultValue: false)
  final bool isHidden;
  @JsonKey(defaultValue: false)
  final bool isMinimized;
  @JsonKey(defaultValue: false)
  final bool isSelected;
  @JsonKey(defaultValue: 0.0)
  final double rotation;
  final CardAnimation animation;
  final List<double>? embeddings;
  final CardAnalysisResult? analysisResults;
  final String? contentHash;
  @JsonKey(defaultValue: false)
  final bool isEncrypted;
  final String? encryptionKey;

  const Card({
    required this.id,
    required this.workspaceId,
    this.canvasId,
    required this.type,
    this.title,
    required this.content,
    required this.position,
    required this.dimensions,
    this.metadata = const <String, dynamic>{},
    required this.status,
    required this.priority,
    required this.style,
    required this.version,
    required this.createdAt,
    required this.updatedAt,
    required this.createdBy,
    required this.lastModifiedBy,
    this.tags = const <String>[],
    this.lastSavedAt,
    this.isDirty = false,
    this.isLocked = false,
    this.isHidden = false,
    this.isMinimized = false,
    this.isSelected = false,
    this.rotation = 0.0,
    this.animation = CardAnimation.none,
    this.embeddings,
    this.analysisResults,
    this.contentHash,
    this.isEncrypted = false,
    this.encryptionKey,
  });

  factory Card.fromJson(Map<String, dynamic> json) => _$CardFromJson(json);

  Map<String, dynamic> toJson() => _$CardToJson(this);

  /// Create a new card with default values
  factory Card.create({
    required String id,
    required String workspaceId,
    String? canvasId,
    required CardType type,
    String? title,
    required String content,
    required CardPosition position,
    required CardDimensions dimensions,
    Map<String, dynamic>? metadata,
    CardStatus status = CardStatus.draft,
    CardPriority priority = CardPriority.normal,
    CardStyle style = CardStyle.defaultStyle,
    required String createdBy,
    List<String>? tags,
  }) {
    final now = DateTime.now();
    return Card(
      id: id,
      workspaceId: workspaceId,
      canvasId: canvasId,
      type: type,
      title: title,
      content: content,
      position: position,
      dimensions: dimensions,
      metadata: metadata ?? <String, dynamic>{},
      status: status,
      priority: priority,
      style: style,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy,
      lastModifiedBy: createdBy,
      tags: tags ?? <String>[],
      animation: CardAnimation.none,
    );
  }

  Card copyWith({
    String? id,
    String? workspaceId,
    String? canvasId,
    CardType? type,
    String? title,
    String? content,
    CardPosition? position,
    CardDimensions? dimensions,
    Map<String, dynamic>? metadata,
    CardStatus? status,
    CardPriority? priority,
    CardStyle? style,
    int? version,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? createdBy,
    String? lastModifiedBy,
    List<String>? tags,
    DateTime? lastSavedAt,
    bool? isDirty,
    bool? isLocked,
    bool? isHidden,
    bool? isMinimized,
    bool? isSelected,
    double? rotation,
    CardAnimation? animation,
    List<double>? embeddings,
    CardAnalysisResult? analysisResults,
    String? contentHash,
    bool? isEncrypted,
    String? encryptionKey,
  }) {
    return Card(
      id: id ?? this.id,
      workspaceId: workspaceId ?? this.workspaceId,
      canvasId: canvasId ?? this.canvasId,
      type: type ?? this.type,
      title: title ?? this.title,
      content: content ?? this.content,
      position: position ?? this.position,
      dimensions: dimensions ?? this.dimensions,
      metadata: metadata ?? this.metadata,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      style: style ?? this.style,
      version: version ?? this.version,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      createdBy: createdBy ?? this.createdBy,
      lastModifiedBy: lastModifiedBy ?? this.lastModifiedBy,
      tags: tags ?? this.tags,
      lastSavedAt: lastSavedAt ?? this.lastSavedAt,
      isDirty: isDirty ?? this.isDirty,
      isLocked: isLocked ?? this.isLocked,
      isHidden: isHidden ?? this.isHidden,
      isMinimized: isMinimized ?? this.isMinimized,
      isSelected: isSelected ?? this.isSelected,
      rotation: rotation ?? this.rotation,
      animation: animation ?? this.animation,
      embeddings: embeddings ?? this.embeddings,
      analysisResults: analysisResults ?? this.analysisResults,
      contentHash: contentHash ?? this.contentHash,
      isEncrypted: isEncrypted ?? this.isEncrypted,
      encryptionKey: encryptionKey ?? this.encryptionKey,
    );
  }

  /// Mark card as dirty with updated timestamp
  Card markDirty({required String lastModifiedBy}) {
    return copyWith(
      isDirty: true,
      updatedAt: DateTime.now(),
      lastModifiedBy: lastModifiedBy,
    );
  }

  /// Mark card as clean (saved)
  Card markClean() {
    return copyWith(
      isDirty: false,
      lastSavedAt: DateTime.now(),
    );
  }

  /// Convert to database map for storage
  Map<String, dynamic> toDbMap() {
    return {
      'id': id,
      'workspace_id': workspaceId,
      'canvas_id': canvasId,
      'type': type.value,
      'title': title,
      'content': content,
      'position_x': position.x,
      'position_y': position.y,
      'position_z': position.z,
      'width': dimensions.width,
      'height': dimensions.height,
      'rotation': rotation,
      'metadata': jsonEncode(metadata),
      'style': jsonEncode(style.toJson()),
      'animation': jsonEncode(animation.toJson()),
      'status': status.value,
      'priority': priority.value,
      'version': version,
      'created_at': createdAt.millisecondsSinceEpoch,
      'updated_at': updatedAt.millisecondsSinceEpoch,
      'created_by': createdBy,
      'last_modified_by': lastModifiedBy,
      'tags': jsonEncode(tags),
      'last_saved_at': lastSavedAt?.millisecondsSinceEpoch,
      'is_dirty': isDirty ? 1 : 0,
      'is_locked': isLocked ? 1 : 0,
      'is_hidden': isHidden ? 1 : 0,
      'is_minimized': isMinimized ? 1 : 0,
      'is_selected': isSelected ? 1 : 0,
      'embeddings': embeddings != null ? jsonEncode(embeddings) : null,
      'analysis_results': analysisResults != null ? jsonEncode(analysisResults!.toJson()) : null,
      'content_hash': contentHash,
      'is_encrypted': isEncrypted ? 1 : 0,
      'encryption_key': encryptionKey,
    };
  }

  /// Create Card from database map
  factory Card.fromDbMap(Map<String, dynamic> map) {
    return Card(
      id: map['id'],
      workspaceId: map['workspace_id'],
      canvasId: map['canvas_id'],
      type: CardType.fromString(map['type']),
      title: map['title'],
      content: map['content'],
      position: CardPosition(
        x: map['position_x'],
        y: map['position_y'],
        z: map['position_z'],
      ),
      dimensions: CardDimensions(
        width: map['width'],
        height: map['height'],
      ),
      rotation: map['rotation'] ?? 0.0,
      metadata: map['metadata'] != null 
          ? jsonDecode(map['metadata']) as Map<String, dynamic>
          : <String, dynamic>{},
      style: map['style'] != null 
          ? CardStyle.fromJson(jsonDecode(map['style']))
          : CardStyle.defaultStyle,
      animation: map['animation'] != null
          ? CardAnimation.fromJson(jsonDecode(map['animation']))
          : CardAnimation.none,
      status: CardStatus.fromString(map['status']),
      priority: CardPriority.fromString(map['priority']),
      version: map['version'],
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['created_at']),
      updatedAt: DateTime.fromMillisecondsSinceEpoch(map['updated_at']),
      createdBy: map['created_by'],
      lastModifiedBy: map['last_modified_by'],
      tags: map['tags'] != null 
          ? List<String>.from(jsonDecode(map['tags']))
          : <String>[],
      lastSavedAt: map['last_saved_at'] != null 
          ? DateTime.fromMillisecondsSinceEpoch(map['last_saved_at'])
          : null,
      isDirty: (map['is_dirty'] ?? 0) == 1,
      isLocked: (map['is_locked'] ?? 0) == 1,
      isHidden: (map['is_hidden'] ?? 0) == 1,
      isMinimized: (map['is_minimized'] ?? 0) == 1,
      isSelected: (map['is_selected'] ?? 0) == 1,
      embeddings: map['embeddings'] != null 
          ? List<double>.from(jsonDecode(map['embeddings']))
          : null,
      analysisResults: map['analysis_results'] != null
          ? CardAnalysisResult.fromJson(jsonDecode(map['analysis_results']))
          : null,
      contentHash: map['content_hash'],
      isEncrypted: (map['is_encrypted'] ?? 0) == 1,
      encryptionKey: map['encryption_key'],
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Card &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          version == other.version;

  @override
  int get hashCode => id.hashCode ^ version.hashCode;
}