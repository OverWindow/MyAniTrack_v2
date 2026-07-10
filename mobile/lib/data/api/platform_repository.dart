import '../models/anime_entry.dart';
import 'api_client.dart';

class PlatformRepository {
  const PlatformRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> fetchPlatformStats() {
    return _apiClient.getJson('/stats/platform');
  }

  Future<Map<String, dynamic>> fetchPopularAnime({int limit = 10}) {
    return _apiClient.getJson(
      '/stats/platform/popular-anime',
      query: {'limit': '$limit'},
    );
  }

  Future<List<AnimeEntry>> fetchPopularAnimeItems({int limit = 10}) async {
    final json = await fetchPopularAnime(limit: limit);
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
    return json['items'] ??
        json['data'] ??
        json['popularAnime'] ??
        json['anime'];
  }
}
