import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:myanitrack_mobile/src/api.dart';
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
  late final ScrollController _scrollController = ScrollController()
    ..addListener(_onScroll);

  void _onScroll() {
    if (_scrollController.position.extentAfter < 500) {
      ref.read(collectionControllerProvider.notifier).loadMore();
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(collectionControllerProvider);
    return CupertinoPageScaffold(
      child: AppBackground(
        child: CustomScrollView(
          controller: _scrollController,
          slivers: [
            CupertinoSliverNavigationBar(
              largeTitle: const Text('내 컬렉션'),
              backgroundColor: const Color(0xEFFFFFFF),
              border: const Border(bottom: BorderSide(color: AppColors.border)),
              trailing: CupertinoButton(
                padding: EdgeInsets.zero,
                minimumSize: const Size.square(44),
                onPressed: () => _openFilters(context, state.query),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(CupertinoIcons.slider_horizontal_3),
                    if (state.query.genre != null ||
                        state.query.year != null ||
                        state.query.score != null)
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
              onRefresh: ref
                  .read(collectionControllerProvider.notifier)
                  .refresh,
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              sliver: SliverToBoxAdapter(
                child: _CollectionSummary(state: state),
              ),
            ),
            if (state.loading && state.items.isEmpty)
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 14,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.57,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (_, _) => const AppSkeleton(height: 250),
                    childCount: 6,
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
                    title: '아직 기록한 작품이 없습니다',
                    message: '검색 탭에서 첫 작품을 찾아 컬렉션을 시작해보세요.',
                    actionLabel: '작품 검색하기',
                    onAction: () => context.go('/search'),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 18,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.55,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) =>
                        CollectionPosterCard(entry: state.items[index]),
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
          ],
        ),
      ),
    );
  }

  Future<void> _openFilters(BuildContext context, CollectionQuery query) async {
    final next = await showCupertinoModalPopup<CollectionQuery>(
      context: context,
      builder: (context) => CollectionFilterSheet(initial: query),
    );
    if (next != null) {
      await ref.read(collectionControllerProvider.notifier).setQuery(next);
    }
  }
}

class _CollectionSummary extends StatelessWidget {
  const _CollectionSummary({required this.state});
  final CollectionViewState state;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      color: const Color(0xF9FFFFFF),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('현재 불러온 기록', style: appLabelStyle()),
                const SizedBox(height: 4),
                Text(
                  '${state.items.length}편${state.pageInfo.hasNext ? ' +' : ''}',
                  style: appTitleStyle(size: 27),
                ),
              ],
            ),
          ),
          AppBadge(label: _sortLabel(state.query.sort)),
        ],
      ),
    );
  }
}

