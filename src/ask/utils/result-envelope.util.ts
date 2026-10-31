import {
  extractParsedText,
  extractTerminalResultText,
  isProviderJsonRecord,
  parseStructuredLine,
  splitTrimmedLines,
} from './output-text.util';
import { stripAnsi } from '../../shared';
import type { OutputFormat } from '../../shared/mcp-protocol/common';
import { FAILED_FINISHED_REASONS, PARTIAL_FINISHED_REASONS, SUCCESS_STATUS } from '../common';
import type { ProviderJsonRecord } from '../common';

const readEnvelopeString = (envelope: ProviderJsonRecord, key: string): string | undefined => {
  const value = envelope[key];

  if (typeof value !== 'string') return;

  return value;
};

const hasErrorValue = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0;

  const isErrorRecord = isProviderJsonRecord(value);

  return isErrorRecord;
};

const hasAnswerText = (text?: string): boolean => {
  const hasAnswer = text !== undefined && text.trim().length > 0;

  return hasAnswer;
};

const parseLastLine = (stdout: string): ProviderJsonRecord | undefined => {
  const lastLine = splitTrimmedLines(stdout).at(-1);

  if (lastLine === undefined) return;

  const lastRecord = parseStructuredLine(lastLine);

  return lastRecord;
};

const readNestedResult = (event: ProviderJsonRecord): ProviderJsonRecord => {
  const nestedResult = event.result;

  if (isProviderJsonRecord(nestedResult)) return nestedResult;

  return event;
};

export const unwrapResultEnvelope = (event?: ProviderJsonRecord): ProviderJsonRecord | undefined => {
  if (event === undefined) return;

  const envelope = readNestedResult(event);

  return envelope;
};

const extractJsonEnvelope = (stdout: string): ProviderJsonRecord | undefined => {
  const envelope = parseStructuredLine(stdout.trim());
  const text = extractParsedText(envelope);
  const hasAnswer = hasAnswerText(text);

  if (!hasAnswer) return;

  return envelope;
};

const extractLastResultEnvelope = (stdout: string): ProviderJsonRecord | undefined => {
  const event = parseLastLine(stdout);
  const text = extractTerminalResultText(event);
  const hasAnswer = hasAnswerText(text);

  if (!hasAnswer) return;

  return event;
};

export const extractCompleteEnvelope = (stdout: string, outputFormat: OutputFormat): ProviderJsonRecord | undefined => {
  const cleanOutput = stripAnsi(stdout);

  if (outputFormat === 'json') return extractJsonEnvelope(cleanOutput);

  if (outputFormat === 'stream-json') return extractLastResultEnvelope(cleanOutput);

  return;
};

export const extractFinalEnvelope = (stdout: string, outputFormat: OutputFormat): ProviderJsonRecord | undefined => {
  const cleanOutput = stripAnsi(stdout);

  if (outputFormat === 'json') return parseStructuredLine(cleanOutput.trim());

  if (outputFormat !== 'stream-json') return;

  const lastRecord = parseLastLine(cleanOutput);

  return unwrapResultEnvelope(lastRecord);
};

const hasRecordFailure = (record: ProviderJsonRecord): boolean => {
  const hasError = hasErrorValue(record.error);
  const finishedReason = readEnvelopeString(record, 'finished_reason') ?? '';
  const hasFailedFinish = FAILED_FINISHED_REASONS.includes(finishedReason);

  return hasError || hasFailedFinish;
};

// A stream-json result event can report the failure on the event itself or on its nested result.
export const hasEnvelopeFailure = (envelope: ProviderJsonRecord): boolean => {
  const nestedResult = readNestedResult(envelope);
  const hasFailure = hasRecordFailure(envelope) || hasRecordFailure(nestedResult);

  return hasFailure;
};

export const describeEnvelopeStatus = (providerName: string, envelope: ProviderJsonRecord): string | undefined => {
  const nestedResult = readNestedResult(envelope);
  const status = readEnvelopeString(nestedResult, 'status');

  if (status === undefined || status === SUCCESS_STATUS) return;

  const statusNote = `${providerName} reported status ${status}.`;

  return statusNote;
};

export const describeFinishedReason = (providerName: string, envelope: ProviderJsonRecord): string | undefined => {
  const finishedReason = readEnvelopeString(envelope, 'finished_reason');

  if (finishedReason === undefined) return;

  const normalizedReason = finishedReason.toLowerCase();
  const isPartial = PARTIAL_FINISHED_REASONS.includes(normalizedReason);

  if (!isPartial) return;

  const finishedReasonNote = `${providerName} finished with finished_reason "${finishedReason}", so the answer may be partial.`;

  return finishedReasonNote;
};
