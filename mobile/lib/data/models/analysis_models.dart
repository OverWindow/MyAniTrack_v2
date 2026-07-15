import 'anime_entry.dart';
import 'stats_overview.dart';

class AnalysisData {
  const AnalysisData({
    required this.overview,
    required this.genres,
    required this.formats,
    required this.yearlyScores,
    required this.studios,
    required this.voiceActors,
  });

  final StatsOverview overview;
  final List<GenreStatItem> genres;
  final List<FormatStatItem> formats;
  final List<YearlyScoreItem> yearlyScores;
  final List<RankingItem> studios;
  final List<RankingItem> voiceActors;

  factory AnalysisData.empty() {
    return const AnalysisData(
      overview: StatsOverview(
        totalCount: 0,
        completedCount: 0,
        watchingCount: 0,
        totalWatchedEpisodes: 0,
        avgScore: 0,
        favoriteGenre: '-',
      ),
      genres: [],
      formats: [],
      yearlyScores: [],
      studios: [],
      voiceActors: [],
    );
  }

  AnalysisData copyWith({
    StatsOverview? overview,
    List<GenreStatItem>? genres,
    List<FormatStatItem>? formats,
    List<YearlyScoreItem>? yearlyScores,
    List<RankingItem>? studios,
    List<RankingItem>? voiceActors,
  }) {
    return AnalysisData(
      overview: overview ?? this.overview,
      genres: genres ?? this.genres,
      formats: formats ?? this.formats,
      yearlyScores: yearlyScores ?? this.yearlyScores,
      studios: studios ?? this.studios,
      voiceActors: voiceActors ?? this.voiceActors,
    );
  }
}

class FormatStatItem {
  const FormatStatItem({
    required this.label,
    required this.count,
    required this.ratio,
  });

  final String label;
  final int count;
  final double ratio;

  factory FormatStatItem.fromJson(Map<String, dynamic> json) {
    final count = _readNumber(json['count'] ?? json['animeCount'] ?? json['value']);
    final ratio = _readNumber(json['ratio'] ?? json['percentage']);

    return FormatStatItem(
      label: (json['format'] ?? json['label'] ?? json['name'] ?? '-').toString(),
      count: count.toInt(),
      ratio: ratio > 1 ? ratio / 100 : ratio,
    );
  }

  static List<FormatStatItem> fromEntries(List<AnimeEntry> entries) {
    final counts = <String, int>{};
    for (final entry in entries) {
      counts.update(entry.format, (value) => value + 1, ifAbsent: () => 1);
    }
    if (counts.isEmpty) {
      return const [];
    }

    final total = counts.values.fold<int>(0, (sum, count) => sum + count);
    final sorted = counts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return [
      for (final entry in sorted)
        FormatStatItem(
          label: entry.key,
          count: entry.value,
          ratio: total == 0 ? 0 : entry.value / total,
        ),
    ];
  }
}

class GenreStatItem {
  const GenreStatItem({
    required this.label,
    required this.count,
    required this.ratio,
  });

  final String label;
  final int count;
  final double ratio;

  factory GenreStatItem.fromJson(Map<String, dynamic> json) {
    final count = _readNumber(json['count'] ?? json['animeCount'] ?? json['value']);
    final ratio = _readNumber(json['ratio'] ?? json['percentage']);

    return GenreStatItem(
      label: (json['genre'] ?? json['label'] ?? json['name'] ?? '-').toString(),
      count: count.toInt(),
      ratio: ratio > 1 ? ratio / 100 : ratio,
    );
  }

  static List<GenreStatItem> fromEntries(List<AnimeEntry> entries) {
    final counts = <String, int>{};
    for (final entry in entries) {
      counts.update(entry.genre, (value) => value + 1, ifAbsent: () => 1);
    }
    if (counts.isEmpty) {
      return const [];
    }

    final maxCount = counts.values.reduce((a, b) => a > b ? a : b);
    final sorted = counts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return [
      for (final entry in sorted)
        GenreStatItem(
          label: entry.key,
          count: entry.value,
          ratio: entry.value / maxCount,
        ),
    ];
  }
}

class YearlyScoreItem {
  const YearlyScoreItem({
    required this.year,
    required this.averageScore,
  });

  final int year;
  final double averageScore;

  double get ratio => (averageScore / 10).clamp(0.0, 1.0).toDouble();

  factory YearlyScoreItem.fromJson(Map<String, dynamic> json) {
    return YearlyScoreItem(
      year: (json['year'] as num?)?.toInt() ?? 0,
      averageScore:
          _readNumber(json['avgScore'] ?? json['averageScore'] ?? json['score']),
    );
  }

  static List<YearlyScoreItem> fromEntries(List<AnimeEntry> entries) {
    final scores = <int, List<double>>{};
    for (final entry in entries) {
      scores.update(
        entry.year,
        (value) => [...value, entry.score],
        ifAbsent: () => [entry.score],
      );
    }

    return scores.entries.map((entry) {
      final avg = entry.value.reduce((a, b) => a + b) / entry.value.length;
      return YearlyScoreItem(year: entry.key, averageScore: avg);
    }).toList()
      ..sort((a, b) => a.year.compareTo(b.year));
  }
}

class RankingItem {
  const RankingItem({
    required this.label,
    required this.detail,
  });

  final String label;
  final String detail;

  factory RankingItem.fromJson(Map<String, dynamic> json) {
    final name = json['name'] ??
        json['label'] ??
        json['studioName'] ??
        json['voiceActorName'] ??
        '-';
    final count = json['animeCount'] ?? json['count'];
    final avgScore = json['averageScore'] ?? json['avgScore'];

    return RankingItem(
      label: name.toString(),
      detail: [
        if (count != null) '$count작품',
        if (avgScore != null) '평균 $avgScore',
      ].join(' · '),
    );
  }
}

double _readNumber(Object? value) {
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value) ?? 0;
  }
  return 0;
}
