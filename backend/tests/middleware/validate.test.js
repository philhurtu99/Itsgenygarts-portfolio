import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';
import { validate } from '../../src/middleware/validate.js';

function makeRes() {
  return {
    status: jest.fn(function (code) { this.statusCode = code; return this; }),
    json: jest.fn(function (body) { this.body = body; return this; }),
  };
}

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().min(0),
  });

  it('calls next and replaces req.body with parsed data on success', () => {
    const req = { body: { name: 'Alice', age: 30 } };
    const res = makeRes();
    const next = jest.fn();

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns 400 with the first error message on failure', () => {
    const req = { body: { name: 'A', age: 30 } };
    const res = makeRes();
    const next = jest.fn();

    validate(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeDefined();
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors[0]).toHaveProperty('path');
    expect(res.body.errors[0]).toHaveProperty('message');
  });

  it('reports multiple issues', () => {
    const req = { body: { name: 'A', age: -1 } };
    const res = makeRes();
    const next = jest.fn();

    validate(schema)(req, res, next);

    expect(res.body.errors.length).toBeGreaterThanOrEqual(2);
  });
});
