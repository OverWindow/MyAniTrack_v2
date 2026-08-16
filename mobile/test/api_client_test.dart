import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';

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

  test('프로필 이미지는 JPEG 파일명과 MIME 타입으로 전송한다', () async {
    final recorder = _ProfileRequestRecorder();
    final dio = Dio()..interceptors.add(recorder);
    final repository = ProfileRepository(ApiClient(dio: dio));

    final user = await repository.update(
      username: 'tester',
      profileImage: XFile.fromData(
        Uint8List.fromList([1, 2, 3]),
        name: 'picked.png',
        mimeType: 'image/png',
      ),
    );

    expect(user.id, 7);
    expect(recorder.filename, 'myanitrack-profile.jpg');
    expect(recorder.contentType, 'image/jpeg');
    expect(recorder.username, 'tester');
  });
}

class _ProfileRequestRecorder extends Interceptor {
  String? filename;
  String? contentType;
  String? username;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final form = options.data as FormData;
    username = form.fields
        .singleWhere((field) => field.key == 'username')
        .value;
    final image = form.files
        .singleWhere((file) => file.key == 'profileImage')
        .value;
    filename = image.filename;
    contentType = image.contentType?.toString();
    handler.resolve(
      Response<dynamic>(
        requestOptions: options,
        statusCode: 200,
        data: const {
          'success': true,
          'user': {'id': 7, 'email': 'user@example.com', 'username': 'tester'},
        },
      ),
    );
  }
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
