import { describe, expect, it } from 'vitest';

import {
  describeEnvelopeStatus,
  describeFinishedReason,
  extractFinalEnvelope,
  hasEnvelopeFailure,
  unwrapResultEnvelope,
} from './result-envelope.util';
import type { ProviderJsonRecord } from '../common';

describe('FEATURE: result envelope reading', () => {
  describe('GIVEN an envelope failure check', () => {
    it('WHEN the error is an object THEN the envelope reports a failure', () => {
      const error: ProviderJsonRecord = { message: 'quota' };
      const envelope: ProviderJsonRecord = { response: 'partial', error };

      const hasFailure = hasEnvelopeFailure(envelope);

      expect(hasFailure).toBe(true);
    });

    it('WHEN a result event carries an error outside its nested result THEN the envelope reports a failure', () => {
      const nestedResult: ProviderJsonRecord = { response: 'partial' };
      const event: ProviderJsonRecord = { event: 'result', error: 'boom', result: nestedResult };

      const hasFailure = hasEnvelopeFailure(event);

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

    it('WHEN a result event nests the status THEN the note names the nested status', () => {
      const nestedResult: ProviderJsonRecord = { status: 'ERROR', response: 'answer' };
      const event: ProviderJsonRecord = { event: 'result', result: nestedResult };

      const note = describeEnvelopeStatus('antigravity', event);

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

  describe('GIVEN a finished_reason', () => {
    it('WHEN it is blank THEN there is no note', () => {
      const envelope: ProviderJsonRecord = { response: 'answer', finished_reason: '' };

      const note = describeFinishedReason('antigravity', envelope);

      expect(note).toBeUndefined();
    });

    it('WHEN it means a normal finish THEN there is no note', () => {
      const envelope: ProviderJsonRecord = { response: 'answer', finished_reason: 'stop' };

      const note = describeFinishedReason('claude', envelope);

      expect(note).toBeUndefined();
    });

    it('WHEN it is an upper-case token limit THEN the note names it', () => {
      const envelope: ProviderJsonRecord = { response: 'answer', finished_reason: 'MAX_TOKENS' };

      const note = describeFinishedReason('gemini', envelope);

      expect(note).toContain('"MAX_TOKENS"');
    });

    it('WHEN it means a cut-off answer THEN the note names it', () => {
      const envelope: ProviderJsonRecord = { response: 'answer', finished_reason: 'print_timeout' };

      const note = describeFinishedReason('antigravity', envelope);

      expect(note).toContain('"print_timeout"');
    });
  });

  describe('GIVEN the final envelope of a run', () => {
    it('WHEN a json run printed an envelope with an empty answer THEN it is still returned', () => {
      const envelope = extractFinalEnvelope('{"response":"","finished_reason":"print_timeout"}', 'json');

      expect(envelope?.finished_reason).toBe('print_timeout');
    });

    it('WHEN a text run printed JSON THEN there is no envelope', () => {
      const envelope = extractFinalEnvelope('{"response":"answer"}', 'text');

      expect(envelope).toBeUndefined();
    });
  });
});
