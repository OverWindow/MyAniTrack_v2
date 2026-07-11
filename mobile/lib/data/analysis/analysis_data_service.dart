import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../api/stats_repository.dart';
import '../api/voice_actor_repository.dart';
import '../models/analysis_models.dart';

class AnalysisDataService {
  AnalysisDataService({
    StatsRepository? statsRepository,
    VoiceActorRepository? voiceActorRepository,
  })  : _statsRepository = statsRepository ?? StatsRepository(ApiClient()),
        _voiceActorRepository =
            voiceActorRepository ?? VoiceActorRepository(ApiClient());

  final StatsRepository _statsRepository;
  final VoiceActorRepository _voiceActorRepository;

  Future<AnalysisData> fetchMyAnalysis() async {
    final sample = AnalysisData.sample();

    try {
      final overview = await _statsRepository.fetchOverviewModel();
      final genres = await _fetchGenres(sample.genres);
      final formats = await _fetchFormats(sample.formats);
      final yearlyScores = await _fetchYearlyScores(sample.yearlyScores);
      final studios = await _fetchStudios(sample.studios);
      final voiceActors = await _fetchVoiceActors(sample.voiceActors);

      return sample.copyWith(
        overview: overview,
        genres: genres,
        formats: formats,
        yearlyScores: yearlyScores,
        studios: studios,
        voiceActors: voiceActors,
        isSample: false,
      );
    } on Object catch (error) {
      if (error is ApiException &&
          (error.statusCode == 401 || error.statusCode == 403)) {
        rethrow;
      }
      return sample;
    }
  }

  Future<List<GenreStatItem>> _fetchGenres(List<GenreStatItem> fallback) async {
    try {
      final json = await _statsRepository.fetchGenreBubble();
      final items = _readItems(
        json,
        aliases: const ['genres', 'genreBubble', 'genreDistribution'],
      );
      if (items is! List) {
        return fallback;
      }

      final parsed = items
          .whereType<Map<String, dynamic>>()
          .map(GenreStatItem.fromJson)
          .toList();
      return parsed.isEmpty ? fallback : parsed;
    } on Object {
      return fallback;
    }
  }

  Future<List<FormatStatItem>> _fetchFormats(
    List<FormatStatItem> fallback,
  ) async {
    try {
      final json = await _statsRepository.fetchFormatDistribution();
      final items = _readItems(
        json,
        aliases: const ['formats', 'formatDistribution', 'distribution'],
      );
      if (items is! List) {
        return fallback;
      }

      final parsed = items
          .whereType<Map<String, dynamic>>()
          .map(FormatStatItem.fromJson)
          .toList();
      return parsed.isEmpty ? fallback : parsed;
    } on Object {
      return fallback;
    }
  }

  Future<List<YearlyScoreItem>> _fetchYearlyScores(
    List<YearlyScoreItem> fallback,
  ) async {
    try {
      final json = await _statsRepository.fetchYearlyScores();
      final items = _readItems(
        json,
        aliases: const ['yearlyScores', 'scores', 'years'],
      );
      if (items is! List) {
        return fallback;
      }

      final parsed = items
          .whereType<Map<String, dynamic>>()
          .map(YearlyScoreItem.fromJson)
          .toList();
      return parsed.isEmpty ? fallback : parsed;
    } on Object {
      return fallback;
    }
  }

  Future<List<RankingItem>> _fetchStudios(List<RankingItem> fallback) async {
    try {
      final json = await _statsRepository.fetchStudios();
      final items = _readItems(json, aliases: const ['studios']);
      if (items is! List) {
        return fallback;
      }

      final parsed = items
          .whereType<Map<String, dynamic>>()
          .map(RankingItem.fromJson)
          .toList();
      return parsed.isEmpty ? fallback : parsed;
    } on Object {
      return fallback;
    }
  }

  Future<List<RankingItem>> _fetchVoiceActors(
    List<RankingItem> fallback,
  ) async {
    try {
      final json = await _voiceActorRepository.fetchMyRanking();
      final items = _readItems(
        json,
        aliases: const ['voiceActors', 'ranking', 'actors'],
      );
      if (items is! List) {
        return fallback;
      }

      final parsed = items
          .whereType<Map<String, dynamic>>()
          .map(RankingItem.fromJson)
          .toList();
      return parsed.isEmpty ? fallback : parsed;
    } on Object {
      return fallback;
    }
  }

  Object? _readItems(
    Map<String, dynamic> json, {
    List<String> aliases = const [],
  }) {
    for (final alias in aliases) {
      final value = json[alias];
      if (value != null) {
        return value;
      }
    }

    return json['items'] ?? json['data'] ?? json['results'];
  }
}
