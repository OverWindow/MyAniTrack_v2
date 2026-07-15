import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_badge.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_state_message.dart';
import '../../../core/widgets/anime_poster.dart';
import '../../../data/api/anime_repository.dart';
import '../../../data/api/api_client.dart';
import '../../../data/api/collection_repository.dart';
import '../../../data/auth/auth_session_service.dart';
import '../../../data/models/anime_search_result.dart';
import '../../../data/models/anime_entry.dart';
import '../../../data/models/collection_status.dart';

class AnimeSearchPage extends StatefulWidget {
  const AnimeSearchPage({super.key});

  @override
  State<AnimeSearchPage> createState() => _AnimeSearchPageState();
}

class _AnimeSearchPageState extends State<AnimeSearchPage> {
  static const _authSessionService = AuthSessionService();

  String _query = '';
  bool _loading = false;
  List<AnimeSearchResult>? _apiResults;

  List<AnimeEntry> get _results {
    final apiResults = _apiResults;
    if (apiResults != null) {
      return apiResults.map((result) => result.anime).toList();
    }

    return const [];
  }

  @override
  Widget build(BuildContext context) {
    final results = _results;
    final isSignedIn = _authSessionService.isSignedIn;

    return Scaffold(
      backgroundColor: AppColors.bgPage,
      appBar: AppBar(
        title: const Text('애니 검색'),
        backgroundColor: AppColors.bgPage,
      ),
      body: isSignedIn
          ? ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                _SearchField(
                  onChanged: (value) {
                    setState(() {
                      _query = value;
                      _apiResults = null;
                    });
                  },
                  onSubmitted: (_) => _search(),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    AppBadge(
                      label:
                          _apiResults == null ? 'API 검색' : '내 컬렉션 포함 검색',
                      icon: Icons.search_rounded,
                    ),
                    const Spacer(),
                    FilledButton.tonalIcon(
                      onPressed: _loading ? null : _search,
                      icon: _loading
                          ? const SizedBox.square(
                              dimension: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.cloud_sync_outlined),
                      label: Text(_loading ? '검색 중' : 'API 검색'),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (results.isEmpty)
                  const _EmptySearchMessage()
                else
                  for (final entry in results)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _SearchResultCard(
                        entry: entry,
                        collectionStatus: _collectionStatusFor(entry.id),
                      ),
                    ),
              ],
            )
          : const Padding(
              padding: EdgeInsets.all(16),
              child: AppStateMessage(
                icon: Icons.lock_outline_rounded,
                title: '로그인 후 검색할 수 있습니다.',
                body: '애니 검색과 컬렉션 추가는 로그인 후 사용할 수 있습니다.',
              ),
            ),
    );
  }

  MyCollectionStatus? _collectionStatusFor(int animeId) {
    final results = _apiResults;
    if (results == null) {
      return null;
    }

    for (final result in results) {
      if (result.anime.id == animeId) {
        return result.myCollection;
      }
    }

    return null;
  }

  Future<void> _search() async {
    final query = _query.trim();
    if (!_authSessionService.isSignedIn) {
      return;
    }
    if (query.isEmpty) {
      setState(() => _apiResults = null);
      return;
    }

    setState(() => _loading = true);

    try {
      final repository = AnimeRepository(ApiClient());
      final results = await repository.searchMyAnimeItems(query);

      if (!mounted) {
        return;
      }

      setState(() => _apiResults = results);
    } on Object {
      if (!mounted) {
        return;
      }

      setState(() => _apiResults = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('API 검색에 실패했습니다.')),
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.onChanged,
    required this.onSubmitted,
  });

  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.textMuted.withOpacity(0.18)),
      ),
      child: Row(
        children: [
          const Icon(Icons.search, color: AppColors.textMuted),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              autofocus: true,
              onChanged: onChanged,
              onSubmitted: onSubmitted,
              decoration: const InputDecoration.collapsed(
                hintText: '프리렌, Drama, 2023...',
              ),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchResultCard extends StatelessWidget {
  const _SearchResultCard({
    required this.entry,
    this.collectionStatus,
  });

  final AnimeEntry entry;
  final MyCollectionStatus? collectionStatus;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          AnimePoster(
            title: entry.title,
            imageUrl: entry.coverImageUrl,
            width: 58,
            height: 82,
            radius: 14,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  '${entry.year} · ${entry.format} · ${entry.genre}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(
                      Icons.star_rounded,
                      color: AppColors.pointBorder,
                      size: 18,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      entry.score.toStringAsFixed(1),
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (collectionStatus?.exists == true) ...[
                      const SizedBox(width: 10),
                      AppBadge(
                        label: CollectionStatus.fromApiValue(
                          collectionStatus?.status,
                        ).label,
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          IconButton.filledTonal(
            onPressed: collectionStatus?.exists == true
                ? null
                : () => _addToCollection(context),
            icon: const Icon(Icons.add_rounded),
            tooltip: '컬렉션 추가',
          ),
        ],
      ),
    );
  }

  Future<void> _addToCollection(BuildContext context) async {
    if (!const AuthSessionService().isSignedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${entry.title} 추가는 로그인 후 사용할 수 있습니다.'),
        ),
      );
      return;
    }

    try {
      await CollectionRepository(ApiClient()).addAnime(
        animeId: entry.id,
        status: CollectionStatus.planned.apiValue,
      );
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${entry.title}을(를) 컬렉션에 추가했습니다.')),
      );
      Navigator.of(context).pop(true);
    } on Object {
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${entry.title} 추가에 실패했습니다.')),
      );
    }
  }
}

class _EmptySearchMessage extends StatelessWidget {
  const _EmptySearchMessage();

  @override
  Widget build(BuildContext context) {
    return const AppStateMessage(
      icon: Icons.search_off_rounded,
      title: '검색 결과가 없습니다.',
      body: '다른 제목이나 장르 키워드로 다시 검색해보세요.',
    );
  }
}
