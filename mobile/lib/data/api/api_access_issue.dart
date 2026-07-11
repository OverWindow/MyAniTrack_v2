import 'api_exception.dart';

class ApiAccessIssue {
  const ApiAccessIssue({
    required this.title,
    required this.message,
    required this.needsAgreements,
  });

  final String title;
  final String message;
  final bool needsAgreements;

  static ApiAccessIssue? from(Object error) {
    if (error is! ApiException) {
      return null;
    }

    if (error.statusCode == 401) {
      return const ApiAccessIssue(
        title: '로그인이 필요합니다.',
        message: 'Google 로그인 후 내 컬렉션과 분석 데이터를 불러올 수 있습니다.',
        needsAgreements: false,
      );
    }

    if (error.statusCode == 403) {
      return ApiAccessIssue(
        title: '약관 동의가 필요합니다.',
        message: error.message.isEmpty
            ? '필수 약관 동의 후 내 컬렉션과 분석 API를 사용할 수 있습니다.'
            : error.message,
        needsAgreements: true,
      );
    }

    return null;
  }
}
