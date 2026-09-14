import 'dart:math' as math;
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:go_router/go_router.dart';

import 'package:myanitrack_mobile/src/config.dart';
import 'package:myanitrack_mobile/src/models.dart';
import 'package:myanitrack_mobile/src/theme.dart';

abstract final class AppLayout {
  static const tabletBreakpoint = 600.0;
  static const contentMaxWidth = 960.0;
  static const formMaxWidth = 720.0;
  static const modalMaxWidth = 640.0;

  static bool isTablet(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= tabletBreakpoint;

  static int posterGridCount(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    if (size.width < tabletBreakpoint) return 2;
    return size.width > size.height ? 4 : 3;
  }
}

class AppContentWidth extends StatelessWidget {
  const AppContentWidth({
    required this.child,
    this.maxWidth = AppLayout.contentMaxWidth,
    this.alignment = Alignment.topCenter,
    super.key,
  });

  final Widget child;
  final double maxWidth;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    final tablet = AppLayout.isTablet(context);
    return Align(
      alignment: alignment,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: tablet ? 8 : 0),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: child,
        ),
      ),
    );
  }
}

class AppModalWidth extends StatelessWidget {
  const AppModalWidth({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) => AppContentWidth(
    maxWidth: AppLayout.modalMaxWidth,
    alignment: Alignment.bottomCenter,
    child: child,
  );
}

class AppBackground extends StatelessWidget {
  const AppBackground({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: appBackgroundGradient),
      child: child,
    );
  }
}

class AppCompactSliverHeader extends StatelessWidget {
  const AppCompactSliverHeader({
    required this.title,
    this.leading,
    this.trailing,
    super.key,
  });

  final String title;
  final Widget? leading;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return SliverSafeArea(
      bottom: false,
      sliver: SliverToBoxAdapter(
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: AppColors.pointSoftest,
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
          child: SizedBox(
            height: 48,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  if (leading != null) ...[leading!, const SizedBox(width: 8)],
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: appTitleStyle(size: 22),
                    ),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class AppCard extends StatelessWidget {
  const AppCard({
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.color = AppColors.card,
    this.onTap,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
        boxShadow: appCardShadow,
      ),
      child: child,
    );
    if (onTap == null) return content;
    return CupertinoButton(
      padding: EdgeInsets.zero,
      pressedOpacity: 0.78,
      onPressed: onTap,
      child: content,
    );
  }
}

class AppPrimaryButton extends StatelessWidget {
  const AppPrimaryButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.destructive = false,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final Widget? icon;
  final bool loading;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: CupertinoButton(
        padding: const EdgeInsets.symmetric(horizontal: 18),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        color: destructive ? AppColors.error : AppColors.point,
        disabledColor: AppColors.softBeige,
        pressedOpacity: 0.82,
        onPressed: loading ? null : onPressed,
        child: loading
            ? const CupertinoActivityIndicator(color: AppColors.card)
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[icon!, const SizedBox(width: 9)],
                  Text(
                    label,
                    style: const TextStyle(
                      fontFamily: 'Pretendard',
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: AppColors.card,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class AppSecondaryButton extends StatelessWidget {
  const AppSecondaryButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.destructive = false,
    super.key,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? AppColors.error : AppColors.text;
    return SizedBox(
      height: 46,
      child: CupertinoButton(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        color: AppColors.card,
        onPressed: onPressed,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 7),
            ],
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Pretendard',
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AppBadge extends StatelessWidget {
  const AppBadge({
    required this.label,
    this.color = AppColors.pointSoft,
    this.textColor = AppColors.pointPressed,
    super.key,
  });
  final String label;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(label, style: appLabelStyle(color: textColor)),
    );
  }
}

class AppSectionHeader extends StatelessWidget {
  const AppSectionHeader({
    required this.title,
    this.eyebrow,
    this.description,
    this.trailing,
    super.key,
  });
  final String title;
  final String? eyebrow;
  final String? description;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: appTitleStyle(size: 20)),
              if (description != null) ...[
                const SizedBox(height: 5),
                Text(
                  description!,
                  style: const TextStyle(
                    fontFamily: 'Pretendard',
                    fontSize: 13,
                    height: 1.45,
                    color: AppColors.mutedText,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 12), trailing!],
      ],
    );
  }
}

class AppStateView extends StatelessWidget {
  const AppStateView({
    required this.title,
    required this.message,
    this.icon = CupertinoIcons.info_circle,
    this.actionLabel,
    this.onAction,
    this.compact = false,
    super.key,
  });
  final String title;
  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: compact ? 4 : 14),
        child: Column(
          children: [
            Icon(icon, size: compact ? 28 : 38, color: AppColors.pointPressed),
            const SizedBox(height: 10),
            Text(
              title,
              textAlign: TextAlign.center,
              style: appTitleStyle(size: 17),
            ),
            const SizedBox(height: 5),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Pretendard',
                fontSize: 14,
                height: 1.45,
                color: AppColors.mutedText,
              ),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 14),
              CupertinoButton(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 9,
                ),
                borderRadius: BorderRadius.circular(AppRadii.pill),
                color: AppColors.pointSoft,
                onPressed: onAction,
                child: Text(
                  actionLabel!,
                  style: const TextStyle(
                    fontFamily: 'Pretendard',
                    fontWeight: FontWeight.w600,
                    color: AppColors.pointPressed,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class AppSkeleton extends StatefulWidget {
  const AppSkeleton({
    this.height = 120,
    this.radius = AppRadii.card,
    super.key,
  });
  final double height;
  final double radius;

  @override
  State<AppSkeleton> createState() => _AppSkeletonState();
}

class _AppSkeletonState extends State<AppSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1250),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, _) => Container(
        height: widget.height,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment(
              -1.8 + (reduceMotion ? 0 : _controller.value * 3.6),
              0,
            ),
            end: Alignment(
              -0.8 + (reduceMotion ? 0 : _controller.value * 3.6),
              0,
            ),
            colors: const [
              AppColors.softBeige,
              Color(0xFFFFF9ED),
              AppColors.softBeige,
            ],
          ),
          borderRadius: BorderRadius.circular(widget.radius),
          border: Border.all(color: AppColors.border),
        ),
      ),
    );
  }
}

