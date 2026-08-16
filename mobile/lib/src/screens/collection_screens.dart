import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:myanitrack_mobile/src/api.dart';
import 'package:myanitrack_mobile/src/localization.dart';
import 'package:myanitrack_mobile/src/models.dart';
import 'package:myanitrack_mobile/src/providers.dart';
import 'package:myanitrack_mobile/src/theme.dart';
import 'package:myanitrack_mobile/src/widgets.dart';

class CollectionScreen extends ConsumerStatefulWidget {
  const CollectionScreen({super.key});

  @override
  ConsumerState<CollectionScreen> createState() => _CollectionScreenState();
}

class _CollectionScreenState extends ConsumerState<CollectionScreen> {
  bool _seriesMode = false;
  late final TextEditingController _searchController = TextEditingController();
  late final ScrollController _scrollController = ScrollController()
    ..addListener(_onScroll);

  void _onScroll() {
    if (_scrollController.position.extentAfter < 500) {
      if (_seriesMode) {
        ref.read(seriesCollectionControllerProvider.notifier).loadMore();
      } else {
        ref.read(collectionControllerProvider.notifier).loadMore();
      }
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(collectionControllerProvider);
    final seriesState = ref.watch(seriesCollectionControllerProvider);
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    if (_seriesMode) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ref.read(seriesCollectionControllerProvider.notifier).ensureLoaded();
        }
      });
    }
    return CupertinoPageScaffold(
      resizeToAvoidBottomInset: false,
      child: AppBackground(
        child: AppContentWidth(
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
              AppCompactSliverHeader(
                title: '내 컬렉션',
                trailing: CupertinoButton(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size.square(44),
                  onPressed: () => _seriesMode
                      ? _openSeriesFilters(context, seriesState.query)
                      : _openFilters(context, state.query),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      const Icon(CupertinoIcons.slider_horizontal_3),
                      if ((_seriesMode &&
                              (seriesState.query.scope !=
                                      AnimeSeriesScope.mainline ||
                                  seriesState.query.status !=
                                      UserSeriesStatus.all)) ||
                          (!_seriesMode &&
                              (state.query.genre != null ||
                                  state.query.year != null ||
                                  state.query.score != null)))
                        const Positioned(
                          right: -2,
                          top: -2,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: AppColors.point,
                              shape: BoxShape.circle,
                            ),
                            child: SizedBox.square(dimension: 8),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              CupertinoSliverRefreshControl(
                onRefresh: _seriesMode
                    ? ref
                          .read(seriesCollectionControllerProvider.notifier)
                          .refresh
                    : ref.read(collectionControllerProvider.notifier).refresh,
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
                sliver: SliverToBoxAdapter(
                  child: CupertinoSlidingSegmentedControl<bool>(
                    groupValue: _seriesMode,
                    thumbColor: AppColors.card,
                    backgroundColor: AppColors.softBeige,
                    children: const {
                      false: Padding(
                        padding: EdgeInsets.symmetric(
                          vertical: 9,
                          horizontal: 22,
                        ),
                        child: Text('작품'),
                      ),
                      true: Padding(
                        padding: EdgeInsets.symmetric(
                          vertical: 9,
                          horizontal: 22,
                        ),
                        child: Text('시리즈'),
                      ),
                    },
                    onValueChanged: (value) {
                      if (value == null) return;
                      setState(() => _seriesMode = value);
                      if (value) {
                        ref
                            .read(seriesCollectionControllerProvider.notifier)
                            .ensureLoaded();
                      }
                      final query = value
                          ? seriesState.query.searchQuery
                          : state.query.searchQuery;
                      _searchController.value = TextEditingValue(
                        text: query ?? '',
                        selection: TextSelection.collapsed(
                          offset: query?.length ?? 0,
                        ),
                      );
                    },
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                sliver: SliverToBoxAdapter(
                  child: _seriesMode
                      ? _SeriesSummary(state: seriesState)
                      : _CollectionSummary(state: state),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                sliver: SliverToBoxAdapter(
                  child: CupertinoSearchTextField(
                    controller: _searchController,
                    placeholder: _seriesMode ? '시리즈명·포함 작품명 검색' : '내 컬렉션 제목 검색',
                    onChanged: _seriesMode
                        ? ref
                              .read(seriesCollectionControllerProvider.notifier)
                              .setSearchQuery
                        : ref
                              .read(collectionControllerProvider.notifier)
                              .setSearchQuery,
                  ),
                ),
              ),
              if (_seriesMode)
                ..._seriesSlivers(seriesState)
              else if (state.loading && state.items.isEmpty)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverLayoutBuilder(
                    builder: (context, constraints) => SliverGrid(
                      gridDelegate: _collectionPosterGridDelegate(
                        context,
                        constraints.crossAxisExtent,
                        mainAxisSpacing: 14,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (_, _) => const AppSkeleton(height: 250),
                        childCount: 6,
                      ),
                    ),
                  ),
                )
              else if (state.failure != null && state.items.isEmpty)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverToBoxAdapter(
                    child: AppStateView(
                      icon: CupertinoIcons.wifi_exclamationmark,
                      title: '컬렉션을 불러오지 못했습니다',
                      message: state.failure!.message,
                      actionLabel: '다시 시도',
                      onAction: ref
                          .read(collectionControllerProvider.notifier)
                          .refresh,
                    ),
                  ),
                )
              else if (state.items.isEmpty)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverToBoxAdapter(
                    child: AppStateView(
                      icon: CupertinoIcons.square_grid_2x2,
                      title: state.query.searchQuery?.isNotEmpty == true
                          ? '일치하는 작품이 없어요'
                          : '아직 기록한 작품이 없습니다',
                      message: state.query.searchQuery?.isNotEmpty == true
                          ? '다른 제목으로 다시 검색해보세요.'
                          : '탐색 탭에서 첫 작품을 찾아 컬렉션을 시작해보세요.',
                      actionLabel: state.query.searchQuery?.isNotEmpty == true
                          ? null
                          : '작품 탐색하기',
                      onAction: state.query.searchQuery?.isNotEmpty == true
                          ? null
                          : () => context.go('/search'),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverLayoutBuilder(
                    builder: (context, constraints) => SliverGrid(
                      gridDelegate: _collectionPosterGridDelegate(
                        context,
                        constraints.crossAxisExtent,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, index) =>
                            CollectionPosterCard(entry: state.items[index]),
                        childCount: state.items.length,
                      ),
                    ),
                  ),
                ),
              if (!_seriesMode && state.loadingMore)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.only(bottom: 24),
                    child: Center(child: CupertinoActivityIndicator()),
                  ),
                ),
              SliverToBoxAdapter(
                child: SizedBox(
                  key: const ValueKey('collection-keyboard-spacer'),
                  height: keyboardInset,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openFilters(BuildContext context, CollectionQuery query) async {
    final next = await showCupertinoModalPopup<CollectionQuery>(
      context: context,
      builder: (context) =>
          AppModalWidth(child: CollectionFilterSheet(initial: query)),
    );
    if (next != null) {
      await ref.read(collectionControllerProvider.notifier).setQuery(next);
    }
  }

  Future<void> _openSeriesFilters(
    BuildContext context,
    SeriesCollectionQuery query,
  ) async {
    final next = await showCupertinoModalPopup<SeriesCollectionQuery>(
      context: context,
      builder: (context) =>
          AppModalWidth(child: _SeriesFilterSheet(initial: query)),
    );
    if (next != null) {
      await ref
          .read(seriesCollectionControllerProvider.notifier)
          .setQuery(next);
    }
  }

  List<Widget> _seriesSlivers(SeriesCollectionViewState state) {
    if (state.loading && state.items.isEmpty) {
      return const [
        SliverPadding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverToBoxAdapter(child: AppSkeleton(height: 230)),
        ),
      ];
    }
    if (state.failure != null && state.items.isEmpty) {
      return [
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverToBoxAdapter(
            child: AppStateView(
              icon: CupertinoIcons.wifi_exclamationmark,
              title: '시리즈를 불러오지 못했습니다',
              message: state.failure!.message,
              actionLabel: '다시 시도',
              onAction: ref
                  .read(seriesCollectionControllerProvider.notifier)
                  .refresh,
            ),
          ),
        ),
      ];
    }
    if (state.items.isEmpty) {
      return const [
        SliverPadding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverToBoxAdapter(
            child: AppStateView(
              icon: CupertinoIcons.square_stack_3d_up,
              title: '일치하는 시리즈가 없어요',
              message: '검색어나 필터를 바꿔보세요.',
            ),
          ),
        ),
      ];
    }
    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        sliver: SliverList.separated(
          itemCount: state.items.length,
          separatorBuilder: (_, _) => const SizedBox(height: 14),
          itemBuilder: (context, index) =>
              _SeriesCollectionCard(item: state.items[index]),
        ),
      ),
      if (state.loadingMore)
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.only(bottom: 24),
            child: Center(child: CupertinoActivityIndicator()),
          ),
        ),
    ];
  }
}

