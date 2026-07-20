import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';

import 'package:myanitrack_mobile/src/config.dart';
import 'package:myanitrack_mobile/src/theme.dart';

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
              if (eyebrow != null) ...[
                Text(eyebrow!.toUpperCase(), style: appLabelStyle()),
                const SizedBox(height: 4),
              ],
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
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.profile = false,
    super.key,
  });
  final String? url;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final bool profile;

  @override
  Widget build(BuildContext context) {
    final fallback = Image.asset(
      profile ? AppAssets.defaultProfile : AppAssets.logo,
      fit: profile ? BoxFit.cover : BoxFit.contain,
    );
    final image = url == null
        ? fallback
        : CachedNetworkImage(
            imageUrl: url!,
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
