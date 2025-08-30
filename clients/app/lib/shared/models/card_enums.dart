import 'package:json_annotation/json_annotation.dart';

/// Card type enumeration - mirrors backend CardType
enum CardType {
  @JsonValue('text')
  text('text'),
  @JsonValue('image')
  image('image'),
  @JsonValue('link')
  link('link'),
  @JsonValue('code')
  code('code'),
  @JsonValue('file')
  file('file'),
  @JsonValue('drawing')
  drawing('drawing');

  const CardType(this.value);
  final String value;

  static CardType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'text':
        return CardType.text;
      case 'image':
        return CardType.image;
      case 'link':
        return CardType.link;
      case 'code':
        return CardType.code;
      case 'file':
        return CardType.file;
      case 'drawing':
        return CardType.drawing;
      default:
        throw ArgumentError('Invalid CardType: $value');
    }
  }
}

/// Card status enumeration - mirrors backend CardStatus
enum CardStatus {
  @JsonValue('draft')
  draft('draft'),
  @JsonValue('active')
  active('active'),
  @JsonValue('archived')
  archived('archived'),
  @JsonValue('deleted')
  deleted('deleted');

  const CardStatus(this.value);
  final String value;

  static CardStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'draft':
        return CardStatus.draft;
      case 'active':
        return CardStatus.active;
      case 'archived':
        return CardStatus.archived;
      case 'deleted':
        return CardStatus.deleted;
      default:
        throw ArgumentError('Invalid CardStatus: $value');
    }
  }
}

/// Card priority enumeration - mirrors backend CardPriority
enum CardPriority {
  @JsonValue('low')
  low('low'),
  @JsonValue('normal')
  normal('normal'),
  @JsonValue('high')
  high('high'),
  @JsonValue('urgent')
  urgent('urgent');

  const CardPriority(this.value);
  final String value;

  static CardPriority fromString(String value) {
    switch (value.toLowerCase()) {
      case 'low':
        return CardPriority.low;
      case 'normal':
        return CardPriority.normal;
      case 'high':
        return CardPriority.high;
      case 'urgent':
        return CardPriority.urgent;
      default:
        throw ArgumentError('Invalid CardPriority: $value');
    }
  }
}

/// Connection type enumeration - mirrors backend ConnectionType
enum ConnectionType {
  @JsonValue('manual')
  manual('manual'),
  @JsonValue('ai_suggested')
  aiSuggested('ai_suggested'),
  @JsonValue('ai_generated')
  aiGenerated('ai_generated'),
  @JsonValue('reference')
  reference('reference'),
  @JsonValue('dependency')
  dependency('dependency'),
  @JsonValue('similarity')
  similarity('similarity'),
  @JsonValue('related')
  related('related');

  const ConnectionType(this.value);
  final String value;

  static ConnectionType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'manual':
        return ConnectionType.manual;
      case 'ai_suggested':
        return ConnectionType.aiSuggested;
      case 'ai_generated':
        return ConnectionType.aiGenerated;
      case 'reference':
        return ConnectionType.reference;
      case 'dependency':
        return ConnectionType.dependency;
      case 'similarity':
        return ConnectionType.similarity;
      case 'related':
        return ConnectionType.related;
      default:
        throw ArgumentError('Invalid ConnectionType: $value');
    }
  }
}

/// Sentiment type enumeration - mirrors backend SentimentType
enum SentimentType {
  @JsonValue('positive')
  positive('positive'),
  @JsonValue('negative')
  negative('negative'),
  @JsonValue('neutral')
  neutral('neutral');

  const SentimentType(this.value);
  final String value;

  static SentimentType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'positive':
        return SentimentType.positive;
      case 'negative':
        return SentimentType.negative;
      case 'neutral':
        return SentimentType.neutral;
      default:
        throw ArgumentError('Invalid SentimentType: $value');
    }
  }
}

/// Conflict resolution strategy enumeration - mirrors backend ConflictStrategy
enum ConflictStrategy {
  @JsonValue('CLIENT_WINS')
  clientWins('CLIENT_WINS'),
  @JsonValue('SERVER_WINS')
  serverWins('SERVER_WINS'),
  @JsonValue('MERGE')
  merge('MERGE'),
  @JsonValue('MANUAL')
  manual('MANUAL');

  const ConflictStrategy(this.value);
  final String value;

  static ConflictStrategy fromString(String value) {
    switch (value.toUpperCase()) {
      case 'CLIENT_WINS':
        return ConflictStrategy.clientWins;
      case 'SERVER_WINS':
        return ConflictStrategy.serverWins;
      case 'MERGE':
        return ConflictStrategy.merge;
      case 'MANUAL':
        return ConflictStrategy.manual;
      default:
        throw ArgumentError('Invalid ConflictStrategy: $value');
    }
  }
}

/// Sync operation enumeration
enum SyncOperationType {
  @JsonValue('CREATE')
  create('CREATE'),
  @JsonValue('UPDATE')
  update('UPDATE'),
  @JsonValue('DELETE')
  delete('DELETE');

  const SyncOperationType(this.value);
  final String value;

  static SyncOperationType fromString(String value) {
    switch (value.toUpperCase()) {
      case 'CREATE':
        return SyncOperationType.create;
      case 'UPDATE':
        return SyncOperationType.update;
      case 'DELETE':
        return SyncOperationType.delete;
      default:
        throw ArgumentError('Invalid SyncOperationType: $value');
    }
  }
}

/// Sync status enumeration
enum SyncStatus {
  @JsonValue('PENDING')
  pending('PENDING'),
  @JsonValue('IN_PROGRESS')
  inProgress('IN_PROGRESS'),
  @JsonValue('COMPLETED')
  completed('COMPLETED'),
  @JsonValue('FAILED')
  failed('FAILED');

  const SyncStatus(this.value);
  final String value;

  static SyncStatus fromString(String value) {
    switch (value.toUpperCase()) {
      case 'PENDING':
        return SyncStatus.pending;
      case 'IN_PROGRESS':
        return SyncStatus.inProgress;
      case 'COMPLETED':
        return SyncStatus.completed;
      case 'FAILED':
        return SyncStatus.failed;
      default:
        throw ArgumentError('Invalid SyncStatus: $value');
    }
  }
}

/// Entity type enumeration for sync operations
enum EntityType {
  @JsonValue('CARD')
  card('CARD'),
  @JsonValue('WORKSPACE')
  workspace('WORKSPACE'),
  @JsonValue('CANVAS')
  canvas('CANVAS');

  const EntityType(this.value);
  final String value;

  static EntityType fromString(String value) {
    switch (value.toUpperCase()) {
      case 'CARD':
        return EntityType.card;
      case 'WORKSPACE':
        return EntityType.workspace;
      case 'CANVAS':
        return EntityType.canvas;
      default:
        throw ArgumentError('Invalid EntityType: $value');
    }
  }
}