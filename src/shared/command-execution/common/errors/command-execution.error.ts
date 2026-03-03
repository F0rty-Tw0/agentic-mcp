import type { McpErrorResponse } from '../../../mcp-protocol/common';
import { MAX_ERROR_STDERR_BYTES } from '../execution-limits.const';

export type CommandExecutionErrorDetails = Readonly<{
  exitCode?: number | null;
  signal?: string | null;
  timedOut?: boolean;
  stderr?: string;
}>;

export class CommandExecutionError extends Error {
  public readonly exitCode?: number | null;
  public readonly signal?: string | null;
  public readonly timedOut?: boolean;
  public readonly stderr?: string;

  public constructor(message: string, details: CommandExecutionErrorDetails, options?: ErrorOptions) {
    super(message, options);
    this.name = CommandExecutionError.name;
    this.exitCode = details.exitCode;
    this.signal = details.signal;
    this.timedOut = details.timedOut;
    this.stderr = details.stderr;
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
      const stderrBytes = Buffer.byteLength(this.stderr, 'utf8');
      const stderrText =
        stderrBytes > MAX_ERROR_STDERR_BYTES
          ? `${Buffer.from(this.stderr, 'utf8').subarray(0, MAX_ERROR_STDERR_BYTES).toString('utf8')}\n[stderr truncated]`
          : this.stderr;

      parts.push(`Stderr: ${stderrText}`);
    }

    const mcpErrorResponse: McpErrorResponse = {
      isError: true,
      content: [{ type: 'text', text: parts.join(' ') }],
    };

    return mcpErrorResponse;
  }
}
