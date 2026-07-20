import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:myanitrack_mobile/src/api.dart';

void main() {
  Future<ApiFailure> requestFailure(
    int statusCode,
    String message, {
    void Function(ApiFailure failure)? onSessionFailure,
  }) async {
    final dio = Dio()..httpClientAdapter = _StatusAdapter(statusCode, message);
    final client = ApiClient(dio: dio, onSessionFailure: onSessionFailure);

    try {
      await client.get('/test', authenticated: false);
      fail('요청이 실패해야 합니다.');
    } on ApiFailure catch (failure) {
      return failure;
    }
  }

  test('401은 세션 만료 이벤트로 전달한다', () async {
    ApiFailure? event;
    final failure = await requestFailure(
      401,
      'Unauthorized',
      onSessionFailure: (value) => event = value,
    );

    expect(failure.kind, ApiFailureKind.unauthorized);
    expect(event?.kind, ApiFailureKind.unauthorized);
  });

  test('약관 관련 403만 약관 게이트 이벤트로 전달한다', () async {
    ApiFailure? event;
    final failure = await requestFailure(
      403,
      'Required terms agreement is missing',
      onSessionFailure: (value) => event = value,
    );

    expect(failure.kind, ApiFailureKind.agreements);
    expect(event?.kind, ApiFailureKind.agreements);
  });

  test('일반 403은 로그아웃 이벤트로 오인하지 않는다', () async {
    ApiFailure? event;
    final failure = await requestFailure(
      403,
      'Forbidden',
      onSessionFailure: (value) => event = value,
    );

    expect(failure.kind, ApiFailureKind.unknown);
    expect(event, isNull);
  });
}

class _StatusAdapter implements HttpClientAdapter {
  const _StatusAdapter(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      jsonEncode({'success': false, 'message': message}),
      statusCode,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
