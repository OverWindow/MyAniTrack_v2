import '../models/anime_cast_member.dart';
import '../models/anime_search_result.dart';
import 'api_client.dart';

class AnimeRepository {
  const AnimeRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> fetchAnimeList({
    String sort = 'latest',
    String titleLanguage = 'ko',
    String? genre,
    int limit = 20,
    String? cursor,
  }) {
    return _apiClient.getJson(
      '/anime',
      query: {
        'sort': sort,
        'titleLanguage': titleLanguage,
        'limit': '$limit',
        if (genre != null) 'genre': genre,
        if (cursor != null) 'cursor': cursor,
      },
    );
  }

  Future<Map<String, dynamic>> searchAnime(String query) {
    return _apiClient.getJson('/anime/search', query: {'query': query});
  }

  Future<List<AnimeSearchResult>> searchAnimeItems(String query) async {
    final json = await searchAnime(query);
    final items = _readItems(json);
    if (items is! List) {
      return const [];
    }

    return items
        .whereType<Map<String, dynamic>>()
        .map(AnimeSearchResult.fromJson)
        .toList();
  }

  Future<Map<String, dynamic>> searchMyAnime(String query) {
    return _apiClient.getJson(
      '/me/anime/search',
      authenticated: true,
      query: {'query': query},
    );
  }

  Future<List<AnimeSearchResult>> searchMyAnimeItems(String query) async {
    final json = await searchMyAnime(query);
    final items = _readItems(json);
    if (items is! List) {
      return const [];
    }

    return items
        .whereType<Map<String, dynamic>>()
        .map(AnimeSearchResult.fromJson)
        .toList();
  }

  Future<Map<String, dynamic>> fetchAnimeDetail(int animeId) {
    return _apiClient.getJson('/anime/$animeId');
  }

  Future<Map<String, dynamic>> fetchAnimeCast(
    int animeId, {
    String role = 'MAIN',
    String voiceLanguage = 'Japanese',
    int limit = 20,
  }) {
    return _apiClient.getJson(
      '/anime/$animeId/cast',
      query: {
        'role': role,
        'voiceLanguage': voiceLanguage,
        'limit': '$limit',
      },
    );
  }

  Future<List<AnimeCastMember>> fetchAnimeCastItems(
    int animeId, {
    String role = 'MAIN',
    String voiceLanguage = 'Japanese',
    int limit = 20,
  }) async {
    final json = await fetchAnimeCast(
      animeId,
      role: role,
      voiceLanguage: voiceLanguage,
      limit: limit,
    );
    final items = _readItems(json);
    if (items is! List) {
      return const [];
    }

    return items
        .whereType<Map<String, dynamic>>()
        .map(AnimeCastMember.fromJson)
        .toList();
  }

  Object? _readItems(Map<String, dynamic> json) {
    final data = json['data'];
    if (data is Map<String, dynamic>) {
      return _readItems(data);
    }

    return json['items'] ??
        data ??
        json['results'] ??
        json['cast'] ??
        json['characters'] ??
        json['anime'];
  }
}
