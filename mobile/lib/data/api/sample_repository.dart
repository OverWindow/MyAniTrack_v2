import '../models/anime_entry.dart';
import '../models/sample_data.dart';
import '../models/stats_overview.dart';
import 'api_client.dart';

class SampleRepository {
  const SampleRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> fetchSampleOverview() {
    return _apiClient.getJson('/sample/overview');
  }

  Future<StatsOverview> fetchSampleOverviewStats() async {
    try {
      final json = await fetchSampleOverview();
      return StatsOverview.fromJson(json);
    } on Object {
      return StatsOverview.fromEntries(sampleEntries);
    }
  }

  Future<List<AnimeEntry>> fetchSampleCollection() async {
    try {
      final json = await _apiClient.getJson('/sample/anime-list');
      final items = _readItems(json);
      if (items is List) {
        return items
            .whereType<Map<String, dynamic>>()
            .map(AnimeEntry.fromJson)
            .toList();
      }
    } on Object {
      // The app remains useful offline and before the backend is reachable.
    }

    return sampleEntries;
  }

  Object? _readItems(Map<String, dynamic> json) {
    final collection = json['collection'];
    if (collection is Map<String, dynamic>) {
      return collection['items'] ?? collection['animeList'];
    }

    return json['items'] ?? json['data'] ?? json['animeList'];
  }
}
