import '../models/stats_overview.dart';
import 'api_client.dart';

class StatsRepository {
  const StatsRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> fetchOverview() {
    return _apiClient.getJson('/me/anime-stats', authenticated: true);
  }

  Future<StatsOverview> fetchOverviewModel() async {
    final json = await fetchOverview();
    return StatsOverview.fromJson(json);
  }

  Future<Map<String, dynamic>> fetchGenreBubble({
    String titleLanguage = 'ko',
    int minCount = 5,
    String weighting = 'full',
    String status = 'all',
    int topLimit = 10,
  }) {
    return _apiClient.getJson(
      '/me/anime-stats/genre-bubble',
      authenticated: true,
      query: {
        'titleLanguage': titleLanguage,
        'minCount': '$minCount',
        'weighting': weighting,
        'status': status,
        'topLimit': '$topLimit',
      },
    );
  }

  Future<Map<String, dynamic>> fetchYearlyScores({
    String status = 'completed',
    int minRatedAnimeCount = 3,
  }) {
    return _apiClient.getJson(
      '/me/anime-stats/yearly-scores',
      authenticated: true,
      query: {
        'status': status,
        'minRatedAnimeCount': '$minRatedAnimeCount',
      },
    );
  }

  Future<Map<String, dynamic>> fetchFormatDistribution({
    String status = 'completed',
    int minCount = 1,
  }) {
    return _apiClient.getJson(
      '/me/anime-stats/format-distribution',
      authenticated: true,
      query: {
        'status': status,
        'minCount': '$minCount',
      },
    );
  }

  Future<Map<String, dynamic>> fetchStudios({
    String sort = 'count',
    String status = 'all',
    bool mainOnly = true,
    int minAnimeCount = 1,
    int limit = 20,
    String? cursor,
  }) {
    return _apiClient.getJson(
      '/me/anime-stats/studios',
      authenticated: true,
      query: {
        'sort': sort,
        'status': status,
        'mainOnly': '$mainOnly',
        'minAnimeCount': '$minAnimeCount',
        'limit': '$limit',
        if (cursor != null) 'cursor': cursor,
      },
    );
  }

  Future<Map<String, dynamic>> fetchVoiceActorRanking({
    String sort = 'count',
    int limit = 20,
    String? cursor,
  }) {
    return _apiClient.getJson(
      '/me/voice-actors/ranking',
      authenticated: true,
      query: {
        'sort': sort,
        'limit': '$limit',
        if (cursor != null) 'cursor': cursor,
      },
    );
  }
}
