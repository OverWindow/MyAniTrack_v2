import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_badge.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_state_message.dart';
import '../../../core/widgets/anime_poster.dart';
import '../../../data/api/api_access_issue.dart';
import '../../../data/api/api_client.dart';
import '../../../data/api/collection_repository.dart';
import '../../../data/auth/auth_session_service.dart';
import '../../../data/models/anime_entry.dart';
import '../../../data/models/collection_status.dart';
import '../../profile/presentation/agreements_page.dart';
import '../../anime_search/presentation/anime_search_page.dart';
import '../../anime_detail/anime_detail_page.dart';

enum _CollectionFilter {
  all('전체'),
  completed('완료', CollectionStatus.completed),
  watching('보는 중', CollectionStatus.watching);

  const _CollectionFilter(this.label, [this.status]);

  final String label;
  final CollectionStatus? status;
}

enum _CollectionSort {
  recent('최근순'),
  score('평점순'),
  year('연도순');

  const _CollectionSort(this.label);

  final String label;
}

class CollectionPage extends StatefulWidget {
  const CollectionPage({super.key});

  @override
  State<CollectionPage> createState() => _CollectionPageState();
}

class _CollectionPageState extends State<CollectionPage> {
  static const _authSessionService = AuthSessionService();

  _CollectionFilter _filter = _CollectionFilter.all;
  _CollectionSort _sort = _CollectionSort.recent;
  String _query = '';
  late Future<List<AnimeEntry>> _entriesFuture = _loadEntries();
  List<AnimeEntry>? _cachedEntries;
  String? _nextCursor;
  ApiAccessIssue? _accessIssue;
  bool _hasNext = false;
  bool _loadingMore = false;

  Future<List<AnimeEntry>> _loadEntries() async {
    _nextCursor = null;
    _hasNext = false;
    _accessIssue = null;

    if (!_authSessionService.isSignedIn) {
      _cachedEntries = const [];
      return const [];
    }

    try {
      final page = await CollectionRepository(ApiClient()).fetchMyAnimeListPage();
      final entries = page.items;
      _nextCursor = page.pageInfo.nextCursor;
      _hasNext = page.pageInfo.hasNext && _nextCursor != null;
      _cachedEntries = entries;
      return entries;
    } on Object catch (error) {
      _accessIssue = ApiAccessIssue.from(error);
      _cachedEntries = const [];
      return const [];
    }
  }

