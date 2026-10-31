import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { toInputSchema } from './input-schema.util';

describe('toInputSchema', () => {
  describe('GIVEN a raw zod shape', () => {
    const shape = { prompt: z.string() };

    describe('WHEN it is wrapped', () => {
      it('THEN the object schema accepts input matching the shape', () => {
        const inputSchema = toInputSchema(shape);
        const parsed = inputSchema.parse({ prompt: 'hello' });

        expect(parsed).toStrictEqual({ prompt: 'hello' });
      });

      it('THEN the object schema rejects input missing a required field', () => {
        const inputSchema = toInputSchema(shape);
        const parsed = inputSchema.safeParse({});

        expect(parsed.success).toBe(false);
      });
    });
  });

  describe('GIVEN no shape', () => {
    describe('WHEN it is wrapped', () => {
      it('THEN the object schema accepts an empty object', () => {
        const inputSchema = toInputSchema();
        const parsed = inputSchema.parse({});

        expect(parsed).toStrictEqual({});
      });
    });
  });
});