class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({
    this.url,
    this.cacheKey,
    this.memoryBytes,
    this.removed = false,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.profile = false,
    super.key,
  });
  final String? url;
  final String? cacheKey;
  final Uint8List? memoryBytes;
  final bool removed;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final bool profile;

  @override
  Widget build(BuildContext context) {
    final fallback = Image.asset(
      profile ? AppAssets.defaultProfile : AppAssets.logo,
      fit: profile ? BoxFit.cover : BoxFit.contain,
    );
    final image = removed
        ? fallback
        : memoryBytes != null
        ? Image.memory(memoryBytes!, fit: fit, gaplessPlayback: true)
        : url == null
        ? fallback
        : CachedNetworkImage(
            imageUrl: url!,
            cacheKey: cacheKey,
            fit: fit,
            placeholder: (_, _) =>
                const AppSkeleton(height: double.infinity, radius: 0),
            errorWidget: (_, _, _) => fallback,
          );
    if (borderRadius == null) return image;
    return ClipRRect(borderRadius: borderRadius!, child: image);
  }
}

class AnimePoster extends StatelessWidget {
  const AnimePoster({this.url, this.radius = 14, super.key});
  final String? url;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 2 / 3,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.softBeige,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: AppColors.border),
        ),
        child: AppNetworkImage(
          url: url,
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}

class FavoriteAnimeCarousel extends StatefulWidget {
  const FavoriteAnimeCarousel({required this.items, super.key});
  final List<CollectionEntry> items;

  @override
  State<FavoriteAnimeCarousel> createState() => _FavoriteAnimeCarouselState();
}

