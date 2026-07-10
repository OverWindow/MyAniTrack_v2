import 'anime_entry.dart';
import 'collection_status.dart';

class StatsOverview {
  const StatsOverview({
    required this.totalCount,
    required this.completedCount,
    required this.watchingCount,
    required this.totalWatchedEpisodes,
    required this.avgScore,
    required this.favoriteGenre,
  });

  final int totalCount;
  final int completedCount;
  final int watchingCount;
  final int totalWatchedEpisodes;
  final double avgScore;
  final String favoriteGenre;

  factory StatsOverview.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final root = data is Map<String, dynamic> ? data : json;
    final stats = root['stats'];
    final source = stats is Map<String, dynamic> ? stats : root;

    return StatsOverview(
      totalCount: (source['totalCount'] as num?)?.toInt() ?? 0,
      completedCount: (source['completedCount'] as num?)?.toInt() ?? 0,
      watchingCount: (source['watchingCount'] as num?)?.toInt() ?? 0,
      totalWatchedEpisodes:
          (source['totalWatchedEpisodes'] as num?)?.toInt() ?? 0,
      avgScore: (source['avgScore'] as num?)?.toDouble() ?? 0,
      favoriteGenre: source['favoriteGenre']?.toString() ?? '-',
    );
  }

  factory StatsOverview.fromEntries(List<AnimeEntry> entries) {
    if (entries.isEmpty) {
      return const StatsOverview(
        totalCount: 0,
        completedCount: 0,
        watchingCount: 0,
        totalWatchedEpisodes: 0,
        avgScore: 0,
        favoriteGenre: '-',
      );
    }

    final genreCounts = <String, int>{};
    var totalScore = 0.0;
    var totalEpisodes = 0;
    var completed = 0;
    var watching = 0;

    for (final entry in entries) {
      totalScore += entry.score;
      totalEpisodes += entry.progress;
      genreCounts.update(entry.genre, (value) => value + 1, ifAbsent: () => 1);
      if (entry.collectionStatus == CollectionStatus.completed) {
        completed += 1;
      }
      if (entry.collectionStatus == CollectionStatus.watching) {
        watching += 1;
      }
    }

    final favoriteGenre = genreCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return StatsOverview(
      totalCount: entries.length,
      completedCount: completed,
      watchingCount: watching,
      totalWatchedEpisodes: totalEpisodes,
      avgScore: totalScore / entries.length,
      favoriteGenre: favoriteGenre.isEmpty ? '-' : favoriteGenre.first.key,
    );
  }
}
