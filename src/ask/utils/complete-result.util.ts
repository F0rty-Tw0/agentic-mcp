import {
  extractParsedText,
  extractTerminalResultText,
  parseStructuredLine,
  splitTrimmedLines,
} from './output-text.util';
import { stripAnsi } from '../../shared';
import type { ExecutionResult, ResultCompleteDetector } from '../../shared/command-execution/common';
import type { OutputFormat } from '../../shared/mcp-protocol/common';
import type { ProviderConfig } from '../../shared/provider/common';

type TimeoutResultInput = {
  readonly providerName: string;
  readonly config: Pick<ProviderConfig, 'acceptResultOnTimeout'>;
  readonly result: Pick<ExecutionResult, 'stdout' | 'timedOut'>;
  readonly outputFormat: OutputFormat;
  readonly wasCancelled: boolean;
};

const toAnswerText = (text?: string): string | undefined => {
  const hasAnswer = text !== undefined && text.trim().length > 0;

  if (!hasAnswer) return;

  return text;
};

const extractJsonEnvelopeText = (stdout: string): string | undefined => {
  const envelope = parseStructuredLine(stdout.trim());
  const text = extractParsedText(envelope);

  return toAnswerText(text);
};

const extractLastResultEventText = (stdout: string): string | undefined => {
  const lastLine = splitTrimmedLines(stdout).at(-1);

  if (lastLine === undefined) return;

  const event = parseStructuredLine(lastLine);
  const text = extractTerminalResultText(event);

  return toAnswerText(text);
};

const extractCompleteResultText = (stdout: string, outputFormat: OutputFormat): string | undefined => {
  const cleanOutput = stripAnsi(stdout);

  if (outputFormat === 'json') return extractJsonEnvelopeText(cleanOutput);

  if (outputFormat === 'stream-json') return extractLastResultEventText(cleanOutput);

  return;
};

const hasCompleteResult = (stdout: string, outputFormat: OutputFormat): boolean => {
  const completeText = extractCompleteResultText(stdout, outputFormat);

  return completeText !== undefined;
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

  const completeText = extractCompleteResultText(result.stdout, outputFormat);

  if (completeText === undefined) return;

  const warning = `${providerName} did not exit after printing a complete result, so it was stopped; the printed result is returned.`;

  return warning;
};
