import type { McpErrorResponse } from './mcp-error-response.ts';

export type CommandExecutionErrorDetails = {
  exitCode?: number | null;
  signal?: string | null;
  timedOut?: boolean;
  stderr?: string;
};

export class CommandExecutionError extends Error {
  public readonly exitCode: number | null | undefined;
  public readonly signal: string | null | undefined;
  public readonly timedOut: boolean | undefined;
  public readonly stderr: string | undefined;

  public constructor(
    message: string,
    details: CommandExecutionErrorDetails,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'CommandExecutionError';
    this.exitCode = details.exitCode;
    this.signal = details.signal;
    this.timedOut = details.timedOut;
    this.stderr = details.stderr;
  }

  public toMcpResponse(): McpErrorResponse {
    const parts: string[] = [this.message];

    if (this.timedOut === true) {
      parts.push('Process timed out.');
    } else if (this.signal != null) {
      parts.push(`Killed by signal: ${this.signal}.`);
    } else if (this.exitCode != null) {
      parts.push(`Exit code: ${this.exitCode}.`);
    }

    if (this.stderr != null && this.stderr.length > 0) {
      parts.push(`Stderr: ${this.stderr}`);
    }

    return {
      isError: true,
      content: [{ type: 'text', text: parts.join(' ') }],
    };
  }
}
