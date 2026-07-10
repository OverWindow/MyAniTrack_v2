import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'app_badge.dart';

class SampleBanner extends StatelessWidget {
  const SampleBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.sampleSoft.withOpacity(0.88),
        border: Border.all(color: AppColors.sample.withOpacity(0.2)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppBadge(
            label: 'Sample mode',
            sample: true,
            icon: Icons.auto_awesome,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              '로그인 전에는 샘플 컬렉션과 샘플 분석을 보여줍니다. 실제 기록과 구분되도록 틸 색상 배지를 유지합니다.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.sampleDark,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
