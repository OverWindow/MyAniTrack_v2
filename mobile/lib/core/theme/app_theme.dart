import 'package:flutter/material.dart';

import 'app_colors.dart';

const appBackgroundGradient = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [
    AppColors.pointSoftest,
    AppColors.bgPage,
    AppColors.bgSoftBeige,
  ],
  stops: [0.0, 0.28, 1.0],
);

const cardShadow = [
  BoxShadow(
    color: Color(0x0A000000),
    offset: Offset(0, 1),
    blurRadius: 2,
  ),
  BoxShadow(
    color: Color(0x0F1C1917),
    offset: Offset(0, 8),
    blurRadius: 24,
  ),
];

ThemeData buildMyAniTrackTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.point,
    primary: AppColors.point,
    secondary: AppColors.sample,
    error: AppColors.error,
    surface: AppColors.bgCard,
    onPrimary: AppColors.textInverse,
    onSurface: AppColors.textPrimary,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.bgPage,
    colorScheme: scheme,
    fontFamily: 'Pretendard',
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w800,
        height: 1.1,
      ),
      titleLarge: TextStyle(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w800,
      ),
      titleMedium: TextStyle(
        color: AppColors.textPrimary,
        fontWeight: FontWeight.w700,
      ),
      bodyLarge: TextStyle(
        color: AppColors.textSecondary,
        height: 1.5,
      ),
      bodyMedium: TextStyle(
        color: AppColors.textSecondary,
        height: 1.5,
      ),
      labelMedium: TextStyle(
        color: AppColors.textMuted,
        fontWeight: FontWeight.w800,
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.bgCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(
          color: AppColors.textMuted.withOpacity(0.16),
        ),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.point,
        foregroundColor: AppColors.textInverse,
        minimumSize: const Size.fromHeight(46),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        minimumSize: const Size.fromHeight(46),
        side: BorderSide(color: AppColors.textMuted.withOpacity(0.24)),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.bgCard,
      indicatorColor: AppColors.pointSoft,
      labelTextStyle: MaterialStateProperty.resolveWith(
        (states) => TextStyle(
          color: states.contains(MaterialState.selected)
              ? AppColors.textOnPointSoft
              : AppColors.textMuted,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
      iconTheme: MaterialStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(MaterialState.selected)
              ? AppColors.pointHover
              : AppColors.textMuted,
        ),
      ),
    ),
  );
}
