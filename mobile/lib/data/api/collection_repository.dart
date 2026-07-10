import '../models/anime_entry.dart';
import '../models/page_info.dart';
import '../models/paginated_result.dart';
import 'api_client.dart';

class CollectionRepository {
  const CollectionRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<AnimeEntry>> fetchMyAnimeList({
    String sort = 'latest',
    String titleLanguage = 'ko',
    String? genre,
    int? year,
    int limit = 20,
    String? cursor,
  }) async {
    final page = await fetchMyAnimeListPage(
      sort: sort,
      titleLanguage: titleLanguage,
      genre: genre,
      year: year,
      limit: limit,
      cursor: cursor,
    );

    return page.items;
  }

  Future<PaginatedResult<AnimeEntry>> fetchMyAnimeListPage({
    String sort = 'latest',
    String titleLanguage = 'ko',
    String? genre,
    int? year,
    int limit = 20,
    String? cursor,
  }) async {
    final json = await _apiClient.getJson(
      '/me/anime-list',
      authenticated: true,
      query: {
        'sort': sort,
        'titleLanguage': titleLanguage,
        'limit': '$limit',
        if (genre != null) 'genre': genre,
        if (year != null) 'year': '$year',
        if (cursor != null) 'cursor': cursor,
      },
    );

    final items = json['items'];
    if (items is! List) {
      return PaginatedResult(
        items: const [],
        pageInfo: PageInfo.fromJson(
          json['pageInfo'] is Map<String, dynamic>
              ? json['pageInfo'] as Map<String, dynamic>
              : null,
        ),
      );
    }

    return PaginatedResult(
      items: items
          .whereType<Map<String, dynamic>>()
          .map(AnimeEntry.fromJson)
          .toList(),
      pageInfo: PageInfo.fromJson(
        json['pageInfo'] is Map<String, dynamic>
            ? json['pageInfo'] as Map<String, dynamic>
            : null,
      ),
    );
  }

  Future<Map<String, dynamic>> addAnime({
    required int animeId,
    required String status,
    double? score,
    int? progress,
    String? startedAt,
    String? completedAt,
    String? notes,
  }) {
    return _apiClient.postJson(
      '/me/anime-list',
      authenticated: true,
      body: {
        'animeId': animeId,
        'status': status,
        if (score != null) 'score': score,
        if (progress != null) 'progress': progress,
        if (startedAt != null) 'startedAt': startedAt,
        if (completedAt != null) 'completedAt': completedAt,
        if (notes != null) 'notes': notes,
      },
    );
  }

  Future<Map<String, dynamic>> updateAnime(
    int animeId, {
    String? status,
    double? score,
    int? progress,
  }) {
    return _apiClient.patchJson(
      '/me/anime-list/$animeId',
      body: {
        if (status != null) 'status': status,
        if (score != null) 'score': score,
        if (progress != null) 'progress': progress,
      },
    );
  }

  Future<Map<String, dynamic>> removeAnime(int animeId) {
    return _apiClient.deleteJson('/me/anime-list/$animeId');
  }
}
