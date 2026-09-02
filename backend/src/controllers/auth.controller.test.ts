import assert from 'node:assert/strict';
import test from 'node:test';
import { Request, Response } from 'express';
import { signup } from './auth.controller';

test('email signup is permanently disabled without inspecting the request body', async () => {
  let statusCode = 0;
  let responseBody: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;

  await signup({ body: {} } as Request, response);

  assert.equal(statusCode, 410);
  assert.deepEqual(responseBody, {
    success: false,
    message: 'Email sign up is no longer available. Continue with Google.',
  });
});
