class AgreementStatus {
  const AgreementStatus({
    required this.termsAgreed,
    required this.privacyAgreed,
    this.termsVersion,
    this.privacyVersion,
  });

  final bool termsAgreed;
  final bool privacyAgreed;
  final String? termsVersion;
  final String? privacyVersion;

  bool get needsRequiredAgreements => !termsAgreed || !privacyAgreed;

  factory AgreementStatus.fromJson(Map<String, dynamic> json) {
    final source = json['agreements'] is Map<String, dynamic>
        ? json['agreements'] as Map<String, dynamic>
        : json;

    return AgreementStatus(
      termsAgreed: source['termsAgreed'] == true,
      privacyAgreed: source['privacyAgreed'] == true,
      termsVersion: source['termsVersion']?.toString(),
      privacyVersion: source['privacyVersion']?.toString(),
    );
  }
}
