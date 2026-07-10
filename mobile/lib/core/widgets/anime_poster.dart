import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

class AnimePoster extends StatelessWidget {
  const AnimePoster({
    required this.title,
    this.imageUrl,
    this.width = 72,
    this.height = 104,
    this.radius = 16,
    super.key,
  });

  final String title;
  final String? imageUrl;
  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final imageUrl = this.imageUrl;

    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: width,
        height: height,
        child: imageUrl == null || imageUrl.isEmpty
            ? _PosterFallback(title: title)
            : Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return _PosterFallback(title: title);
                },
                loadingBuilder: (context, child, progress) {
                  if (progress == null) {
                    return child;
                  }

                  return Stack(
                    fit: StackFit.expand,
                    children: [
                      _PosterFallback(title: title),
                      const Center(
                        child: SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      ),
                    ],
                  );
                },
              ),
      ),
    );
  }
}

class _PosterFallback extends StatelessWidget {
  const _PosterFallback({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.pointSoftStrong, AppColors.sampleSoft],
        ),
        border: Border.all(color: AppColors.textMuted.withOpacity(0.16)),
      ),
      child: Text(
        title.isEmpty ? '?' : title.substring(0, 1),
        style: const TextStyle(
          color: AppColors.textOnPointSoft,
          fontSize: 22,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}