class _FavoriteAnimeCarouselState extends State<FavoriteAnimeCarousel> {
  late final PageController _controller = PageController(viewportFraction: .58);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    return SizedBox(
      height: 300,
      child: PageView.builder(
        controller: _controller,
        padEnds: true,
        itemCount: widget.items.length,
        itemBuilder: (context, index) {
          final entry = widget.items[index];
          return AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              final page =
                  _controller.hasClients &&
                      _controller.position.hasContentDimensions
                  ? (_controller.page ?? 0)
                  : 0.0;
              final distance = (page - index).clamp(-1.5, 1.5);
              final focus = (1 - distance.abs() * .16).clamp(.82, 1.0);
              final transform = Matrix4.identity();
              if (!reduceMotion) {
                transform
                  ..setEntry(3, 2, .0014)
                  ..translateByDouble(0, distance.abs() * 18, 0, 1)
                  ..rotateY(distance * -.16)
                  ..scaleByDouble(focus, focus, 1, 1);
              }
              return Transform(
                alignment: Alignment.center,
                transform: transform,
                child: Opacity(
                  opacity: reduceMotion
                      ? 1
                      : (1 - distance.abs() * .2).clamp(.68, 1),
                  child: child,
                ),
              );
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
              child: CupertinoButton(
                padding: EdgeInsets.zero,
                onPressed: () => context.push('/anime/${entry.animeId}'),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x33000000),
                        blurRadius: 18,
                        offset: Offset(0, 10),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: AspectRatio(
                      aspectRatio: 2 / 3,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          AppNetworkImage(
                            url: entry.anime.coverImageUrl,
                            fit: BoxFit.cover,
                          ),
                          const DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [Color(0x00000000), Color(0xCC1F160F)],
                                stops: [.48, 1],
                              ),
                            ),
                          ),
                          Positioned(
                            left: 12,
                            right: 12,
                            bottom: 13,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  entry.anime.title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontFamily: 'Pretendard',
                                    fontSize: 15,
                                    height: 1.25,
                                    fontWeight: FontWeight.w700,
                                    color: CupertinoColors.white,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  '★★★★★  ${(entry.score ?? 10).toStringAsFixed(1)}',
                                  style: const TextStyle(
                                    fontFamily: 'Pretendard',
                                    fontSize: 12,
                                    color: Color(0xFFFFD166),
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class EarnedBadgeStrip extends StatelessWidget {
  const EarnedBadgeStrip({required this.badges, this.flat = false, super.key});
  final List<UserBadge> badges;
  final bool flat;

  @override
  Widget build(BuildContext context) {
    if (badges.isEmpty) {
      return const AppStateView(
        compact: true,
        icon: CupertinoIcons.rosette,
        title: '아직 획득한 배지가 없어요',
        message: '감상 기록을 쌓으면 배지를 받을 수 있어요.',
      );
    }
    return SizedBox(
      height: 112,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 2),
        itemCount: badges.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final badge = badges[index];
          return SizedBox(
            width: 96,
            child: CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: () => showBadgeDetailSheet(context, badge),
              child: flat
                  ? _BadgeStripContent(badge: badge)
                  : AppCard(
                      padding: const EdgeInsets.all(10),
                      child: _BadgeStripContent(badge: badge),
                    ),
            ),
          );
        },
      ),
    );
  }
}

class _BadgeStripContent extends StatelessWidget {
  const _BadgeStripContent({required this.badge});
  final UserBadge badge;

  @override
  Widget build(BuildContext context) => Column(
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
  );
}

