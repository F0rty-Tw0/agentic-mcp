import {
  extractParsedText,
  extractTerminalResultText,
  parseStructuredLine,
  splitTrimmedLines,
} from './output-text.util';
import { describeEnvelopeStatus, hasEnvelopeFailure, unwrapResultEnvelope } from './result-envelope.util';
import { stripAnsi } from '../../shared';
import type { ExecutionResult, ResultCompleteDetector } from '../../shared/command-execution/common';
import type { OutputFormat } from '../../shared/mcp-protocol/common';
import type { ProviderConfig } from '../../shared/provider/common';
import type { ProviderJsonRecord } from '../common';

type TimeoutResultInput = {
  readonly providerName: string;
  readonly config: Pick<ProviderConfig, 'acceptResultOnTimeout'>;
  readonly result: Pick<ExecutionResult, 'stdout' | 'timedOut'>;
  readonly outputFormat: OutputFormat;
  readonly wasCancelled: boolean;
};

const hasAnswerText = (text?: string): boolean => {
  const hasAnswer = text !== undefined && text.trim().length > 0;

  return hasAnswer;
};

const toCompleteEnvelope = (envelope?: ProviderJsonRecord, text?: string): ProviderJsonRecord | undefined => {
  const hasAnswer = hasAnswerText(text);

  if (!hasAnswer) return;

  return envelope;
};

const extractJsonEnvelope = (stdout: string): ProviderJsonRecord | undefined => {
  const envelope = parseStructuredLine(stdout.trim());
  const text = extractParsedText(envelope);

  return toCompleteEnvelope(envelope, text);
};

const extractLastResultEnvelope = (stdout: string): ProviderJsonRecord | undefined => {
  const lastLine = splitTrimmedLines(stdout).at(-1);

  if (lastLine === undefined) return;

  const event = parseStructuredLine(lastLine);
  const text = extractTerminalResultText(event);
  const envelope = unwrapResultEnvelope(event);

  return toCompleteEnvelope(envelope, text);
};

const extractCompleteEnvelope = (stdout: string, outputFormat: OutputFormat): ProviderJsonRecord | undefined => {
  const cleanOutput = stripAnsi(stdout);

  if (outputFormat === 'json') return extractJsonEnvelope(cleanOutput);

  if (outputFormat === 'stream-json') return extractLastResultEnvelope(cleanOutput);

  return;
};

const hasCompleteResult = (stdout: string, outputFormat: OutputFormat): boolean => {
  const envelope = extractCompleteEnvelope(stdout, outputFormat);

  return envelope !== undefined;
};

const createJsonEnvelopeDetector = (): ResultCompleteDetector => {
  let output = '';

  return (chunk: string): boolean => {
    output += chunk;

    const mayCloseEnvelope = chunk.trimEnd().endsWith('}');

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
