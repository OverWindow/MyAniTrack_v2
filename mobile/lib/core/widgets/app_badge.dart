import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

class AppBadge extends StatelessWidget {
  const AppBadge({
    required this.label,
    this.sample = false,
    this.icon,
    super.key,
  });

  final String label;
  final bool sample;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final foreground = sample ? AppColors.sample : AppColors.textOnPointSoft;
    final background = sample ? AppColors.sampleSoft : AppColors.pointSoft;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: foreground.withOpacity(0.18)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 14, color: foreground),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: TextStyle(
                color: foreground,
                fontSize: 12,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
