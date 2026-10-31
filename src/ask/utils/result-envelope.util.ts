import {
  extractParsedText,
  extractTerminalResultText,
  isProviderJsonRecord,
  parseStructuredLine,
  splitTrimmedLines,
} from './output-text.util';
import { stripAnsi } from '../../shared';
import type { OutputFormat } from '../../shared/mcp-protocol/common';
import { FAILED_FINISHED_REASONS, SUCCESS_STATUS } from '../common';
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

export const unwrapResultEnvelope = (event?: ProviderJsonRecord): ProviderJsonRecord | undefined => {
  if (event === undefined) return;

  const nestedResult = event.result;

  if (isProviderJsonRecord(nestedResult)) return nestedResult;

  return event;
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

  return unwrapResultEnvelope(event);
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

export const hasEnvelopeFailure = (envelope: ProviderJsonRecord): boolean => {
  const hasError = hasErrorValue(envelope.error);
  const finishedReason = readEnvelopeString(envelope, 'finished_reason') ?? '';
  const hasFailedFinish = FAILED_FINISHED_REASONS.includes(finishedReason);

  return hasError || hasFailedFinish;
};

export const describeEnvelopeStatus = (providerName: string, envelope: ProviderJsonRecord): string | undefined => {
  const status = readEnvelopeString(envelope, 'status');

  if (status === undefined || status === SUCCESS_STATUS) return;

  const statusNote = `${providerName} reported status ${status}.`;

  return statusNote;
};

export const describeFinishedReason = (providerName: string, envelope: ProviderJsonRecord): string | undefined => {
  const finishedReason = readEnvelopeString(envelope, 'finished_reason');

  if (finishedReason === undefined || finishedReason.trim().length === 0) return;

  const finishedReasonNote = `${providerName} finished with finished_reason "${finishedReason}", so the answer may be partial.`;

  return finishedReasonNote;
};
