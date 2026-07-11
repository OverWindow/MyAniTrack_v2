import '../models/auth_user_info.dart';
import 'api_client.dart';

class AuthRepository {
  const AuthRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> connectSupabaseSession() {
    return _apiClient.postJson('/auth/supabase', authenticated: true);
  }

  Future<Map<String, dynamic>> fetchMe() {
    return _apiClient.getJson('/auth/me', authenticated: true);
  }

  Future<AuthUserInfo> fetchMeInfo() async {
    final json = await fetchMe();
    return AuthUserInfo.fromJson(json);
  }

  Future<Map<String, dynamic>> fetchAgreements() {
    return _apiClient.getJson('/me/agreements', authenticated: true);
  }

  Future<Map<String, dynamic>> logout() {
    return _apiClient.postJson('/auth/logout', authenticated: true);
  }

  Future<Map<String, dynamic>> logoutAll() {
    return _apiClient.postJson('/auth/logout-all', authenticated: true);
  }

  Future<Map<String, dynamic>> acceptRequiredAgreements({
    String termsVersion = 'v1.0',
    String privacyVersion = 'v1.0',
  }) {
    return _apiClient.patchJson(
      '/me/agreements',
      body: {
        'termsAgreed': true,
        'termsVersion': termsVersion,
        'privacyAgreed': true,
        'privacyVersion': privacyVersion,
      },
    );
  }

  Future<Map<String, dynamic>> deleteAccount() {
    return _apiClient.deleteJson('/auth/me');
  }
}
