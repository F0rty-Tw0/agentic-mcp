import { isProviderJsonRecord } from './output-text.util';
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

export const unwrapResultEnvelope = (event?: ProviderJsonRecord): ProviderJsonRecord | undefined => {
  if (event === undefined) return;

  const nestedResult = event.result;

  if (isProviderJsonRecord(nestedResult)) return nestedResult;

  return event;
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
