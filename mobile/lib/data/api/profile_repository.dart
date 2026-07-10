import '../models/anime_entry.dart';
import '../models/public_badge_info.dart';
import 'api_client.dart';

class ProfileRepository {
  const ProfileRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> updateMyProfile({
    String? username,
    String? bio,
    String? profileImageUrl,
    bool? isPublic,
  }) {
    return _apiClient.patchJson(
      '/me/profile',
      body: {
        if (username != null) 'username': username,
        if (bio != null) 'bio': bio,
        if (profileImageUrl != null) 'profileImageUrl': profileImageUrl,
        if (isPublic != null) 'isPublic': isPublic,
      },
    );
  }

  Future<Map<String, dynamic>> fetchPublicProfile(int userId) {
    return _apiClient.getJson('/users/$userId/profile');
  }

  Future<Map<String, dynamic>> fetchPublicAnimeList(
    int userId, {
    String sort = 'latest',
    String titleLanguage = 'ko',
    int limit = 20,
    String? cursor,
  }) {
    return _apiClient.getJson(
      '/users/$userId/anime-list',
      query: {
        'sort': sort,
        'titleLanguage': titleLanguage,
        'limit': '$limit',
        if (cursor != null) 'cursor': cursor,
      },
    );
  }

  Future<List<AnimeEntry>> fetchPublicAnimeListItems(
    int userId, {
    String sort = 'latest',
    String titleLanguage = 'ko',
    int limit = 20,
    String? cursor,
  }) async {
    final json = await fetchPublicAnimeList(
      userId,
      sort: sort,
      titleLanguage: titleLanguage,
      limit: limit,
      cursor: cursor,
    );
    final items = _readItems(json);
    if (items is! List) {
      return const [];
    }

    return items
        .whereType<Map<String, dynamic>>()
        .map(AnimeEntry.fromJson)
        .toList();
  }

  Future<Map<String, dynamic>> fetchPublicStats(int userId) {
    return _apiClient.getJson('/users/$userId/anime-stats');
  }

  Future<Map<String, dynamic>> fetchPublicGenreBubble(
    int userId, {
    String titleLanguage = 'ko',
    int minCount = 5,
    String weighting = 'full',
    String status = 'all',
    int topLimit = 10,
  }) {
    return _apiClient.getJson(
      '/users/$userId/anime-stats/genre-bubble',
      query: {
        'titleLanguage': titleLanguage,
        'minCount': '$minCount',
        'weighting': weighting,
        'status': status,
        'topLimit': '$topLimit',
      },
    );
  }

  Future<Map<String, dynamic>> fetchPublicYearlyScores(
    int userId, {
    String status = 'completed',
    int minRatedAnimeCount = 3,
  }) {
    return _apiClient.getJson(
      '/users/$userId/anime-stats/yearly-scores',
      query: {
        'status': status,
        'minRatedAnimeCount': '$minRatedAnimeCount',
      },
    );
  }

  Future<Map<String, dynamic>> fetchPublicFormatDistribution(
    int userId, {
    String status = 'completed',
    int minCount = 1,
  }) {
    return _apiClient.getJson(
      '/users/$userId/anime-stats/format-distribution',
      query: {
        'status': status,
        'minCount': '$minCount',
      },
    );
  }

  Future<Map<String, dynamic>> fetchPublicStudios(
    int userId, {
    String sort = 'count',
    String status = 'all',
    bool mainOnly = true,
    int minAnimeCount = 1,
    int limit = 20,
    String? cursor,
  }) {
    return _apiClient.getJson(
      '/users/$userId/anime-stats/studios',
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

  Future<Map<String, dynamic>> fetchPublicBadges(int userId) {
    return _apiClient.getJson('/users/$userId/badges');
  }

  Future<List<PublicBadgeInfo>> fetchPublicBadgeItems(int userId) async {
    final json = await fetchPublicBadges(userId);
    final items = _readItems(json);
    if (items is! List) {
      return const [];
    }

    return items
        .whereType<Map<String, dynamic>>()
        .map(PublicBadgeInfo.fromJson)
        .toList();
  }

  Object? _readItems(Map<String, dynamic> json) {
    final data = json['data'];
    if (data is Map<String, dynamic>) {
      return _readItems(data);
    }

    final collection = json['collection'];
    if (collection is Map<String, dynamic>) {
      return collection['items'] ?? collection['animeList'];
    }

    return json['items'] ??
        data ??
        json['results'] ??
        json['badges'] ??
        json['animeList'];
  }
}