  List<AnimeEntry> _visibleEntries(List<AnimeEntry> entries) {
    final normalizedQuery = _query.trim().toLowerCase();
    final filtered = entries.where((entry) {
      final matchesQuery = normalizedQuery.isEmpty ||
          entry.title.toLowerCase().contains(normalizedQuery) ||
          entry.genre.toLowerCase().contains(normalizedQuery) ||
          '${entry.year}'.contains(normalizedQuery);
      final matchesFilter = switch (_filter) {
        _CollectionFilter.all => true,
        _CollectionFilter.completed ||
        _CollectionFilter.watching =>
          entry.collectionStatus == _filter.status,
      };

      return matchesQuery && matchesFilter;
    }).toList();

    switch (_sort) {
      case _CollectionSort.recent:
        return filtered;
      case _CollectionSort.score:
        filtered.sort((a, b) => b.score.compareTo(a.score));
        return filtered;
      case _CollectionSort.year:
        filtered.sort((a, b) => b.year.compareTo(a.year));
        return filtered;
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AnimeEntry>>(
      future: _entriesFuture,
      builder: (context, snapshot) {
        final sourceEntries = _cachedEntries ?? snapshot.data;
        final entries = sourceEntries ?? const <AnimeEntry>[];
        final visibleEntries = _visibleEntries(entries);
        final isSignedIn = _authSessionService.isSignedIn;

        return RefreshIndicator(
          onRefresh: _refreshEntries,
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                sliver: SliverList.list(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '컬렉션',
                            style: Theme.of(context).textTheme.headlineLarge,
                          ),
                        ),
                        if (isSignedIn) ...[
                          IconButton.filled(
                            onPressed: _openAnimeSearch,
                            icon: const Icon(Icons.add_rounded),
                            tooltip: '애니 추가',
                          ),
                          const SizedBox(width: 8),
                        ],
                        AppBadge(
                          label: '내 컬렉션',
                        ),
                      ],
                    ),
                    if (snapshot.connectionState == ConnectionState.waiting) ...[
                      const SizedBox(height: 10),
                      const LinearProgressIndicator(minHeight: 3),
                    ],
                    const SizedBox(height: 14),
                    if (_accessIssue != null) ...[
                      _AccessIssueMessage(
                        issue: _accessIssue!,
                        onAgreementsTap: _openAgreements,
                      ),
                      const SizedBox(height: 14),
                    ],
                    if (!isSignedIn)
                      const _LockedCollectionMessage()
                    else ...[
                      _SearchToolbar(
                        onChanged: (value) => setState(() => _query = value),
                        onSearchTap: _openAnimeSearch,
                      ),
                      const SizedBox(height: 16),
                      _CollectionControls(
                        filter: _filter,
                        sort: _sort,
                        onFilterChanged: (value) =>
                            setState(() => _filter = value),
                        onSortChanged: (value) => setState(() => _sort = value),
                      ),
                      const SizedBox(height: 18),
                      if (visibleEntries.isEmpty)
                        const _EmptyCollectionMessage()
                      else
                        ...visibleEntries.map(
                          (entry) => Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: AnimeCollectionCard(
                              entry: entry,
                              onChanged: _reloadEntries,
                            ),
                          ),
                        ),
                    ],
                    if (isSignedIn && _hasNext) ...[
                      const SizedBox(height: 4),
                      OutlinedButton.icon(
                        onPressed: _loadingMore ? null : _loadMoreEntries,
                        icon: _loadingMore
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.expand_more_rounded),
                        label: Text(_loadingMore ? '불러오는 중' : '더 보기'),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _openAgreements() {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (context) => const AgreementsPage()))
        .then((_) {
      if (mounted) {
        _reloadEntries();
      }
    });
  }

  void _openAnimeSearch() {
    Navigator.of(context)
        .push<bool>(
      MaterialPageRoute(builder: (context) => const AnimeSearchPage()),
    )
        .then((changed) {
      if (changed == true && mounted) {
        _reloadEntries();
      }
    });
  }

  void _reloadEntries() {
    setState(() {
      _cachedEntries = null;
      _nextCursor = null;
      _hasNext = false;
      _entriesFuture = _loadEntries();
    });
  }

  Future<void> _refreshEntries() async {
    _reloadEntries();
    await _entriesFuture;
  }

  Future<void> _loadMoreEntries() async {
    final cursor = _nextCursor;
    if (cursor == null || _loadingMore) {
      return;
    }

    setState(() => _loadingMore = true);

    try {
      final page = await CollectionRepository(ApiClient()).fetchMyAnimeListPage(
        cursor: cursor,
      );
      if (!mounted) {
        return;
      }

      setState(() {
        _cachedEntries = [
          ...?_cachedEntries,
          ...page.items,
        ];
        _nextCursor = page.pageInfo.nextCursor;
        _hasNext = page.pageInfo.hasNext && _nextCursor != null;
      });
    } on Object {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('다음 페이지를 불러오지 못했습니다.')),
      );
    } finally {
      if (mounted) {
        setState(() => _loadingMore = false);
      }
    }
  }
}

class _SearchToolbar extends StatelessWidget {
  const _SearchToolbar({
    required this.onChanged,
    required this.onSearchTap,
  });

