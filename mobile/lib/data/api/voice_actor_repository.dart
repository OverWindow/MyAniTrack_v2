import '../models/anime_entry.dart';
import 'api_client.dart';

class VoiceActorRepository {
  const VoiceActorRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> fetchMyRanking({
    String sort = 'count',
    int limit = 20,
    String? cursor,
    int minAnimeCount = 1,
    int minRatedAnimeCount = 1,
  }) {
    return _apiClient.getJson(
      '/me/voice-actors/ranking',
      authenticated: true,
      query: {
        'sort': sort,
        'limit': '$limit',
        'minAnimeCount': '$minAnimeCount',
        'minRatedAnimeCount': '$minRatedAnimeCount',
        if (cursor != null) 'cursor': cursor,
      },
    );
  }

  Future<Map<String, dynamic>> fetchMyVoiceActorAnime(
    int voiceActorId, {
    String titleLanguage = 'ko',
    int limit = 20,
    String? cursor,
  }) {
    return _apiClient.getJson(
      '/me/voice-actors/$voiceActorId/anime',
      authenticated: true,
      query: {
        'titleLanguage': titleLanguage,
        'limit': '$limit',
        if (cursor != null) 'cursor': cursor,
      },
    );
  }

  Future<List<AnimeEntry>> fetchMyVoiceActorAnimeItems(
    int voiceActorId, {
    String titleLanguage = 'ko',
    int limit = 20,
    String? cursor,
  }) async {
    final json = await fetchMyVoiceActorAnime(
      voiceActorId,
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

  Future<Map<String, dynamic>> fetchPublicRanking(
    int userId, {
    String sort = 'count',
    int limit = 20,
    String? cursor,
  }) {
    return _apiClient.getJson(
      '/users/$userId/voice-actors/ranking',
      query: {
        'sort': sort,
        'limit': '$limit',
        if (cursor != null) 'cursor': cursor,
      },
    );
  }

  Future<Map<String, dynamic>> fetchPublicVoiceActorAnime(
    int userId,
    int voiceActorId, {
    String titleLanguage = 'ko',
    int limit = 20,
    String? cursor,
  }) {
    return _apiClient.getJson(
      '/users/$userId/voice-actors/$voiceActorId/anime',
      query: {
        'titleLanguage': titleLanguage,
        'limit': '$limit',
        if (cursor != null) 'cursor': cursor,
      },
    );
  }

  Future<List<AnimeEntry>> fetchPublicVoiceActorAnimeItems(
    int userId,
    int voiceActorId, {
    String titleLanguage = 'ko',
    int limit = 20,
    String? cursor,
  }) async {
    final json = await fetchPublicVoiceActorAnime(
      userId,
      voiceActorId,
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

  Object? _readItems(Map<String, dynamic> json) {
    final data = json['data'];
    if (data is Map<String, dynamic>) {
      return _readItems(data);
    }

    return json['items'] ?? json['animeList'] ?? json['results'] ?? data;
  }
}