Future<void> showBadgeDetailSheet(BuildContext context, UserBadge badge) {
  final earnedDate = badge.earnedAt == null
      ? null
      : (DateTime.tryParse(
              badge.earnedAt!,
            )?.toLocal().toString().split(' ').first ??
            badge.earnedAt);
  final rarity = switch (badge.rarity.toUpperCase()) {
    'LEGENDARY' => '전설',
    'EPIC' => '영웅',
    'RARE' => '희귀',
    _ => '일반',
  };
  return showCupertinoModalPopup<void>(
    context: context,
    builder: (sheetContext) => Container(
      decoration: const BoxDecoration(
        color: AppColors.ivory,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 18, 24, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: CupertinoButton(
                  padding: EdgeInsets.zero,
                  onPressed: () => Navigator.of(sheetContext).pop(),
                  child: const Icon(
                    CupertinoIcons.xmark_circle_fill,
                    color: AppColors.mutedText,
                  ),
                ),
              ),
              ClipOval(
                child: SizedBox.square(
                  dimension: 88,
                  child: AppNetworkImage(url: badge.imageUrl, profile: true),
                ),
              ),
              const SizedBox(height: 14),
              Text(badge.name, style: appTitleStyle(size: 22)),
              const SizedBox(height: 6),
              AppBadge(label: rarity),
              const SizedBox(height: 14),
              Text(
                badge.description.isEmpty
                    ? '배지 조건을 달성하면 획득할 수 있어요.'
                    : badge.description,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'Pretendard',
                  fontSize: 14,
                  height: 1.55,
                  color: AppColors.secondaryText,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                badge.earned ? '획득한 배지' : '아직 획득하지 않은 배지',
                style: appLabelStyle(
                  color: badge.earned
                      ? AppColors.success
                      : AppColors.secondaryText,
                ),
              ),
              if (earnedDate != null) ...[
                const SizedBox(height: 5),
                Text('획득일 $earnedDate', style: appLabelStyle()),
              ],
              if (badge.progress != null) ...[
                const SizedBox(height: 14),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: SizedBox(
                    height: 7,
                    child: ColoredBox(
                      color: AppColors.softBeige,
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: badge.progress!.percent / 100,
                          child: const ColoredBox(color: AppColors.point),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  '${badge.progress!.current ?? 0} / ${badge.progress!.target ?? '-'} · ${badge.progress!.percent.toStringAsFixed(0)}%',
                  style: appLabelStyle(),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}

class GoogleMark extends StatelessWidget {
  const GoogleMark({this.size = 19, super.key});
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(painter: _GooglePainter()),
    );
  }
}

class _GooglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.19;
    final rect = Offset.zero & size;
    final center = rect.center;
    final radius = size.width * 0.39;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.square;
    void arc(Color color, double start, double sweep) {
      paint.color = color;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        start,
        sweep,
        false,
        paint,
      );
    }

    arc(const Color(0xFF4285F4), -math.pi * 0.28, math.pi * 0.65);
    arc(const Color(0xFF34A853), math.pi * 0.37, math.pi * 0.58);
    arc(const Color(0xFFFBBC05), math.pi * 0.95, math.pi * 0.42);
    arc(const Color(0xFFEA4335), math.pi * 1.37, math.pi * 0.35);
    paint
      ..color = const Color(0xFF4285F4)
      ..style = PaintingStyle.fill;
    canvas.drawRect(
      Rect.fromLTWH(center.dx, center.dy - stroke / 2, radius, stroke),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

Future<bool> showAppConfirmation(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  bool destructive = false,
}) async {
  final result = await showCupertinoDialog<bool>(
    context: context,
    builder: (context) => CupertinoAlertDialog(
      title: Text(title),
      content: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(message),
      ),
      actions: [
        CupertinoDialogAction(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('취소'),
        ),
        CupertinoDialogAction(
          isDestructiveAction: destructive,
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}

void showAppToast(BuildContext context, String message, {bool error = false}) {
  final overlay = Overlay.of(context);
  late final OverlayEntry entry;
  entry = OverlayEntry(
    builder: (context) => Positioned(
      left: 20,
      right: 20,
      bottom: MediaQuery.paddingOf(context).bottom + 88,
      child: IgnorePointer(
        child: Center(
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: error ? AppColors.error : AppColors.text,
              borderRadius: BorderRadius.circular(AppRadii.pill),
              boxShadow: appCardShadow,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
              child: Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'Pretendard',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.card,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  overlay.insert(entry);
  Future<void>.delayed(const Duration(seconds: 2), entry.remove);
}
