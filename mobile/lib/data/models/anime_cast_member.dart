class AnimeCastMember {
  const AnimeCastMember({
    required this.characterName,
    required this.voiceActorName,
    this.role,
    this.characterImageUrl,
    this.voiceActorImageUrl,
  });

  final String characterName;
  final String voiceActorName;
  final String? role;
  final String? characterImageUrl;
  final String? voiceActorImageUrl;

  factory AnimeCastMember.fromJson(Map<String, dynamic> json) {
    final character = _readMap(json['character']);
    final voiceActor = _readMap(
      json['voiceActor'] ?? json['staff'] ?? json['person'],
    );

    return AnimeCastMember(
      characterName: _readName(
        json['characterName'] ?? character?['name'],
        fallback: 'Unknown character',
      ),
      voiceActorName: _readName(
        json['voiceActorName'] ??
            json['staffName'] ??
            voiceActor?['name'] ??
            voiceActor?['nativeName'],
        fallback: 'Unknown voice actor',
      ),
      role: (json['role'] ?? json['characterRole'])?.toString(),
      characterImageUrl: _readImageUrl(character),
      voiceActorImageUrl: _readImageUrl(voiceActor),
    );
  }

  static Map<String, dynamic>? _readMap(Object? value) {
    return value is Map<String, dynamic> ? value : null;
  }

  static String _readName(Object? value, {required String fallback}) {
    if (value is String && value.isNotEmpty) {
      return value;
    }
    if (value is Map<String, dynamic>) {
      return value['full']?.toString() ??
          value['native']?.toString() ??
          value['userPreferred']?.toString() ??
          fallback;
    }
    return fallback;
  }

  static String? _readImageUrl(Map<String, dynamic>? source) {
    if (source == null) {
      return null;
    }

    final image = source['image'];
    if (image is Map<String, dynamic>) {
      return image['large']?.toString() ?? image['medium']?.toString();
    }

    return source['imageUrl']?.toString() ??
        source['coverImageLarge']?.toString() ??
        source['photoUrl']?.toString();
  }
}