  final ValueChanged<String> onChanged;
  final VoidCallback onSearchTap;

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
              onChanged: onChanged,
              decoration: const InputDecoration.collapsed(
                hintText: '애니 제목, 장르, 연도 검색',
              ),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          IconButton(
            onPressed: onSearchTap,
            icon: const Icon(Icons.open_in_new_rounded),
            tooltip: '전체 검색',
          ),
        ],
      ),
    );
  }
}

class _CollectionControls extends StatelessWidget {
  const _CollectionControls({
    required this.filter,
    required this.sort,
    required this.onFilterChanged,
    required this.onSortChanged,
  });

  final _CollectionFilter filter;
  final _CollectionSort sort;
  final ValueChanged<_CollectionFilter> onFilterChanged;
  final ValueChanged<_CollectionSort> onSortChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final item in _CollectionFilter.values)
              ChoiceChip(
                label: Text(item.label),
                selected: filter == item,
                onSelected: (_) => onFilterChanged(item),
              ),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final item in _CollectionSort.values)
              ChoiceChip(
                label: Text(item.label),
                selected: sort == item,
                onSelected: (_) => onSortChanged(item),
              ),
          ],
        ),
      ],
    );
  }
}

class _LockedCollectionMessage extends StatelessWidget {
  const _LockedCollectionMessage();

  @override
  Widget build(BuildContext context) {
    return const AppStateMessage(
      icon: Icons.lock_outline_rounded,
      title: '로그인 후 컬렉션을 사용할 수 있습니다.',
      body: '비로그인 상태에서는 탐색 페이지만 볼 수 있습니다.',
    );
  }
}

class _AccessIssueMessage extends StatelessWidget {
  const _AccessIssueMessage({
    required this.issue,
    required this.onAgreementsTap,
  });

  final ApiAccessIssue issue;
  final VoidCallback onAgreementsTap;

  @override
  Widget build(BuildContext context) {
    return AppStateMessage(
      icon: issue.needsAgreements
          ? Icons.assignment_turned_in_outlined
          : Icons.login_rounded,
      title: issue.title,
      body: issue.message,
      action: issue.needsAgreements
          ? FilledButton.icon(
              onPressed: onAgreementsTap,
              icon: const Icon(Icons.assignment_turned_in_outlined),
              label: const Text('약관 동의하기'),
            )
          : null,
    );
  }
}

class _EmptyCollectionMessage extends StatelessWidget {
  const _EmptyCollectionMessage();

  @override
  Widget build(BuildContext context) {
    return const AppStateMessage(
      icon: Icons.search_off_rounded,
      title: '조건에 맞는 기록이 없습니다.',
      body: '검색어, 상태 필터, 정렬 조건을 바꿔보세요.',
    );
  }
}

class AnimeCollectionCard extends StatelessWidget {
  const AnimeCollectionCard({
    required this.entry,
    this.onChanged,
    super.key,
  });

  final AnimeEntry entry;
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) {
    final totalEpisodes = entry.totalEpisodes <= 0 ? 1 : entry.totalEpisodes;
    final progress = entry.progress / totalEpisodes;

    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () {
        Navigator.of(context).push<bool>(
          MaterialPageRoute(
            builder: (context) => AnimeDetailPage(entry: entry),
          ),
        ).then((changed) {
          if (changed == true) {
            onChanged?.call();
          }
        });
      },
      child: AppCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimePoster(
              title: entry.title,
              imageUrl: entry.coverImageUrl,
              width: 82,
              height: 118,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          entry.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${entry.year} · ${entry.format} · ${entry.genre}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(
                        Icons.star_rounded,
                        color: AppColors.pointBorder,
                        size: 20,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        entry.score.toStringAsFixed(1),
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        entry.collectionStatus.label,
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: progress.clamp(0.0, 1.0).toDouble(),
                      minHeight: 8,
                      backgroundColor: AppColors.bgSoftBeige,
                      valueColor: const AlwaysStoppedAnimation(AppColors.point),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${entry.progress}/$totalEpisodes화',
                    style: Theme.of(context).textTheme.labelMedium,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
