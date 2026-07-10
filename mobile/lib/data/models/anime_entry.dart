import 'collection_status.dart';

class AnimeEntry {
  const AnimeEntry({
    required this.id,
    required this.title,
    required this.status,
    required this.score,
    required this.progress,
    required this.totalEpisodes,
    required this.year,
    required this.format,
    required this.genre,
    this.coverImageUrl,
  });

  final int id;
  final String title;
  final String status;
  CollectionStatus get collectionStatus => CollectionStatus.fromApiValue(status);
  final double score;
  final int progress;
  final int totalEpisodes;
  final int year;
  final String format;
  final String genre;
  final String? coverImageUrl;

  factory AnimeEntry.fromJson(Map<String, dynamic> json) {
    final anime = json['anime'] is Map<String, dynamic>
        ? json['anime'] as Map<String, dynamic>
        : json;
    final rawScore = json['score'] ?? anime['score'] ?? anime['averageScore'];
    final parsedScore = _readDouble(rawScore);

    return AnimeEntry(
      id: (anime['id'] as num?)?.toInt() ?? 0,
      title: _readTitle(anime['title']),
      status: json['status']?.toString() ?? 'planned',
      score: parsedScore > 10 ? parsedScore / 10 : parsedScore,
      progress: (json['progress'] as num?)?.toInt() ?? 0,
      totalEpisodes: (anime['episodes'] as num?)?.toInt() ?? 12,
      year: (anime['seasonYear'] as num?)?.toInt() ?? 0,
      format: anime['format']?.toString() ?? 'TV',
      genre: _readGenre(anime),
      coverImageUrl: _readImageUrl(anime),
    );
  }

  static String _readTitle(Object? value) {
    if (value is String && value.isNotEmpty) {
      return value;
    }
    if (value is Map<String, dynamic>) {
      return value['ko']?.toString() ??
          value['romaji']?.toString() ??
          value['english']?.toString() ??
          value['native']?.toString() ??
          'Untitled';
    }
    return 'Untitled';
  }

  static String _readGenre(Map<String, dynamic> anime) {
    final genre = anime['genre'];
    if (genre is String && genre.isNotEmpty) {
      return genre;
    }

    final genres = anime['genres'];
    if (genres is List && genres.isNotEmpty) {
      return genres.first.toString();
    }

    return 'Drama';
  }

  static double _readDouble(Object? value) {
    if (value is num) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value) ?? 0;
    }
    return 0;
  }

  static String? _readImageUrl(Map<String, dynamic> anime) {
    final direct = anime['coverImageLarge'] ??
        anime['coverImageExtraLarge'] ??
        anime['coverImageMedium'] ??
        anime['bannerImage'];
    if (direct != null) {
      return direct.toString();
    }

    final image = anime['image'];
    if (image is Map<String, dynamic>) {
      return image['large']?.toString() ?? image['medium']?.toString();
    }

    final coverImage = anime['coverImage'];
    if (coverImage is Map<String, dynamic>) {
      return coverImage['extraLarge']?.toString() ??
          coverImage['large']?.toString() ??
          coverImage['medium']?.toString();
    }

    return null;
  }
}
