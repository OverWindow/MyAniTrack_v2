import 'anime_entry.dart';

class AnimeSearchResult {
  const AnimeSearchResult({
    required this.anime,
    this.myCollection,
  });

  final AnimeEntry anime;
  final MyCollectionStatus? myCollection;

  factory AnimeSearchResult.fromJson(Map<String, dynamic> json) {
    final collection = json['myCollection'];

    return AnimeSearchResult(
      anime: AnimeEntry.fromJson(json),
      myCollection: collection is Map<String, dynamic>
          ? MyCollectionStatus.fromJson(collection)
          : null,
    );
  }
}

class MyCollectionStatus {
  const MyCollectionStatus({
    required this.exists,
    this.status,
    this.score,
    this.progress,
  });

  final bool exists;
  final String? status;
  final double? score;
  final int? progress;

  factory MyCollectionStatus.fromJson(Map<String, dynamic> json) {
    return MyCollectionStatus(
      exists: json['exists'] == true,
      status: json['status']?.toString(),
      score: (json['score'] as num?)?.toDouble(),
      progress: (json['progress'] as num?)?.toInt(),
    );
  }
}