String _sortLabel(String value) => switch (value) {
  'added' => '추가순',
  'score' => '높은 평점순',
  'scoreAsc' => '낮은 평점순',
  _ => '최근 활동순',
};

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
          Expanded(
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
          Text(
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
                value: genre ?? '전체',
                onTap: () => _pickString(
                  title: '장르',
                  values: const [null, ..._genres],
                  labels: const ['전체', ..._genres],
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
    return CupertinoPageScaffold(
      child: AppBackground(
        child: CustomScrollView(
          controller: _scrollController,
          slivers: [
            const CupertinoSliverNavigationBar(
              largeTitle: Text('작품 검색'),
              backgroundColor: Color(0xEFFFFFFF),
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
              sliver: SliverToBoxAdapter(
                child: CupertinoSearchTextField(
                  controller: _controller,
                  autofocus: false,
                  placeholder: '한국어·영문·일본어 제목 검색',
                  onChanged: ref
                      .read(searchControllerProvider.notifier)
                      .setQuery,
                ),
              ),
            ),
            if (state.query.length < 2)
              const SliverPadding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverToBoxAdapter(
                  child: AppStateView(
                    compact: true,
                    icon: CupertinoIcons.search,
                    title: '찾고 싶은 작품을 입력해주세요',
                    message: '두 글자 이상 입력하면 내 컬렉션 등록 여부와 함께 표시됩니다.',
                  ),
                ),
              )
            else if (state.loading)
              const SliverPadding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverToBoxAdapter(child: AppSkeleton(height: 220)),
              )
            else if (state.failure != null)
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverToBoxAdapter(
                  child: AppStateView(
                    title: '검색하지 못했습니다',
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
                sliver: SliverList.separated(
                  itemCount: state.items.length,
                  itemBuilder: (context, index) =>
                      _SearchResultRow(result: state.items[index]),
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                ),
              ),
            if (state.loadingMore)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.only(bottom: 24),
                  child: Center(child: CupertinoActivityIndicator()),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SearchResultRow extends ConsumerWidget {
  const _SearchResultRow({required this.result});
  final AnimeSearchResult result;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final anime = result.anime;
    final exists = result.myCollection?.exists == true;
    return AppCard(
      padding: const EdgeInsets.all(10),
      onTap: () => context.push('/anime/${anime.id}'),
      child: Row(
        children: [
          SizedBox(
            width: 70,
            child: AnimePoster(url: anime.coverImageUrl, radius: 11),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  anime.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: appTitleStyle(size: 16),
                ),
                const SizedBox(height: 7),
                Text(
                  [
                    if (anime.seasonYear != null) '${anime.seasonYear}',
                    if (anime.format != null) anime.format!,
                    if (anime.episodes != null) '${anime.episodes}화',
                  ].join(' · '),
                  style: appLabelStyle(),
                ),
                if (exists) ...[
                  const SizedBox(height: 8),
                  AppBadge(
                    label: result.myCollection?.status?.label ?? '컬렉션에 있음',
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          CupertinoButton(
            padding: const EdgeInsets.all(10),
            minimumSize: const Size.square(44),
            borderRadius: BorderRadius.circular(99),
            color: exists ? AppColors.pointSoft : AppColors.point,
            onPressed: () => showCollectionEditor(context, anime),
            child: Icon(
              exists ? CupertinoIcons.pencil : CupertinoIcons.add,
              size: 19,
              color: exists ? AppColors.pointPressed : AppColors.card,
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
    return Stack(
      children: [
        CustomScrollView(
          slivers: [
            CupertinoSliverNavigationBar(
              largeTitle: const SizedBox.shrink(),
              backgroundColor: const Color(0xEFFFFFFF),
              previousPageTitle: '뒤로',
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
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            if (anime.seasonYear != null)
                              AppBadge(label: '${anime.seasonYear}'),
                            if (anime.format != null)
                              AppBadge(label: anime.format!),
                            if (anime.episodes != null)
                              AppBadge(label: '${anime.episodes}화'),
                            if (anime.duration != null)
                              AppBadge(label: '회당 ${anime.duration}분'),
                            if (anime.averageScore != null)
                              AppBadge(
                                label:
                                    '커뮤니티 ${anime.averageScore!.toStringAsFixed(0)}',
                              ),
                          ],
                        ),
                        if (anime.description != null) ...[
                          const SizedBox(height: 16),
                          Text(
                            anime.description!
                                .replaceAll(RegExp('<[^>]*>'), '')
                                .replaceAll('&quot;', '"'),
                            style: const TextStyle(
                              fontFamily: 'Pretendard',
                              fontSize: 14,
                              height: 1.6,
                              color: AppColors.secondaryText,
                            ),
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
                          title: '주요 캐스트',
                          eyebrow: 'Cast',
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
                              ? const Text('등록된 주요 캐스트가 없습니다.')
                              : SizedBox(
                                  height: 130,
                                  child: ListView.separated(
                                    scrollDirection: Axis.horizontal,
                                    itemCount: items.length,
                                    separatorBuilder: (_, _) =>
                                        const SizedBox(width: 12),
                                    itemBuilder: (context, index) {
                                      final item = items[index];
                                      return SizedBox(
                                        width: 82,
                                        child: Column(
                                          children: [
                                            ClipOval(
                                              child: SizedBox.square(
                                                dimension: 64,
                                                child: AppNetworkImage(
                                                  url: item.characterImageUrl,
                                                  profile: true,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(height: 7),
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
                                              style: appLabelStyle(),
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
        child: Align(
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
