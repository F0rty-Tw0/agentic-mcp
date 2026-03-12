import type { McpErrorResponse } from '../../../mcp-protocol/common';
import { MAX_ERROR_STDERR_BYTES } from '../execution-limits.const';

export type CommandExecutionErrorDetails = Readonly<{
  exitCode?: number | null;
  signal?: string | null;
  timedOut?: boolean;
  stderr?: string;
  output?: string;
}>;

export type QueueTimeoutErrorDetails = Readonly<{
  providerName: string;
  waitMs: number;
  queueTimeoutMs: number;
}>;

const capErrorDetail = (text: string, channel: 'stderr' | 'output'): string => {
  const detailBytes = Buffer.byteLength(text, 'utf8');

  if (detailBytes <= MAX_ERROR_STDERR_BYTES) return text;

  const cappedDetail = Buffer.from(text, 'utf8').subarray(0, MAX_ERROR_STDERR_BYTES).toString('utf8');

  return `${cappedDetail}\n[${channel} truncated]`;
};

const buildQueueTimeoutMessage = (details: QueueTimeoutErrorDetails): string => {
  return `Queue timeout for provider "${details.providerName}": waited ${details.waitMs}ms (limit: ${details.queueTimeoutMs}ms).`;
};

export class CommandExecutionError extends Error {
  public readonly exitCode?: number | null;
  public readonly signal?: string | null;
  public readonly timedOut?: boolean;
  public readonly stderr?: string;
  public readonly output?: string;

  public constructor(message: string, details: CommandExecutionErrorDetails, options?: ErrorOptions) {
    super(message, options);
    this.name = CommandExecutionError.name;
    this.exitCode = details.exitCode;
    this.signal = details.signal;
    this.timedOut = details.timedOut;
    this.stderr = details.stderr;
    this.output = details.output;
  }

  public toMcpResponse(): McpErrorResponse {
    const parts: string[] = [this.message];

    if (this.timedOut) {
      parts.push('Process timed out.');
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

    const mcpErrorResponse: McpErrorResponse = {
      isError: true,
      content: [{ type: 'text', text: parts.join(' ') }],
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
    const mcpErrorResponse: McpErrorResponse = {
      isError: true,
      content: [{ type: 'text', text: this.message }],
    };

    return mcpErrorResponse;
  }
}
