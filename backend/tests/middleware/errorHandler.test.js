import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import errorHandler from '../../src/middleware/errorHandler.js';
import { localizeMessage } from '../../src/middleware/localizeResponses.js';

function makeRes() {
  return {
    status: jest.fn(function (code) { this.statusCode = code; return this; }),
    json: jest.fn(function (body) { this.body = body; return this; }),
  };
}

describe('errorHandler', () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('defaults to 500 + generic message when no status/message', () => {
    const err = {};
    const res = makeRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Internal server error' });
  });

  it('uses err.status and err.message when present', () => {
    const err = { status: 404, message: 'Not found' };
    const res = makeRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Not found' });
  });

  it('uses err.statusCode when err.status is missing', () => {
    const err = { statusCode: 422, message: 'Unprocessable' };
    const res = makeRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.statusCode).toBe(422);
  });

  it('includes err.errors when present', () => {
    const err = { status: 400, message: 'Bad', errors: [{ path: 'x', message: 'm' }] };
    const res = makeRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.body.errors).toEqual([{ path: 'x', message: 'm' }]);
  });

  it('omits errors field when not present', () => {
    const err = { status: 400, message: 'Bad' };
    const res = makeRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.body).not.toHaveProperty('errors');
  });

  it('logs the error to console.error', () => {
    const err = new Error('boom');
    const res = makeRes();
    errorHandler(err, {}, res, jest.fn());
    expect(console.error).toHaveBeenCalledWith(err);
  });

  it('hides internal error details in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const err = { status: 500, message: 'Database password rejected', errors: ['secret'] };
      const res = makeRes();
      errorHandler(err, {}, res, jest.fn());
      expect(res.body).toEqual({ success: false, message: 'Internal server error' });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('returns a safe public message without exposing internal diagnostics in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const err = { statusCode: 503, message: 'Private provider diagnostic', publicMessage: 'Le calcul des frais de livraison est indisponible pour le moment. Veuillez réessayer plus tard ou nous contacter.', errors: ['secret'] };
      const res = makeRes();
      errorHandler(err, { t: (message) => localizeMessage(message, 'en') }, res, jest.fn());
      expect(res.statusCode).toBe(503);
      expect(res.body).toEqual({ success: false, message: 'Shipping rates are currently unavailable. Please try again later or contact us.' });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
