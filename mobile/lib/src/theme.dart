import 'package:flutter/cupertino.dart';

abstract final class AppColors {
  static const point = Color(0xFFF59E0B);
  static const pointPressed = Color(0xFFB45309);
  static const pointSoft = Color(0xFFFEF3C7);
  static const pointSoftest = Color(0xFFFFFBEB);
  static const page = Color(0xFFFFF7ED);
  static const ivory = Color(0xFFFFFBF5);
  static const card = Color(0xFFFFFFFF);
  static const softBeige = Color(0xFFF5EFE6);
  static const neutral = Color(0xFFFAFAF9);
  static const text = Color(0xFF1C1917);
  static const secondaryText = Color(0xFF57534E);
  static const mutedText = Color(0xFF78716C);
  static const border = Color(0x2478716C);
  static const success = Color(0xFF16A34A);
  static const successSoft = Color(0xFFDCFCE7);
  static const error = Color(0xFFDC2626);
  static const errorSoft = Color(0xFFFEE2E2);
  static const info = Color(0xFF2563EB);
  static const infoSoft = Color(0xFFDBEAFE);

  static const chart = <Color>[
    Color(0xFFF59E0B),
    Color(0xFF2563EB),
    Color(0xFF16A34A),
    Color(0xFF9333EA),
    Color(0xFFEA580C),
    Color(0xFF0891B2),
    Color(0xFFDB2777),
    Color(0xFF65A30D),
    Color(0xFF7C3AED),
    Color(0xFFCA8A04),
  ];
}

abstract final class AppSpacing {
  static const xxs = 4.0;
  static const xs = 8.0;
  static const sm = 12.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}

abstract final class AppRadii {
  static const input = 14.0;
  static const card = 18.0;
  static const pill = 999.0;
}

const appBackgroundGradient = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [AppColors.pointSoftest, AppColors.page, AppColors.softBeige],
  stops: [0, 0.3, 1],
);

const appCardShadow = <BoxShadow>[
  BoxShadow(color: Color(0x0A000000), offset: Offset(0, 1), blurRadius: 2),
  BoxShadow(color: Color(0x0F1C1917), offset: Offset(0, 8), blurRadius: 24),
];

const appCupertinoTheme = CupertinoThemeData(
  brightness: Brightness.light,
  primaryColor: AppColors.pointPressed,
  scaffoldBackgroundColor: AppColors.page,
  barBackgroundColor: Color(0xF2FFFFFF),
  textTheme: CupertinoTextThemeData(
    primaryColor: AppColors.text,
    textStyle: TextStyle(
      fontFamily: 'Pretendard',
      fontSize: 15,
      height: 1.45,
      color: AppColors.secondaryText,
    ),
    navLargeTitleTextStyle: TextStyle(
      fontFamily: 'Pretendard',
      fontSize: 32,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.8,
      color: AppColors.text,
    ),
    navTitleTextStyle: TextStyle(
      fontFamily: 'Pretendard',
      fontSize: 17,
      fontWeight: FontWeight.w600,
      color: AppColors.text,
    ),
    actionTextStyle: TextStyle(
      fontFamily: 'Pretendard',
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: AppColors.pointPressed,
    ),
  ),
);

TextStyle appTitleStyle({double size = 22, Color color = AppColors.text}) {
  return TextStyle(
    fontFamily: 'Pretendard',
    fontSize: size,
    height: 1.2,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.4,
    color: color,
  );
}

TextStyle appLabelStyle({Color color = AppColors.mutedText}) {
  return TextStyle(
    fontFamily: 'Pretendard',
    fontSize: 12,
    height: 1.3,
    fontWeight: FontWeight.w600,
    color: color,
  );
}
