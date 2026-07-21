import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:myanitrack_mobile/src/api.dart';
import 'package:myanitrack_mobile/src/models.dart';
import 'package:myanitrack_mobile/src/providers.dart';
import 'package:myanitrack_mobile/src/theme.dart';
import 'package:myanitrack_mobile/src/widgets.dart';

class FriendsScreen extends ConsumerStatefulWidget {
  const FriendsScreen({super.key});

  @override
  ConsumerState<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends ConsumerState<FriendsScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';
  int? _busyUserId;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final searching = _query.length >= 2;
    final snapshot = ref.watch(friendSnapshotProvider);
    final results = searching ? ref.watch(userSearchProvider(_query)) : null;
    return CupertinoPageScaffold(
      child: AppBackground(
        child: CustomScrollView(
          slivers: [
            const AppCompactSliverHeader(title: '친구'),
            CupertinoSliverRefreshControl(
              onRefresh: () async {
                ref.invalidate(friendSnapshotProvider);
                if (searching) ref.invalidate(userSearchProvider(_query));
                await ref.read(friendSnapshotProvider.future);
              },
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              sliver: SliverList.list(
                children: [
                  CupertinoSearchTextField(
                    controller: _controller,
                    placeholder: '사용자명으로 찾기',
                    onChanged: _onQueryChanged,
                  ),
                  const SizedBox(height: 18),
                  if (_controller.text.trim().isNotEmpty && !searching)
                    const AppStateView(
                      compact: true,
                      title: '두 글자 이상 입력해주세요',
                      message: '사용자명의 일부만 입력해도 찾을 수 있어요.',
                    )
                  else if (searching)
                    results!.when(
                      loading: () => const _PeopleSkeleton(),
                      error: (error, _) => AppStateView(
                        compact: true,
                        title: '사용자를 찾지 못했어요',
                        message: error.toString(),
                        actionLabel: '다시 찾기',
                        onAction: () =>
                            ref.invalidate(userSearchProvider(_query)),
                      ),
                      data: (page) => _PeopleSection(
                        title: '검색 결과',
                        emptyMessage: '일치하는 사용자가 없습니다.',
                        children: page.items
                            .map(
                              (item) => _UserRow(
                                user: item.user,
                                onTap: () =>
                                    context.push('/users/${item.user.id}'),
                                action: _relationshipAction(item),
                              ),
                            )
                            .toList(),
                      ),
                    )
                  else
                    snapshot.when(
                      loading: () => const _PeopleSkeleton(),
                      error: (error, _) => AppStateView(
                        compact: true,
                        title: '친구 목록을 불러오지 못했어요',
                        message: error.toString(),
                        actionLabel: '재시도',
                        onAction: () => ref.invalidate(friendSnapshotProvider),
                      ),
                      data: (data) => Column(
                        children: [
                          if (data.incoming.isNotEmpty)
                            _PeopleSection(
                              title: '받은 요청',
                              children: data.incoming
                                  .map(
                                    (request) => _UserRow(
                                      user: request.user,
                                      onTap: () => context.push(
                                        '/users/${request.user.id}',
                                      ),
                                      action: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          _SmallAction(
                                            label: '거절',
                                            onPressed:
                                                _busyUserId == request.user.id
                                                ? null
                                                : () => _act(
                                                    request.user.id,
                                                    () => ref
                                                        .read(
                                                          friendsRepositoryProvider,
                                                        )
                                                        .actOnRequest(
                                                          request.id,
                                                          'reject',
                                                        ),
                                                  ),
                                          ),
                                          const SizedBox(width: 6),
                                          _SmallAction(
                                            label: '수락',
                                            filled: true,
                                            onPressed:
                                                _busyUserId == request.user.id
                                                ? null
                                                : () => _act(
                                                    request.user.id,
                                                    () => ref
                                                        .read(
                                                          friendsRepositoryProvider,
                                                        )
                                                        .actOnRequest(
                                                          request.id,
                                                          'accept',
                                                        ),
                                                  ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  )
                                  .toList(),
                            ),
                          if (data.incoming.isNotEmpty)
                            const SizedBox(height: 20),
                          _PeopleSection(
                            title: '내 친구',
                            emptyMessage: '아직 친구가 없어요. 위에서 사용자를 찾아보세요.',
                            children: data.friends
                                .map(
                                  (friend) => _UserRow(
                                    user: friend.user,
                                    onTap: () => context.push(
                                      '/users/${friend.user.id}',
                                    ),
                                    action: const Icon(
                                      CupertinoIcons.chevron_forward,
                                      color: AppColors.mutedText,
                                      size: 18,
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                          if (data.outgoing.isNotEmpty) ...[
                            const SizedBox(height: 20),
                            _PeopleSection(
                              title: '보낸 요청',
                              children: data.outgoing
                                  .map(
                                    (request) => _UserRow(
                                      user: request.user,
                                      onTap: () => context.push(
                                        '/users/${request.user.id}',
                                      ),
                                      action: _SmallAction(
                                        label: '취소',
                                        onPressed:
                                            _busyUserId == request.user.id
                                            ? null
                                            : () => _act(
                                                request.user.id,
                                                () => ref
                                                    .read(
                                                      friendsRepositoryProvider,
                                                    )
                                                    .actOnRequest(
                                                      request.id,
                                                      'cancel',
                                                    ),
                                              ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                            ),
                          ],
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _relationshipAction(UserSearchResult item) {
    final busy = _busyUserId == item.user.id;
    return switch (item.relationship) {
      UserRelationship.none => _SmallAction(
        label: '친구 추가',
        filled: true,
        onPressed: busy
            ? null
            : () => _act(
                item.user.id,
                () => ref
                    .read(friendsRepositoryProvider)
                    .sendRequest(item.user.id),
              ),
      ),
      UserRelationship.incoming => _SmallAction(
        label: '수락',
        filled: true,
        onPressed: busy || item.requestId == null
            ? null
            : () => _act(
                item.user.id,
                () => ref
                    .read(friendsRepositoryProvider)
                    .actOnRequest(item.requestId!, 'accept'),
              ),
      ),
      UserRelationship.outgoing => const AppBadge(label: '요청 중'),
      UserRelationship.friend => const AppBadge(
        label: '친구',
        color: AppColors.successSoft,
        textColor: AppColors.success,
      ),
    };
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      setState(() => _query = value.trim());
    });
    setState(() {});
  }

  Future<void> _act(int userId, Future<void> Function() action) async {
    setState(() => _busyUserId = userId);
    try {
      await action();
      ref.invalidate(friendSnapshotProvider);
      if (_query.length >= 2) ref.invalidate(userSearchProvider(_query));
    } on ApiFailure catch (error) {
      if (mounted) showAppToast(context, error.message, error: true);
    } finally {
      if (mounted) setState(() => _busyUserId = null);
    }
  }
}

class PublicProfileScreen extends ConsumerStatefulWidget {
  const PublicProfileScreen({required this.userId, super.key});
  final int userId;

  @override
  ConsumerState<PublicProfileScreen> createState() =>
      _PublicProfileScreenState();
}

class _PublicProfileScreenState extends ConsumerState<PublicProfileScreen> {
  bool _acting = false;

  @override
  Widget build(BuildContext context) {
    final userId = widget.userId;
    final profile = ref.watch(publicUserProvider(userId));
    final favorites = ref.watch(publicFavoriteAnimeProvider(userId));
    final badges = ref.watch(publicBadgeOverviewProvider(userId));
    final snapshot = ref.watch(friendSnapshotProvider);
    return CupertinoPageScaffold(
      child: AppBackground(
        child: CustomScrollView(
          slivers: [
            AppCompactSliverHeader(
              title: '사용자 프로필',
              leading: CupertinoButton(
                padding: EdgeInsets.zero,
                minimumSize: const Size.square(44),
                onPressed: () => Navigator.of(context).maybePop(),
                child: const Icon(
                  CupertinoIcons.back,
                  color: AppColors.pointPressed,
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              sliver: SliverToBoxAdapter(
                child: profile.when(
                  loading: () => const AppSkeleton(height: 260),
                  error: (error, _) => AppStateView(
                    title: '프로필을 불러오지 못했어요',
                    message: error.toString(),
                    actionLabel: '재시도',
                    onAction: () => ref.invalidate(publicUserProvider(userId)),
                  ),
                  data: (user) => Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AppCard(
                        child: Column(
                          children: [
                            ClipOval(
                              child: SizedBox.square(
                                dimension: 92,
                                child: AppNetworkImage(
                                  url: user.profileImageUrl,
                                  profile: true,
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                            Text(user.username, style: appTitleStyle(size: 24)),
                            const SizedBox(height: 5),
                            Text(
                              '${user.animeListCount}편의 기록',
                              style: appLabelStyle(),
                            ),
                            if (user.bio != null) ...[
                              const SizedBox(height: 12),
                              Text(user.bio!, textAlign: TextAlign.center),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      snapshot.maybeWhen(
                        data: (value) => _relationshipAction(value, userId),
                        orElse: () => const SizedBox.shrink(),
                      ),
                      const SizedBox(height: 10),
                      AppPrimaryButton(
                        label: '컬렉션 보기',
                        icon: const Icon(
                          CupertinoIcons.square_grid_2x2,
                          size: 18,
                        ),
                        onPressed: () =>
                            context.push('/users/$userId/collection'),
                      ),
                      const SizedBox(height: 10),
                      AppSecondaryButton(
                        label: '분석 보기',
                        icon: CupertinoIcons.chart_bar,
                        onPressed: () => context.push(
                          '/users/$userId/analysis?name=${Uri.encodeQueryComponent(user.username)}',
                        ),
                      ),
                      const SizedBox(height: 22),
                      const AppSectionHeader(
                        title: '획득한 배지',
                        eyebrow: 'Badges',
                      ),
                      const SizedBox(height: 10),
                      badges.when(
                        loading: () => const AppSkeleton(height: 112),
                        error: (error, _) => AppStateView(
                          compact: true,
                          title: '배지를 불러오지 못했어요',
                          message: error.toString(),
                          actionLabel: '재시도',
                          onAction: () => ref.invalidate(
                            publicBadgeOverviewProvider(userId),
                          ),
                        ),
                        data: (overview) => EarnedBadgeStrip(
                          badges: overview.items,
                          flat: true,
                        ),
                      ),
                      const SizedBox(height: 20),
                      const AppSectionHeader(
                        title: '최애 애니',
                        eyebrow: 'Favorites',
                      ),
                      const SizedBox(height: 10),
                      favorites.when(
                        loading: () => const AppSkeleton(height: 300),
                        error: (error, _) => AppStateView(
                          compact: true,
                          title: '최애 애니를 불러오지 못했어요',
                          message: error.toString(),
                          actionLabel: '재시도',
                          onAction: () => ref.invalidate(
                            publicFavoriteAnimeProvider(userId),
                          ),
                        ),
                        data: (items) => items.isEmpty
                            ? const AppStateView(
                                compact: true,
                                icon: CupertinoIcons.heart,
                                title: '공개된 최애 애니가 없어요',
                                message: '10점을 준 작품이 여기에 표시됩니다.',
                              )
                            : FavoriteAnimeCarousel(items: items),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _relationshipAction(FriendSnapshot snapshot, int userId) {
    for (final request in snapshot.incoming) {
      if (request.user.id == userId) {
        return AppPrimaryButton(
          label: _acting ? '수락 중...' : '친구 요청 수락',
          icon: const Icon(CupertinoIcons.person_badge_plus, size: 18),
          onPressed: _acting
              ? null
              : () => _act(
                  () => ref
                      .read(friendsRepositoryProvider)
                      .actOnRequest(request.id, 'accept'),
                ),
        );
      }
    }
    for (final request in snapshot.outgoing) {
      if (request.user.id == userId) {
        return const AppSecondaryButton(
          label: '친구 요청을 보냈어요',
          icon: CupertinoIcons.clock,
          onPressed: null,
        );
      }
    }
    for (final friend in snapshot.friends) {
      if (friend.user.id == userId) {
        return const AppSecondaryButton(
          label: '친구',
          icon: CupertinoIcons.person_2_fill,
          onPressed: null,
        );
      }
    }
    return AppPrimaryButton(
      label: _acting ? '요청 중...' : '친구 추가',
      icon: const Icon(CupertinoIcons.person_add, size: 18),
      onPressed: _acting
          ? null
          : () => _act(
              () => ref.read(friendsRepositoryProvider).sendRequest(userId),
            ),
    );
  }

  Future<void> _act(Future<void> Function() action) async {
    setState(() => _acting = true);
    try {
      await action();
      ref.invalidate(friendSnapshotProvider);
      ref.invalidate(userSearchProvider);
      if (mounted) showAppToast(context, '친구 상태를 업데이트했습니다.');
    } on ApiFailure catch (error) {
      if (mounted) showAppToast(context, error.message, error: true);
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }
}

class PublicCollectionScreen extends ConsumerStatefulWidget {
  const PublicCollectionScreen({required this.userId, super.key});
  final int userId;

  @override
  ConsumerState<PublicCollectionScreen> createState() =>
      _PublicCollectionScreenState();
}

class _PublicCollectionScreenState
    extends ConsumerState<PublicCollectionScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _debounce;
  CancelToken? _cancelToken;
  List<CollectionEntry> _items = const [];
  PageInfo _pageInfo = const PageInfo(hasNext: false);
  int? _totalCount;
  String _query = '';
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _cancelToken?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(middle: Text('컬렉션')),
      child: AppBackground(
        child: SafeArea(
          top: false,
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
              CupertinoSliverRefreshControl(onRefresh: _load),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                sliver: SliverList.list(
                  children: [
                    Text(
                      _totalCount == null ? '전체 작품' : '전체 $_totalCount편',
                      style: appTitleStyle(size: 24),
                    ),
                    const SizedBox(height: 12),
                    CupertinoSearchTextField(
                      controller: _searchController,
                      placeholder: '컬렉션에서 검색',
                      onChanged: _onSearch,
                    ),
                  ],
                ),
              ),
              if (_loading)
                const SliverPadding(
                  padding: EdgeInsets.all(16),
                  sliver: SliverToBoxAdapter(child: _PeopleSkeleton()),
                )
              else if (_error != null && _items.isEmpty)
                SliverPadding(
                  padding: const EdgeInsets.all(16),
                  sliver: SliverToBoxAdapter(
                    child: AppStateView(
                      title: '컬렉션을 불러오지 못했어요',
                      message: _error.toString(),
                      actionLabel: '재시도',
                      onAction: _load,
                    ),
                  ),
                )
              else if (_items.isEmpty)
                const SliverPadding(
                  padding: EdgeInsets.all(16),
                  sliver: SliverToBoxAdapter(
                    child: AppStateView(
                      title: '표시할 작품이 없어요',
                      message: '검색어를 바꾸거나 잠시 후 다시 확인해주세요.',
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverGrid.builder(
                    itemCount: _items.length,
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 18,
                          childAspectRatio: .58,
                        ),
                    itemBuilder: (context, index) {
                      final entry = _items[index];
                      return CupertinoButton(
                        padding: EdgeInsets.zero,
                        onPressed: () =>
                            context.push('/anime/${entry.animeId}'),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: AnimePoster(
                                url: entry.anime.coverImageUrl,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              entry.anime.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.text,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(entry.status.label, style: appLabelStyle()),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              if (_loadingMore)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.only(bottom: 24),
                    child: CupertinoActivityIndicator(),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _onSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _query = value.trim();
      _load();
    });
  }

  void _onScroll() {
    if (_scrollController.position.extentAfter < 500) _loadMore();
  }

  Future<void> _load() async {
    _cancelToken?.cancel();
    final token = CancelToken();
    _cancelToken = token;
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final page = await ref
          .read(friendsRepositoryProvider)
          .collection(widget.userId, query: _query, cancelToken: token);
      if (!mounted || token.isCancelled) return;
      setState(() {
        _items = page.items;
        _pageInfo = page.pageInfo;
        _totalCount = page.totalCount;
        _loading = false;
      });
    } on DioException catch (_) {
      if (token.isCancelled) return;
    } on Object catch (error) {
      if (mounted) {
        setState(() {
          _error = error;
          _loading = false;
        });
      }
    }
  }

  Future<void> _loadMore() async {
    if (_loading || _loadingMore || !_pageInfo.hasNext) return;
    setState(() => _loadingMore = true);
    try {
      final page = await ref
          .read(friendsRepositoryProvider)
          .collection(
            widget.userId,
            query: _query,
            cursor: _pageInfo.nextCursor,
          );
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...page.items];
        _pageInfo = page.pageInfo;
        _loadingMore = false;
      });
    } on Object catch (error) {
      if (mounted) {
        setState(() {
          _error = error;
          _loadingMore = false;
        });
      }
    }
  }
}

class _PeopleSection extends StatelessWidget {
  const _PeopleSection({
    required this.title,
    required this.children,
    this.emptyMessage,
  });
  final String title;
  final List<Widget> children;
  final String? emptyMessage;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: appTitleStyle(size: 20)),
      const SizedBox(height: 10),
      if (children.isEmpty)
        AppCard(
          color: AppColors.pointSoftest,
          child: Text(emptyMessage ?? '표시할 사용자가 없습니다.'),
        )
      else
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var index = 0; index < children.length; index++) ...[
                children[index],
                if (index != children.length - 1)
                  const SizedBox(
                    height: 1,
                    child: ColoredBox(color: AppColors.border),
                  ),
              ],
            ],
          ),
        ),
    ],
  );
}

class _UserRow extends StatelessWidget {
  const _UserRow({
    required this.user,
    required this.onTap,
    required this.action,
  });
  final PublicUser user;
  final VoidCallback onTap;
  final Widget action;

  @override
  Widget build(BuildContext context) => CupertinoButton(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    onPressed: onTap,
    child: Row(
      children: [
        ClipOval(
          child: SizedBox.square(
            dimension: 48,
            child: AppNetworkImage(url: user.profileImageUrl, profile: true),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                user.username,
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text('${user.animeListCount}편의 기록', style: appLabelStyle()),
            ],
          ),
        ),
        const SizedBox(width: 8),
        action,
      ],
    ),
  );
}

class _SmallAction extends StatelessWidget {
  const _SmallAction({
    required this.label,
    this.onPressed,
    this.filled = false,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool filled;

  @override
  Widget build(BuildContext context) => CupertinoButton(
    minimumSize: const Size(44, 44),
    padding: const EdgeInsets.symmetric(horizontal: 11),
    color: filled ? AppColors.point : AppColors.softBeige,
    borderRadius: BorderRadius.circular(AppRadii.pill),
    onPressed: onPressed,
    child: Text(
      label,
      style: TextStyle(
        color: filled ? AppColors.card : AppColors.secondaryText,
        fontSize: 12,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

class _PeopleSkeleton extends StatelessWidget {
  const _PeopleSkeleton();

  @override
  Widget build(BuildContext context) => Column(
    children: List.generate(
      4,
      (_) => const Padding(
        padding: EdgeInsets.only(bottom: 10),
        child: AppSkeleton(height: 72),
      ),
    ),
  );
}
