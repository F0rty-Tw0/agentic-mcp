import { createJsonObjectScanner } from './json-object-scanner.util';
import {
  describeEnvelopeStatus,
  describeFinishedReason,
  extractCompleteEnvelope,
  extractFinalEnvelope,
  hasEnvelopeFailure,
} from './result-envelope.util';
import { MAX_OUTPUT_BYTES } from '../../shared/command-execution/common';
import type { ExecutionResult, ResultCompleteDetector } from '../../shared/command-execution/common';
import type { OutputFormat } from '../../shared/mcp-protocol/common';
import type { ProviderConfig } from '../../shared/provider/common';
import type { ResultWarnings } from '../common';

type TimeoutResultInput = {
  readonly providerName: string;
  readonly config: Pick<ProviderConfig, 'acceptResultOnTimeout'>;
  readonly result: Pick<ExecutionResult, 'stdout' | 'timedOut'>;
  readonly outputFormat: OutputFormat;
  readonly wasCancelled: boolean;
};

const hasCompleteResult = (stdout: string, outputFormat: OutputFormat): boolean => {
  const envelope = extractCompleteEnvelope(stdout, outputFormat);

  return envelope !== undefined;
};

const createJsonEnvelopeDetector = (): ResultCompleteDetector => {
  const closesTopLevelObject = createJsonObjectScanner();
  let output = '';
  let outputBytes = 0;

  return (chunk: string): boolean => {
    outputBytes += Buffer.byteLength(chunk, 'utf8');

    if (outputBytes > MAX_OUTPUT_BYTES) {
      output = '';

      return false;
    }

    output += chunk;

    const mayCloseEnvelope = closesTopLevelObject(chunk);

    if (!mayCloseEnvelope) return false;

    return hasCompleteResult(output, 'json');
  };
};

// Reads each stream-json line once; the unterminated tail is also checked so a result without a newline counts.
const createStreamJsonResultDetector = (): ResultCompleteDetector => {
  let pendingLine = '';

  return (chunk: string): boolean => {
    const bufferedOutput = `${pendingLine}${chunk}`;
    const lines = bufferedOutput.split(/\r?\n/);

    pendingLine = lines.pop() ?? '';

    const candidateLines = [...lines, pendingLine];
    const isComplete = candidateLines.some((line) => hasCompleteResult(line, 'stream-json'));

    return isComplete;
  };
};

const neverComplete: ResultCompleteDetector = () => false;

export const createResultEnvelopeDetector = (outputFormat: OutputFormat): ResultCompleteDetector => {
  if (outputFormat === 'json') return createJsonEnvelopeDetector();

  if (outputFormat === 'stream-json') return createStreamJsonResultDetector();

  return neverComplete;
};

export const resolveTimeoutResultWarning = (timeoutResultInput: TimeoutResultInput): string | undefined => {
  const { providerName, config, result, outputFormat, wasCancelled } = timeoutResultInput;

  if (!config.acceptResultOnTimeout || wasCancelled || !result.timedOut) return;

  const envelope = extractCompleteEnvelope(result.stdout, outputFormat);

  if (envelope === undefined) return;

  const hasFailure = hasEnvelopeFailure(envelope);

  if (hasFailure) return;

  const stopNote = `${providerName} did not exit after printing a complete result, so it was stopped; the printed result is returned.`;
  const statusNote = describeEnvelopeStatus(providerName, envelope);
  const notes = [stopNote, statusNote];
  const warning = notes.filter((note) => note !== undefined).join(' ');

  return warning;
};

const resolveFinishedReasonNote = (timeoutResultInput: TimeoutResultInput): string | undefined => {
  const { providerName, result, outputFormat } = timeoutResultInput;
  const envelope = extractFinalEnvelope(result.stdout, outputFormat);

  if (envelope === undefined) return;

  return describeFinishedReason(providerName, envelope);
};

export const resolveResultWarnings = (timeoutResultInput: TimeoutResultInput): ResultWarnings => {
  const acceptedWarning = resolveTimeoutResultWarning(timeoutResultInput);
  const finishedReasonNote = resolveFinishedReasonNote(timeoutResultInput);
  const candidateNotes = [acceptedWarning, finishedReasonNote];
  const notes = candidateNotes.filter((note) => note !== undefined);
  const joinedWarning = notes.join(' ');
  const warning = notes.length > 0 ? joinedWarning : undefined;
  const resultWarnings: ResultWarnings = { acceptedWarning, warning };

  return resultWarnings;
};
