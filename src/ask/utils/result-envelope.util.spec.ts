import { describe, expect, it } from 'vitest';

import { describeEnvelopeStatus, hasEnvelopeFailure, unwrapResultEnvelope } from './result-envelope.util';
import type { ProviderJsonRecord } from '../common';

describe('FEATURE: result envelope reading', () => {
  describe('GIVEN an envelope failure check', () => {
    it('WHEN the error is an object THEN the envelope reports a failure', () => {
      const error: ProviderJsonRecord = { message: 'quota' };
      const envelope: ProviderJsonRecord = { response: 'partial', error };

      const hasFailure = hasEnvelopeFailure(envelope);

      expect(hasFailure).toBe(true);
    });

    it('WHEN the error is blank text THEN the envelope reports no failure', () => {
      const envelope: ProviderJsonRecord = { response: 'answer', error: '  ' };

      const hasFailure = hasEnvelopeFailure(envelope);

      expect(hasFailure).toBe(false);
    });

    it('WHEN the run finished with reason interrupted THEN the envelope reports a failure', () => {
      const envelope: ProviderJsonRecord = { response: 'partial', finished_reason: 'interrupted' };

      const hasFailure = hasEnvelopeFailure(envelope);

      expect(hasFailure).toBe(true);
    });

    it('WHEN the run finished with reason print_timeout THEN the envelope reports no failure', () => {
      const envelope: ProviderJsonRecord = { response: 'partial', finished_reason: 'print_timeout' };

      const hasFailure = hasEnvelopeFailure(envelope);

      expect(hasFailure).toBe(false);
    });
  });

  describe('GIVEN an envelope status', () => {
    it('WHEN the status is ERROR THEN a note names the provider and the status', () => {
      const envelope: ProviderJsonRecord = { status: 'ERROR' };

      const note = describeEnvelopeStatus('antigravity', envelope);

      expect(note).toBe('antigravity reported status ERROR.');
    });

    it('WHEN the status is SUCCESS THEN there is no note', () => {
      const envelope: ProviderJsonRecord = { status: 'SUCCESS' };

      const note = describeEnvelopeStatus('antigravity', envelope);

      expect(note).toBeUndefined();
    });
  });

  describe('GIVEN a result event', () => {
    it('WHEN its result is an object THEN that nested object is the envelope', () => {
      const nestedResult: ProviderJsonRecord = { response: 'answer' };
      const event: ProviderJsonRecord = { event: 'result', result: nestedResult };

      const envelope = unwrapResultEnvelope(event);

      expect(envelope).toBe(nestedResult);
    });

    it('WHEN its result is text THEN the event itself is the envelope', () => {
      const event: ProviderJsonRecord = { type: 'result', result: 'answer' };

      const envelope = unwrapResultEnvelope(event);

      expect(envelope).toBe(event);
    });
  });
});
