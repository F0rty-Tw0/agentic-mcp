import type { McpErrorResponse, McpTextContent } from '../../../mcp-protocol/common';
import type { ExecutionTimeoutCause } from '../command-executor.type';
import { MAX_ERROR_STDERR_BYTES, MS_PER_SECOND } from '../execution-limits.const';
import type { CommandExecutionErrorDetails, QueueTimeoutErrorDetails } from './command-execution-error.type';

const capErrorDetail = (text: string, channel: 'stderr' | 'output'): string => {
  const detailBytes = Buffer.byteLength(text, 'utf8');

  if (detailBytes <= MAX_ERROR_STDERR_BYTES) return text;

  const cappedDetail = Buffer.from(text, 'utf8').subarray(0, MAX_ERROR_STDERR_BYTES).toString('utf8');

  return `${cappedDetail}\n[${channel} truncated]`;
};

const formatDuration = (durationMs: number): string => {
  if (durationMs < MS_PER_SECOND) return `${durationMs} ms`;

  const durationSeconds = Math.round(durationMs / MS_PER_SECOND);
  const formattedDuration = `${durationSeconds} s`;

  return formattedDuration;
};

const buildTimeoutText = (timeoutCause?: ExecutionTimeoutCause): string => {
  if (!timeoutCause) return 'Process timed out.';

  const limit = formatDuration(timeoutCause.limitMs);
  const idleText = `Process killed after no output for ${limit} (provider idleTimeout).`;

  if (timeoutCause.kind === 'idle') return idleText;

  const wallClockText = `Process timed out after ${limit} (provider timeout).`;

  return wallClockText;
};

const buildQueueTimeoutMessage = (details: QueueTimeoutErrorDetails): string => {
  const { providerName } = details;
  const waited = formatDuration(details.waitMs);
  const limit = formatDuration(details.queueTimeoutMs);
  const busyText = `Queue timeout for provider "${providerName}": the provider is busy with other calls; waited ${waited} for a free slot (limit: ${limit}).`;
  const adviceText = `Retry later, or call ask_${providerName} with mode: "async" and poll the job with action: "status".`;
  const message = `${busyText} ${adviceText}`;

  return message;
};

export class CommandExecutionError extends Error {
  public readonly exitCode?: number | null;
  public readonly signal?: string | null;
  public readonly timedOut?: boolean;
  public readonly timeoutCause?: ExecutionTimeoutCause;
  public readonly stderr?: string;
  public readonly output?: string;

  public constructor(message: string, details: CommandExecutionErrorDetails, options?: ErrorOptions) {
    super(message, options);
    this.name = CommandExecutionError.name;
    this.exitCode = details.exitCode;
    this.signal = details.signal;
    this.timedOut = details.timedOut;
    this.timeoutCause = details.timeoutCause;
    this.stderr = details.stderr;
    this.output = details.output;
  }

  public toMcpResponse(): McpErrorResponse {
    const parts: string[] = [this.message];

    if (this.timedOut) {
      parts.push(buildTimeoutText(this.timeoutCause));
    } else if (this.signal != null) {
      parts.push(`Killed by signal: ${this.signal}.`);
    } else if (this.exitCode != null) {
      parts.push(`Exit code: ${this.exitCode}.`);
    }

    if (this.stderr?.length) {
      parts.push(`Stderr: ${capErrorDetail(this.stderr, 'stderr')}`);
    }

    if (this.output?.length && this.output !== this.stderr) {
      parts.push(`Output: ${capErrorDetail(this.output, 'output')}`);
    }

    const content: McpTextContent[] = [{ type: 'text', text: parts.join(' ') }];
    const mcpErrorResponse: McpErrorResponse = {
      isError: true,
      content,
    };

    return mcpErrorResponse;
  }
}

export class QueueTimeoutError extends CommandExecutionError {
  public readonly providerName: string;
  public readonly waitMs: number;
  public readonly queueTimeoutMs: number;

  public constructor(details: QueueTimeoutErrorDetails, options?: ErrorOptions) {
    super(buildQueueTimeoutMessage(details), {}, options);
    this.name = QueueTimeoutError.name;
    this.providerName = details.providerName;
    this.waitMs = details.waitMs;
    this.queueTimeoutMs = details.queueTimeoutMs;
  }

  public override toMcpResponse(): McpErrorResponse {
    const content: McpTextContent[] = [{ type: 'text', text: this.message }];
    const mcpErrorResponse: McpErrorResponse = {
      isError: true,
      content,
    };

    return mcpErrorResponse;
  }
}