class _CollectionSummary extends StatelessWidget {
  const _CollectionSummary({required this.state});
  final CollectionViewState state;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      color: const Color(0xF9FFFFFF),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('전체', style: appLabelStyle()),
          const SizedBox(height: 4),
          Text('${state.totalCount}편', style: appTitleStyle(size: 27)),
        ],
      ),
    );
  }
}

class _SeriesSummary extends StatelessWidget {
  const _SeriesSummary({required this.state});
  final SeriesCollectionViewState state;

  @override
  Widget build(BuildContext context) => AppCard(
    color: const Color(0xF9FFFFFF),
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(state.query.scope.label, style: appLabelStyle()),
              const SizedBox(height: 3),
              Text(
                '${state.items.length}개 시리즈',
                style: appTitleStyle(size: 22),
              ),
            ],
          ),
        ),
        AppBadge(label: state.query.status.label),
      ],
    ),
  );
}

class _SeriesCollectionCard extends StatelessWidget {
  const _SeriesCollectionCard({required this.item});
  final SeriesCollectionItem item;

  @override
  Widget build(BuildContext context) {
    final percent = item.completionPercent;
    final canonicalId =
        item.canonicalAnimeId ?? item.items.firstOrNull?.anime.id;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CupertinoButton(
                padding: EdgeInsets.zero,
                onPressed: canonicalId == null
                    ? null
                    : () => context.push('/anime/$canonicalId'),
                child: SizedBox(
                  width: 82,
                  height: 116,
                  child: AnimePoster(url: item.coverImageUrl),
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppBadge(label: item.scope.label),
                    const SizedBox(height: 8),
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: appTitleStyle(size: 17),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      '필수 작품 ${item.completedRequiredMemberCount}/${item.requiredMemberCount} · 내 컬렉션 ${item.collectedMemberCount}편',
                      style: appLabelStyle(),
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: SizedBox(
                        key: ValueKey(
                          'series-completion-track-${item.seriesId}',
                        ),
                        height: 7,
                        child: ColoredBox(
                          color: AppColors.softBeige,
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: FractionallySizedBox(
                              key: ValueKey(
                                'series-completion-fill-${item.seriesId}',
                              ),
                              widthFactor: item.completionFraction,
                              heightFactor: 1,
                              child: const ColoredBox(color: AppColors.point),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '완주율 ${percent.toStringAsFixed(0)}%',
                      style: appLabelStyle(),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (item.items.isNotEmpty) ...[
            const SizedBox(height: 13),
            SizedBox(
              height: 76,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: item.items.length,
                separatorBuilder: (_, _) => const SizedBox(width: 7),
                itemBuilder: (context, index) {
                  final member = item.items[index];
                  return CupertinoButton(
                    padding: EdgeInsets.zero,
                    onPressed: () => context.push('/anime/${member.anime.id}'),
                    child: Stack(
                      children: [
                        SizedBox(
                          width: 54,
                          height: 76,
                          child: AnimePoster(
                            url: member.anime.coverImageUrl,
                            radius: 7,
                          ),
                        ),
                        if (member.userList != null)
                          const Positioned(
                            right: 3,
                            top: 3,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: AppColors.success,
                                shape: BoxShape.circle,
                              ),
                              child: SizedBox.square(dimension: 9),
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SeriesFilterSheet extends StatefulWidget {
  const _SeriesFilterSheet({required this.initial});
  final SeriesCollectionQuery initial;

  @override
  State<_SeriesFilterSheet> createState() => _SeriesFilterSheetState();
}

class _SeriesFilterSheetState extends State<_SeriesFilterSheet> {
  late AnimeSeriesScope scope = widget.initial.scope;
  late UserSeriesStatus status = widget.initial.status;

  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      color: AppColors.ivory,
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('시리즈 필터', style: appTitleStyle(size: 22))),
                CupertinoButton(
                  padding: EdgeInsets.zero,
                  onPressed: () => setState(() {
                    scope = AnimeSeriesScope.mainline;
                    status = UserSeriesStatus.all;
                  }),
                  child: const Text('초기화'),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text('범위', style: appLabelStyle()),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: CupertinoSlidingSegmentedControl<AnimeSeriesScope>(
                groupValue: scope,
                children: {
                  for (final value in AnimeSeriesScope.values)
                    value: Padding(
                      padding: const EdgeInsets.all(9),
                      child: Text(value.label),
                    ),
                },
                onValueChanged: (value) {
                  if (value != null) setState(() => scope = value);
                },
              ),
            ),
            const SizedBox(height: 18),
            Text('상태', style: appLabelStyle()),
            const SizedBox(height: 8),
            CupertinoSlidingSegmentedControl<UserSeriesStatus>(
              groupValue: status,
              children: {
                for (final value in UserSeriesStatus.values)
                  value: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 9,
                    ),
                    child: Text(value.label.replaceAll(' 시리즈', '')),
                  ),
              },
              onValueChanged: (value) {
                if (value != null) setState(() => status = value);
              },
            ),
            const SizedBox(height: 24),
            AppPrimaryButton(
              label: '적용하기',
              onPressed: () => Navigator.of(context).pop(
                SeriesCollectionQuery(
                  scope: scope,
                  status: status,
                  searchQuery: widget.initial.searchQuery,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class CollectionPosterCard extends StatelessWidget {
  const CollectionPosterCard({required this.entry, super.key});
  final CollectionEntry entry;

  @override
  Widget build(BuildContext context) {
    return CupertinoButton(
      padding: EdgeInsets.zero,
      pressedOpacity: 0.8,
      onPressed: () => context.push('/anime/${entry.animeId}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            key: ValueKey('collection-poster-${entry.animeId}'),
            aspectRatio: 2 / 3,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AnimePoster(url: entry.anime.coverImageUrl),
                Positioned(
                  left: 8,
                  top: 8,
                  child: AppBadge(
                    label: entry.status.label,
                    color: const Color(0xEBFFFFFF),
                  ),
                ),
                if (entry.score != null)
                  Positioned(
                    right: 8,
                    bottom: 8,
                    child: AppBadge(
                      label: '★ ${entry.score!.toStringAsFixed(1)}',
                      color: const Color(0xEE1C1917),
                      textColor: AppColors.card,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 9),
          SizedBox(
            height: 36.4,
            child: Text(
              entry.anime.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontFamily: 'Pretendard',
                fontSize: 14,
                height: 1.3,
                fontWeight: FontWeight.w600,
                color: AppColors.text,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            [
              if (entry.anime.seasonYear != null) '${entry.anime.seasonYear}',
              if (entry.anime.format != null) entry.anime.format!,
              if (entry.progress != null) '${entry.progress}화',
            ].join(' · '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: appLabelStyle(),
          ),
        ],
      ),
    );
  }
}

SliverGridDelegateWithFixedCrossAxisCount _collectionPosterGridDelegate(
  BuildContext context,
  double crossAxisExtent, {
  double mainAxisSpacing = 18,
}) {
  const crossAxisSpacing = 12.0;
  final crossAxisCount = AppLayout.posterGridCount(context);
  final posterWidth =
      (crossAxisExtent - crossAxisSpacing * (crossAxisCount - 1)) /
      crossAxisCount;
  return SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: crossAxisCount,
    mainAxisSpacing: mainAxisSpacing,
    crossAxisSpacing: crossAxisSpacing,
    mainAxisExtent: posterWidth * 1.5 + 66,
  );
}

class CollectionFilterSheet extends StatefulWidget {
  const CollectionFilterSheet({required this.initial, super.key});
  final CollectionQuery initial;

  @override
  State<CollectionFilterSheet> createState() => _CollectionFilterSheetState();
}

class _CollectionFilterSheetState extends State<CollectionFilterSheet> {
  late String sort = widget.initial.sort;
  late String? genre = widget.initial.genre;
  late int? year = widget.initial.year;
  late int? score = widget.initial.score;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 520,
      decoration: const BoxDecoration(
        color: AppColors.ivory,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 5,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: Text('정렬과 필터', style: appTitleStyle(size: 23)),
                  ),
                  CupertinoButton(
                    padding: EdgeInsets.zero,
                    onPressed: () => setState(() {
                      sort = 'latest';
                      genre = null;
                      year = null;
                      score = null;
                    }),
                    child: const Text('초기화'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text('정렬', style: appLabelStyle()),
              const SizedBox(height: 8),
              CupertinoSlidingSegmentedControl<String>(
                groupValue: sort,
                thumbColor: AppColors.card,
                backgroundColor: AppColors.softBeige,
                children: const {
                  'latest': Padding(
                    padding: EdgeInsets.all(8),
                    child: Text('최근'),
                  ),
                  'added': Padding(
                    padding: EdgeInsets.all(8),
                    child: Text('추가'),
                  ),
                  'score': Padding(
                    padding: EdgeInsets.all(8),
                    child: Text('평점↓'),
                  ),
                  'scoreAsc': Padding(
                    padding: EdgeInsets.all(8),
                    child: Text('평점↑'),
                  ),
                },
                onValueChanged: (value) {
                  if (value != null) setState(() => sort = value);
                },
              ),
              const SizedBox(height: 18),
              _FilterRow(
                label: '장르',
                value: genre == null ? '전체' : genreLabel(genre),
                onTap: () => _pickString(
                  title: '장르',
                  values: const [null, ..._genres],
                  labels: ['전체', ..._genres.map(genreLabel)],
                  current: genre,
                  onSelected: (value) => setState(() => genre = value),
                ),
              ),
              _FilterRow(
                label: '방영 연도',
                value: year?.toString() ?? '전체',
                onTap: () {
                  final years = <int?>[
                    null,
                    for (
                      var value = DateTime.now().year;
                      value >= 1960;
                      value--
                    )
                      value,
                  ];
                  _pickString<int>(
                    title: '방영 연도',
                    values: years,
                    labels: years
                        .map((value) => value?.toString() ?? '전체')
                        .toList(),
                    current: year,
                    onSelected: (value) => setState(() => year = value),
                  );
                },
              ),
              _FilterRow(
                label: '내 평점대',
                value: score == null ? '전체' : '$score점대',
                onTap: () => _pickString<int>(
                  title: '평점대',
                  values: const [null, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
                  labels: const [
                    '전체',
                    '10점',
                    '9점대',
                    '8점대',
                    '7점대',
                    '6점대',
                    '5점대',
                    '4점대',
                    '3점대',
                    '2점대',
                    '1점대',
                  ],
                  current: score,
                  onSelected: (value) => setState(() => score = value),
                ),
              ),
              const Spacer(),
              AppPrimaryButton(
                label: '적용하기',
                onPressed: () => Navigator.of(context).pop(
                  CollectionQuery(
                    sort: sort,
                    genre: genre,
                    year: year,
                    score: score,
                    searchQuery: widget.initial.searchQuery,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickString<T>({
    required String title,
    required List<T?> values,
    required List<String> labels,
    required T? current,
    required ValueChanged<T?> onSelected,
  }) async {
    var index = values.indexOf(current);
    if (index < 0) index = 0;
    final controller = FixedExtentScrollController(initialItem: index);
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (context) => Container(
        height: 330,
        color: AppColors.card,
        child: SafeArea(
          top: false,
          child: Column(
            children: [
              SizedBox(
                height: 48,
                child: Row(
                  children: [
                    const SizedBox(width: 16),
                    Expanded(
                      child: Text(title, style: appTitleStyle(size: 17)),
                    ),
                    CupertinoButton(
                      child: const Text('완료'),
                      onPressed: () {
                        onSelected(values[controller.selectedItem]);
                        Navigator.of(context).pop();
                      },
                    ),
                  ],
                ),
              ),
              Expanded(
                child: CupertinoPicker(
                  scrollController: controller,
                  itemExtent: 42,
                  onSelectedItemChanged: (_) {},
                  children: labels
                      .map((label) => Center(child: Text(label)))
                      .toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    controller.dispose();
  }
}

class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.label,
    required this.value,
    required this.onTap,
  });
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(vertical: 4),
      onPressed: onTap,
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppRadii.input),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontFamily: 'Pretendard',
                  color: AppColors.text,
                ),
              ),
            ),
            Text(
              value,
              style: const TextStyle(
                fontFamily: 'Pretendard',
                color: AppColors.mutedText,
              ),
            ),
            const SizedBox(width: 6),
            const Icon(
              CupertinoIcons.chevron_down,
              size: 16,
              color: AppColors.mutedText,
            ),
          ],
        ),
      ),
    );
  }
}

const _genres = <String>[
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

class AnimeSearchScreen extends ConsumerStatefulWidget {
  const AnimeSearchScreen({super.key});

  @override
  ConsumerState<AnimeSearchScreen> createState() => _AnimeSearchScreenState();
}

class _AnimeSearchScreenState extends ConsumerState<AnimeSearchScreen> {
  late final TextEditingController _controller = TextEditingController();
  late final ScrollController _scrollController = ScrollController()
    ..addListener(() {
      if (_scrollController.position.extentAfter < 450) {
        ref.read(searchControllerProvider.notifier).loadMore();
      }
    });

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(searchControllerProvider);
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    return CupertinoPageScaffold(
      resizeToAvoidBottomInset: false,
      child: AppBackground(
        child: AppContentWidth(
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
              const AppCompactSliverHeader(title: '작품 탐색'),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                sliver: SliverList.list(
                  children: [
                    CupertinoSearchTextField(
                      controller: _controller,
                      autofocus: false,
                      placeholder: '한국어·영문·일본어 제목 검색',
                      onChanged: ref
                          .read(searchControllerProvider.notifier)
                          .setQuery,
                    ),
                    const SizedBox(height: 10),
                    _SearchFilters(state: state),
                    const SizedBox(height: 8),
                    Text(
                      '포스터를 길게 누르면 빠르게 별점을 남길 수 있어요.',
                      style: appLabelStyle(),
                    ),
                  ],
                ),
              ),
              if (state.loading)
                const SliverPadding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverToBoxAdapter(child: AppSkeleton(height: 220)),
                )
              else if (state.failure != null && state.items.isEmpty)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverToBoxAdapter(
                    child: AppStateView(
                      title: '작품을 불러오지 못했습니다',
                      message: state.failure!.message,
                      actionLabel: '다시 시도',
                      onAction: ref
                          .read(searchControllerProvider.notifier)
                          .refresh,
                    ),
                  ),
                )
              else if (state.items.isEmpty)
                const SliverPadding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverToBoxAdapter(
                    child: AppStateView(
                      title: '검색 결과가 없습니다',
                      message: '다른 제목이나 원어 제목으로 다시 검색해보세요.',
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverGrid(
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: AppLayout.posterGridCount(context),
                      mainAxisSpacing: 18,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.55,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) =>
                          _SearchResultCard(result: state.items[index]),
                      childCount: state.items.length,
                    ),
                  ),
                ),
              if (state.loadingMore)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.only(bottom: 24),
                    child: Center(child: CupertinoActivityIndicator()),
                  ),
                ),
              SliverToBoxAdapter(
                child: SizedBox(
                  key: const ValueKey('search-keyboard-spacer'),
                  height: keyboardInset,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SearchFilters extends ConsumerWidget {
  const _SearchFilters({required this.state});
  final SearchViewState state;

  static const sorts = <String, String>{
    'popularity': '인기순',
    'score': '평점순',
    'latest': '최신순',
    'season': '시즌순',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) => Row(
    children: [
      Expanded(
        child: _FilterButton(
          label: sorts[state.sort] ?? '인기순',
          onPressed: () => _showSearchChoice(
            context,
            title: '정렬',
            values: sorts,
            selected: state.sort,
            onSelected: ref.read(searchControllerProvider.notifier).setSort,
          ),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _FilterButton(
          label: state.genre == null ? '전체 장르' : genreLabel(state.genre),
          onPressed: () => _showSearchChoice(
            context,
            title: '장르',
            values: {
              '': '전체 장르',
              for (final genre in _genres) genre: genreLabel(genre),
            },
            selected: state.genre ?? '',
            onSelected: (value) => ref
                .read(searchControllerProvider.notifier)
                .setGenre(value.isEmpty ? null : value),
          ),
        ),
      ),
    ],
  );
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.label, required this.onPressed});
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => CupertinoButton(
    color: AppColors.card,
    borderRadius: BorderRadius.circular(AppRadii.input),
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    onPressed: onPressed,
    child: Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Flexible(
          child: Text(
            label,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 5),
        const Icon(CupertinoIcons.chevron_down, size: 14),
      ],
    ),
  );
}

Future<void> _showSearchChoice(
  BuildContext context, {
  required String title,
  required Map<String, String> values,
  required String selected,
  required ValueChanged<String> onSelected,
}) => showCupertinoModalPopup<void>(
  context: context,
  builder: (context) => CupertinoActionSheet(
    title: Text(title),
    actions: [
      for (final entry in values.entries)
        CupertinoActionSheetAction(
          isDefaultAction: entry.key == selected,
          onPressed: () {
            Navigator.of(context).pop();
            onSelected(entry.key);
          },
          child: Text(entry.value),
        ),
    ],
    cancelButton: CupertinoActionSheetAction(
      onPressed: () => Navigator.of(context).pop(),
      child: const Text('취소'),
    ),
  ),
);

class _SearchResultCard extends ConsumerStatefulWidget {
  const _SearchResultCard({required this.result});
  final AnimeSearchResult result;

  @override
  ConsumerState<_SearchResultCard> createState() => _SearchResultCardState();
}

class _SearchResultCardState extends ConsumerState<_SearchResultCard> {
  bool _showRating = false;

  @override
  Widget build(BuildContext context) {
    final result = widget.result;
    final anime = result.anime;
    final exists = result.myCollection?.exists == true;
    final completed = result.myCollection?.status == CollectionStatus.completed;
    final searchState = ref.watch(searchControllerProvider);
    final rating = searchState.ratingAnimeId == anime.id;
    return GestureDetector(
      onLongPress: () => setState(() => _showRating = true),
      child: CupertinoButton(
        padding: EdgeInsets.zero,
        pressedOpacity: 0.8,
        onPressed: () => context.push('/anime/${anime.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  AnimePoster(url: anime.coverImageUrl),
                  Positioned(
                    right: 8,
                    top: 8,
                    child: completed
                        ? Semantics(
                            label: '완료한 작품',
                            child: const DecoratedBox(
                              decoration: BoxDecoration(
                                color: AppColors.successSoft,
                                shape: BoxShape.circle,
                              ),
                              child: SizedBox.square(
                                key: ValueKey('completed-anime-check'),
                                dimension: 44,
                                child: Icon(
                                  CupertinoIcons.check_mark,
                                  size: 21,
                                  color: AppColors.success,
                                ),
                              ),
                            ),
                          )
                        : CupertinoButton(
                            padding: EdgeInsets.zero,
                            minimumSize: const Size.square(44),
                            borderRadius: BorderRadius.circular(99),
                            color: exists
                                ? const Color(0xF2FFF7E7)
                                : const Color(0xEEDE851D),
                            onPressed: () =>
                                showCollectionEditor(context, anime),
                            child: Icon(
                              exists
                                  ? CupertinoIcons.pencil
                                  : CupertinoIcons.add,
                              size: 20,
                              color: exists
                                  ? AppColors.pointPressed
                                  : AppColors.card,
                            ),
                          ),
                  ),
                  if (exists)
                    Positioned(
                      left: 8,
                      bottom: 8,
                      child: AppBadge(
                        label: result.myCollection?.status?.label ?? '등록됨',
                        color: const Color(0xF2FFFFFF),
                      ),
                    ),
                  if (_showRating)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: _QuickRatingOverlay(
                        score: result.myCollection?.score ?? 0,
                        loading: rating,
                        onRate: _rate,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 9),
            Text(
              anime.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontFamily: 'Pretendard',
                fontSize: 14,
                height: 1.3,
                fontWeight: FontWeight.w600,
                color: AppColors.text,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              [
                if (anime.seasonYear != null) '${anime.seasonYear}',
                if (anime.format != null) anime.format!,
                if (anime.episodes != null) '${anime.episodes}화',
              ].join(' · '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: appLabelStyle(),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _rate(int score) async {
    try {
      await ref
          .read(searchControllerProvider.notifier)
          .quickRate(widget.result, score);
      invalidateUserData(ref);
      if (mounted) {
        setState(() => _showRating = false);
        showAppToast(context, '$score점으로 컬렉션에 저장했습니다.');
      }
    } on ApiFailure catch (error) {
      if (mounted) showAppToast(context, error.message, error: true);
    } on Object catch (error) {
      if (mounted) showAppToast(context, error.toString(), error: true);
    }
  }
}

class _QuickRatingOverlay extends StatelessWidget {
  const _QuickRatingOverlay({
    required this.score,
    required this.loading,
    required this.onRate,
  });
  final double score;
  final bool loading;
  final ValueChanged<int> onRate;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0x001C1917), Color(0xE61C1917)],
      ),
    ),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(8, 30, 8, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (loading)
            const CupertinoActivityIndicator(color: CupertinoColors.white)
          else
            for (var index = 0; index < 5; index++)
              _HalfStar(index: index, score: score, onSelected: onRate),
        ],
      ),
    ),
  );
}

class _HalfStar extends StatelessWidget {
  const _HalfStar({
    required this.index,
    required this.score,
    required this.onSelected,
  });
  final int index;
  final double score;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final fill = (score / 2 - index).clamp(0.0, 1.0);
    return SizedBox.square(
      dimension: 30,
      child: Stack(
        children: [
          const Center(
            child: Icon(
              CupertinoIcons.star_fill,
              size: 25,
              color: Color(0x66FFFFFF),
            ),
          ),
          ClipRect(
            child: Align(
              alignment: Alignment.centerLeft,
              widthFactor: fill,
              child: const Icon(
                CupertinoIcons.star_fill,
                size: 25,
                color: Color(0xFFFFD166),
              ),
            ),
          ),
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            width: 15,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onSelected(index * 2 + 1),
            ),
          ),
          Positioned(
            right: 0,
            top: 0,
            bottom: 0,
            width: 15,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onSelected(index * 2 + 2),
            ),
          ),
        ],
      ),
    );
  }
}

class AnimeDetailScreen extends ConsumerWidget {
  const AnimeDetailScreen({required this.animeId, super.key});
  final int animeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(animeDetailProvider(animeId));
    return CupertinoPageScaffold(
      child: AppBackground(
        child: detail.when(
          loading: () => const SafeArea(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                children: [
                  AppSkeleton(height: 330),
                  SizedBox(height: 16),
                  AppSkeleton(height: 180),
                ],
              ),
            ),
          ),
          error: (error, _) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: AppStateView(
                title: '작품 정보를 불러오지 못했습니다',
                message: error.toString(),
                actionLabel: '다시 시도',
                onAction: () => ref.invalidate(animeDetailProvider(animeId)),
              ),
            ),
          ),
          data: (anime) => _AnimeDetailContent(anime: anime),
        ),
      ),
    );
  }
}

class _AnimeDetailContent extends ConsumerWidget {
  const _AnimeDetailContent({required this.anime});
  final Anime anime;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cast = ref.watch(animeCastProvider(anime.id));
    final entry = ref.watch(collectionEntryProvider(anime.id));
    return AppContentWidth(
      child: Stack(
        children: [
          CustomScrollView(
            slivers: [
              AppCompactSliverHeader(
                title: anime.title,
                leading: CupertinoButton(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size.square(44),
                  onPressed: () => Navigator.of(context).maybePop(),
                  child: const Icon(
                    CupertinoIcons.back,
                    color: AppColors.pointPressed,
                  ),
                ),
                trailing: entry.value == null
                    ? null
                    : const Icon(
                        CupertinoIcons.check_mark_circled_solid,
                        color: AppColors.success,
                      ),
              ),
              SliverToBoxAdapter(child: _DetailHero(anime: anime)),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 120),
                sliver: SliverList.list(
                  children: [
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const AppSectionHeader(
                            title: '작품 정보',
                            eyebrow: 'About',
                          ),
                          const SizedBox(height: 14),
                          _AnimeFactGrid(anime: anime),
                          if (anime.genres.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text('장르', style: appLabelStyle()),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                for (final genre in anime.genres)
                                  AppBadge(label: genreLabel(genre)),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const AppSectionHeader(
                            title: '캐릭터 · 일본어 성우',
                            eyebrow: 'Voice cast',
                          ),
                          const SizedBox(height: 14),
                          cast.when(
                            loading: () => const AppSkeleton(height: 92),
                            error: (error, _) => AppStateView(
                              compact: true,
                              title: '캐스트를 불러오지 못했습니다',
                              message: error.toString(),
                              actionLabel: '재시도',
                              onAction: () =>
                                  ref.invalidate(animeCastProvider(anime.id)),
                            ),
                            data: (items) => items.isEmpty
                                ? const Text('등록된 성우 정보가 없습니다.')
                                : SizedBox(
                                    height: 166,
                                    child: ListView.separated(
                                      scrollDirection: Axis.horizontal,
                                      itemCount: items.length,
                                      separatorBuilder: (_, _) =>
                                          const SizedBox(width: 12),
                                      itemBuilder: (context, index) {
                                        final item = items[index];
                                        return SizedBox(
                                          width: 152,
                                          child: Column(
                                            children: [
                                              Row(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  ClipOval(
                                                    child: SizedBox.square(
                                                      dimension: 62,
                                                      child: AppNetworkImage(
                                                        url: item
                                                            .characterImageUrl,
                                                        profile: true,
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  ClipOval(
                                                    child: SizedBox.square(
                                                      dimension: 62,
                                                      child: AppNetworkImage(
                                                        url: item
                                                            .voiceActorImageUrl,
                                                        profile: true,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 8),
                                              Text(
                                                item.characterName,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontFamily: 'Pretendard',
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w600,
                                                  color: AppColors.text,
                                                ),
                                              ),
                                              Text(
                                                item.voiceActorName,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontFamily: 'Pretendard',
                                                  fontSize: 12,
                                                  color: AppColors.pointPressed,
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: DecoratedBox(
              decoration: const BoxDecoration(
                color: Color(0xF7FFFFFF),
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: SafeArea(
                top: false,
                minimum: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: AppPrimaryButton(
                  label: entry.value == null ? '내 컬렉션에 추가' : '내 기록 수정',
                  icon: Icon(
                    entry.value == null
                        ? CupertinoIcons.add
                        : CupertinoIcons.pencil,
                    color: AppColors.card,
                    size: 19,
                  ),
                  onPressed: entry.isLoading
                      ? null
                      : () => showCollectionEditor(context, anime),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AnimeFactGrid extends StatelessWidget {
  const _AnimeFactGrid({required this.anime});

  final Anime anime;

  @override
  Widget build(BuildContext context) {
    final facts = <({IconData icon, String label, String value})>[
      if (anime.seasonYear != null)
        (
          icon: CupertinoIcons.calendar,
          label: '방영 연도',
          value: '${anime.seasonYear}년',
        ),
      if (anime.format != null)
        (
          icon: CupertinoIcons.film,
          label: '형식',
          value: animeFormatLabel(anime.format),
        ),
      if (anime.episodes != null)
        (
          icon: CupertinoIcons.play_rectangle,
          label: '에피소드',
          value: '${anime.episodes}화',
        ),
      if (anime.duration != null)
        (
          icon: CupertinoIcons.clock,
          label: '상영 시간',
          value: '회당 ${anime.duration}분',
        ),
      if (anime.averageScore != null)
        (
          icon: CupertinoIcons.star_fill,
          label: '커뮤니티 평점',
          value: '${anime.averageScore!.toStringAsFixed(0)}점',
        ),
    ];
    if (facts.isEmpty) {
      return Text('등록된 작품 정보가 없습니다.', style: appLabelStyle());
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        final tileWidth = (constraints.maxWidth - 10) / 2;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final fact in facts)
              SizedBox(
                width: tileWidth,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.neutral,
                    borderRadius: BorderRadius.circular(AppRadii.input),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        DecoratedBox(
                          decoration: const BoxDecoration(
                            color: AppColors.pointSoft,
                            shape: BoxShape.circle,
                          ),
                          child: SizedBox.square(
                            dimension: 34,
                            child: Icon(
                              fact.icon,
                              size: 17,
                              color: AppColors.pointPressed,
                            ),
                          ),
                        ),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(fact.label, style: appLabelStyle()),
                              const SizedBox(height: 2),
                              Text(
                                fact.value,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: appTitleStyle(size: 14),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _DetailHero extends StatelessWidget {
  const _DetailHero({required this.anime});
  final Anime anime;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 350,
      child: Stack(
        fit: StackFit.expand,
        children: [
          AppNetworkImage(url: anime.bannerImageUrl ?? anime.coverImageUrl),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x18000000), Color(0xE81C1917)],
              ),
            ),
          ),
          Positioned(
            left: 18,
            right: 18,
            bottom: 20,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                SizedBox(
                  width: 104,
                  child: AnimePoster(url: anime.coverImageUrl, radius: 12),
                ),
                const SizedBox(width: 15),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const AppBadge(label: 'ANIME', color: Color(0xD9FEF3C7)),
                      const SizedBox(height: 9),
                      Text(
                        anime.title,
                        maxLines: 4,
                        overflow: TextOverflow.ellipsis,
                        style: appTitleStyle(size: 24, color: AppColors.card),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> showCollectionEditor(BuildContext context, Anime anime) async {
  await context.push('/anime/${anime.id}/edit');
}

class CollectionEditorRouteScreen extends ConsumerWidget {
  const CollectionEditorRouteScreen({required this.animeId, super.key});
  final int animeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(animeDetailProvider(animeId));
    final entry = ref.watch(collectionEntryProvider(animeId));
    if (detail.isLoading || entry.isLoading) {
      return const CupertinoPageScaffold(
        child: AppBackground(
          child: Center(child: CupertinoActivityIndicator()),
        ),
      );
    }
    final error = detail.error ?? entry.error;
    if (error != null) {
      return CupertinoPageScaffold(
        child: AppBackground(
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: AppStateView(
                title: '기록 편집기를 열지 못했습니다',
                message: error.toString(),
                actionLabel: '다시 시도',
                onAction: () {
                  ref.invalidate(animeDetailProvider(animeId));
                  ref.invalidate(collectionEntryProvider(animeId));
                },
              ),
            ),
          ),
        ),
      );
    }
    return CupertinoPageScaffold(
      child: AppBackground(
        child: AppContentWidth(
          maxWidth: AppLayout.formMaxWidth,
          alignment: Alignment.bottomCenter,
          child: CollectionEditorSheet(
            anime: detail.requireValue,
            existing: entry.requireValue,
          ),
        ),
      ),
    );
  }
}

class CollectionEditorSheet extends ConsumerStatefulWidget {
  const CollectionEditorSheet({required this.anime, this.existing, super.key});
  final Anime anime;
  final CollectionEntry? existing;

  @override
  ConsumerState<CollectionEditorSheet> createState() =>
      _CollectionEditorSheetState();
}

class _CollectionEditorSheetState extends ConsumerState<CollectionEditorSheet> {
  late CollectionStatus _status =
      widget.existing?.status ?? CollectionStatus.planned;
  late double? _score = widget.existing?.score;
  late int _progress = widget.existing?.progress ?? 0;
  late DateTime? _startedAt = _parseDate(widget.existing?.startedAt);
  late DateTime? _completedAt = _parseDate(widget.existing?.completedAt);
  late final TextEditingController _notes = TextEditingController(
    text: widget.existing?.notes,
  );
  bool _saving = false;

  static DateTime? _parseDate(String? value) =>
      value == null ? null : DateTime.tryParse(value);

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final maxProgress = widget.anime.episodes;
    return Container(
      height: MediaQuery.sizeOf(context).height * 0.9,
      decoration: const BoxDecoration(
        color: AppColors.ivory,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.existing == null ? '컬렉션에 추가' : '내 기록 수정',
                      style: appTitleStyle(size: 22),
                    ),
                  ),
                  CupertinoButton(
                    padding: const EdgeInsets.all(10),
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Icon(
                      CupertinoIcons.xmark_circle_fill,
                      color: AppColors.mutedText,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  Row(
                    children: [
                      SizedBox(
                        width: 74,
                        child: AnimePoster(
                          url: widget.anime.coverImageUrl,
                          radius: 10,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Text(
                          widget.anime.title,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: appTitleStyle(size: 18),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  Text('상태', style: appLabelStyle()),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: CollectionStatus.values.map((status) {
                      final selected = status == _status;
                      return CupertinoButton(
                        minimumSize: const Size(42, 42),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 13,
                          vertical: 9,
                        ),
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                        color: selected ? AppColors.pointSoft : AppColors.card,
                        onPressed: () => setState(() => _status = status),
                        child: Text(
                          status.label,
                          style: TextStyle(
                            fontFamily: 'Pretendard',
                            fontWeight: FontWeight.w600,
                            color: selected
                                ? AppColors.pointPressed
                                : AppColors.secondaryText,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(child: Text('내 평점', style: appLabelStyle())),
                      if (_score != null)
                        CupertinoButton(
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(32, 32),
                          onPressed: () => setState(() => _score = null),
                          child: const Text('지우기'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 45,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: 10,
                      separatorBuilder: (_, _) => const SizedBox(width: 7),
                      itemBuilder: (context, index) {
                        final value = index + 1.0;
                        final selected = _score == value;
                        return CupertinoButton(
                          minimumSize: const Size(42, 42),
                          padding: EdgeInsets.zero,
                          borderRadius: BorderRadius.circular(12),
                          color: selected ? AppColors.point : AppColors.card,
                          onPressed: () => setState(() => _score = value),
                          child: Text(
                            '${index + 1}',
                            style: TextStyle(
                              fontFamily: 'Pretendard',
                              fontWeight: FontWeight.w700,
                              color: selected ? AppColors.card : AppColors.text,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text('진행도', style: appLabelStyle()),
                  const SizedBox(height: 8),
                  Container(
                    height: 52,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(AppRadii.input),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        CupertinoButton(
                          padding: const EdgeInsets.all(8),
                          onPressed: _progress > 0
                              ? () => setState(() => _progress--)
                              : null,
                          child: const Icon(CupertinoIcons.minus_circle),
                        ),
                        Expanded(
                          child: Text(
                            maxProgress == null
                                ? '$_progress화'
                                : '$_progress / $maxProgress화',
                            textAlign: TextAlign.center,
                            style: appTitleStyle(size: 16),
                          ),
                        ),
                        CupertinoButton(
                          padding: const EdgeInsets.all(8),
                          onPressed:
                              maxProgress == null || _progress < maxProgress
                              ? () => setState(() => _progress++)
                              : null,
                          child: const Icon(CupertinoIcons.add_circled),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _DateField(
                          label: '시작일',
                          value: _startedAt,
                          onTap: () => _pickDate(true),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _DateField(
                          label: '완료일',
                          value: _completedAt,
                          onTap: () => _pickDate(false),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text('메모', style: appLabelStyle()),
                  const SizedBox(height: 8),
                  CupertinoTextField(
                    controller: _notes,
                    minLines: 3,
                    maxLines: 6,
                    maxLength: 1000,
                    placeholder: '감상 메모를 남겨보세요.',
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(AppRadii.input),
                      border: Border.all(color: AppColors.border),
                    ),
                  ),
                  if (widget.existing != null) ...[
                    const SizedBox(height: 22),
                    AppSecondaryButton(
                      label: '컬렉션에서 삭제',
                      destructive: true,
                      icon: CupertinoIcons.delete,
                      onPressed: _saving ? null : _delete,
                    ),
                  ],
                ],
              ),
            ),
            DecoratedBox(
              decoration: const BoxDecoration(
                color: Color(0xF7FFFFFF),
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: AppPrimaryButton(
                  label: widget.existing == null ? '컬렉션에 추가' : '변경사항 저장',
                  loading: _saving,
                  onPressed: _save,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickDate(bool started) async {
    var value = (started ? _startedAt : _completedAt) ?? DateTime.now();
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (context) => Container(
        height: 360,
        color: AppColors.card,
        child: SafeArea(
          top: false,
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  CupertinoButton(
                    child: const Text('날짜 지우기'),
                    onPressed: () {
                      setState(() {
                        if (started) {
                          _startedAt = null;
                        } else {
                          _completedAt = null;
                        }
                      });
                      Navigator.of(context).pop();
                    },
                  ),
                  CupertinoButton(
                    child: const Text('완료'),
                    onPressed: () {
                      setState(() {
                        if (started) {
                          _startedAt = value;
                        } else {
                          _completedAt = value;
                        }
                      });
                      Navigator.of(context).pop();
                    },
                  ),
                ],
              ),
              Expanded(
                child: CupertinoDatePicker(
                  mode: CupertinoDatePickerMode.date,
                  initialDateTime: value,
                  maximumDate: DateTime.now().add(const Duration(days: 1)),
                  onDateTimeChanged: (next) => value = next,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  CollectionDraft get _draft => CollectionDraft(
    status: _status,
    score: _score,
    progress: _progress,
    startedAt: _startedAt == null
        ? null
        : DateFormat('yyyy-MM-dd').format(_startedAt!),
    completedAt: _completedAt == null
        ? null
        : DateFormat('yyyy-MM-dd').format(_completedAt!),
    notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
  );

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final repository = ref.read(collectionRepositoryProvider);
      if (widget.existing == null) {
        await repository.add(widget.anime.id, _draft);
      } else {
        await repository.update(widget.anime.id, _draft);
      }
      ref.invalidate(collectionEntryProvider(widget.anime.id));
      invalidateUserData(ref);
      if (!mounted) return;
      Navigator.of(context).pop();
      showAppToast(context, '내 기록을 저장했습니다.');
    } on ApiFailure catch (error) {
      if (mounted) showAppToast(context, error.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showAppConfirmation(
      context,
      title: '컬렉션에서 삭제할까요?',
      message: '저장한 상태, 평점, 진행도와 메모가 함께 삭제됩니다.',
      confirmLabel: '삭제',
      destructive: true,
    );
    if (!confirmed) return;
    setState(() => _saving = true);
    try {
      await ref.read(collectionRepositoryProvider).remove(widget.anime.id);
      ref.invalidate(collectionEntryProvider(widget.anime.id));
      invalidateUserData(ref);
      if (!mounted) return;
      Navigator.of(context).pop();
      showAppToast(context, '컬렉션에서 삭제했습니다.');
    } on ApiFailure catch (error) {
      if (mounted) showAppToast(context, error.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.onTap,
  });
  final String label;
  final DateTime? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return CupertinoButton(
      padding: const EdgeInsets.all(12),
      color: AppColors.card,
      borderRadius: BorderRadius.circular(AppRadii.input),
      onPressed: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: appLabelStyle()),
          const SizedBox(height: 5),
          Text(
            value == null ? '선택 안 함' : DateFormat('yyyy.MM.dd').format(value!),
            style: const TextStyle(
              fontFamily: 'Pretendard',
              fontWeight: FontWeight.w600,
              color: AppColors.text,
            ),
          ),
        ],
      ),
    );
  }
}
