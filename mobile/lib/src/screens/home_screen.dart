import 'dart:typed_data';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:myanitrack_mobile/src/models.dart';
import 'package:myanitrack_mobile/src/providers.dart';
import 'package:myanitrack_mobile/src/theme.dart';
import 'package:myanitrack_mobile/src/widgets.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider);
    final user = session.user;
    final favorites = ref.watch(favoriteAnimeProvider);
    final badges = ref.watch(badgeOverviewProvider);
    return CupertinoPageScaffold(
      child: AppBackground(
        child: AppContentWidth(
          child: CustomScrollView(
            slivers: [
              const AppCompactSliverHeader(title: '홈'),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                sliver: SliverList.list(
                  children: [
                    if (user != null)
                      _ProfileSummary(
                        user: user,
                        imageRevision: session.profileImageRevision,
                        imagePreview: session.profileImagePreview,
                        imageRemoved: session.profileImageRemoved,
                      ),
                    const SizedBox(height: 22),
                    const AppSectionHeader(
                      title: '최애 애니',
                      eyebrow: 'Favorites',
                    ),
                    const SizedBox(height: 12),
                    favorites.when(
                      loading: () => const _PosterSkeletonRow(),
                      error: (error, _) => AppStateView(
                        compact: true,
                        title: '최애 애니를 불러오지 못했어요',
                        message: error.toString(),
                        actionLabel: '재시도',
                        onAction: () => ref.invalidate(favoriteAnimeProvider),
                      ),
                      data: (items) => items.isEmpty
                          ? const AppStateView(
                              compact: true,
                              icon: CupertinoIcons.heart,
                              title: '아직 최애 애니가 없어요',
                              message: '가장 좋아하는 작품에 10점을 남겨보세요.',
                            )
                          : FavoriteAnimeCarousel(items: items),
                    ),
                    const SizedBox(height: 26),
                    Row(
                      children: [
                        const Expanded(
                          child: AppSectionHeader(
                            title: '내 배지',
                            eyebrow: 'Badges',
                          ),
                        ),
                        badges.maybeWhen(
                          data: (value) => CupertinoButton(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            onPressed: () => _showBadges(context, value),
                            child: const Text('전체보기'),
                          ),
                          orElse: () => const SizedBox.shrink(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    badges.when(
                      loading: () => const AppSkeleton(height: 154),
                      error: (error, _) => AppStateView(
                        compact: true,
                        title: '배지를 불러오지 못했어요',
                        message: error.toString(),
                        actionLabel: '재시도',
                        onAction: () => ref.invalidate(badgeOverviewProvider),
                      ),
                      data: (value) => _BadgePreview(overview: value),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showBadges(BuildContext context, BadgeOverview overview) {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (context) =>
          AppModalWidth(child: _BadgeSheet(overview: overview)),
    );
  }
}

class _ProfileSummary extends StatelessWidget {
  const _ProfileSummary({
    required this.user,
    required this.imageRevision,
    required this.imagePreview,
    required this.imageRemoved,
  });
  final AuthUser user;
  final int imageRevision;
  final Uint8List? imagePreview;
  final bool imageRemoved;

  @override
  Widget build(BuildContext context) => AppCard(
    onTap: () => context.push('/profile'),
    child: Row(
      children: [
        ClipOval(
          child: SizedBox.square(
            dimension: 64,
            child: AppNetworkImage(
              url: user.profileImageUrl,
              cacheKey: user.profileImageUrl == null
                  ? null
                  : '${user.profileImageUrl}#$imageRevision',
              memoryBytes: imagePreview,
              removed: imageRemoved,
              profile: true,
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('반가워요,', style: appLabelStyle()),
              const SizedBox(height: 2),
              Text(user.displayName, style: appTitleStyle(size: 22)),
              const SizedBox(height: 3),
              Text(
                user.email,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: appLabelStyle(),
              ),
            ],
          ),
        ),
        const Icon(
          CupertinoIcons.chevron_forward,
          size: 18,
          color: AppColors.mutedText,
        ),
      ],
    ),
  );
}

class _PosterSkeletonRow extends StatelessWidget {
  const _PosterSkeletonRow();
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 300,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: 3,
      separatorBuilder: (_, _) => const SizedBox(width: 12),
      itemBuilder: (_, _) =>
          const SizedBox(width: 168, child: AppSkeleton(height: 252)),
    ),
  );
}

class _BadgePreview extends StatelessWidget {
  const _BadgePreview({required this.overview});
  final BadgeOverview overview;

  @override
  Widget build(BuildContext context) {
    final earned = overview.items.where((item) => item.earned).take(4).toList();
    final display = earned.isEmpty ? overview.items.take(4).toList() : earned;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('획득한 배지', style: appTitleStyle(size: 18)),
          const SizedBox(height: 14),
          if (display.isEmpty)
            Text('아직 표시할 배지가 없어요.', style: appLabelStyle())
          else
            Row(
              children: display
                  .map((badge) => Expanded(child: _BadgeIcon(badge: badge)))
                  .toList(),
            ),
        ],
      ),
    );
  }
}

class _BadgeIcon extends StatelessWidget {
  const _BadgeIcon({required this.badge});
  final UserBadge badge;

  @override
  Widget build(BuildContext context) => CupertinoButton(
    padding: EdgeInsets.zero,
    onPressed: () => showBadgeDetailSheet(context, badge),
    child: Opacity(
      opacity: badge.earned ? 1 : 0.45,
      child: Column(
        children: [
          ClipOval(
            child: SizedBox.square(
              dimension: 54,
              child: AppNetworkImage(url: badge.imageUrl, profile: true),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            badge.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: appLabelStyle(),
          ),
        ],
      ),
    ),
  );
}

class _BadgeSheet extends StatelessWidget {
  const _BadgeSheet({required this.overview});
  final BadgeOverview overview;

  @override
  Widget build(BuildContext context) => Container(
    height: MediaQuery.sizeOf(context).height * 0.82,
    decoration: const BoxDecoration(
      color: AppColors.ivory,
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    child: SafeArea(
      top: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
            child: Row(
              children: [
                Expanded(child: Text('내 배지', style: appTitleStyle(size: 22))),
                CupertinoButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('닫기'),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: overview.items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final badge = overview.items[index];
                return AppCard(
                  onTap: () => showBadgeDetailSheet(context, badge),
                  child: Row(
                    children: [
                      SizedBox(width: 66, child: _BadgeIcon(badge: badge)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(badge.name, style: appTitleStyle(size: 17)),
                            const SizedBox(height: 4),
                            Text(badge.description, style: appLabelStyle()),
                            if (!badge.earned && badge.progress != null) ...[
                              const SizedBox(height: 9),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(99),
                                child: SizedBox(
                                  height: 5,
                                  child: ColoredBox(
                                    color: AppColors.softBeige,
                                    child: Align(
                                      alignment: Alignment.centerLeft,
                                      child: FractionallySizedBox(
                                        widthFactor:
                                            badge.progress!.percent / 100,
                                        child: const ColoredBox(
                                          color: AppColors.point,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    ),
  );
}
