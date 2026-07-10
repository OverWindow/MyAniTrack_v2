import '../api/api_client.dart';
import '../api/auth_repository.dart';
import '../models/agreement_status.dart';

class AuthOnboardingResult {
  const AuthOnboardingResult({
    required this.agreementStatus,
  });

  final AgreementStatus agreementStatus;

  bool get needsAgreements => agreementStatus.needsRequiredAgreements;
}

class AuthOnboardingService {
  AuthOnboardingService({
    AuthRepository? authRepository,
  }) : _authRepository = authRepository ?? AuthRepository(ApiClient());

  final AuthRepository _authRepository;

  Future<AuthOnboardingResult> connectAndCheckAgreements() async {
    await _authRepository.connectSupabaseSession();
    final agreementsJson = await _authRepository.fetchAgreements();

    return AuthOnboardingResult(
      agreementStatus: AgreementStatus.fromJson(agreementsJson),
    );
  }
}
