abstract final class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.myanitrack.com/api',
  );

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const _publishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
  );
  static const _legacyAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  static const authRedirectUrl = 'myanitrack://auth/callback';

  static String get supabasePublishableKey =>
      _publishableKey.isNotEmpty ? _publishableKey : _legacyAnonKey;

  static bool get hasSupabaseConfig =>
      supabaseUrl.isNotEmpty && supabasePublishableKey.isNotEmpty;
}

abstract final class AppAssets {
  static const logo = 'assets/images/transparent_version.png';
  static const defaultProfile = 'assets/images/default-profile.jpeg';
}
