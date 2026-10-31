export type SetupMergeStatus =
  'created' | 'merged' | 'unchanged' | 'invalid-json' | 'invalid-toml' | 'rewrite-unsafe' | 'unmergeable';

export type ClientConfigMergeResult = {
  readonly status: SetupMergeStatus;
  readonly configText: string;
  readonly notes: string[];
  readonly rewritten: boolean;
  readonly reason?: string;
};

export type StdioServerEntry = {
  readonly command: string;
  readonly args: string[];
  readonly timeout?: number;
};

export type CopilotServerEntry = {
  readonly type: 'local';
  readonly command: string;
  readonly args: string[];
  readonly tools: string[];
  readonly timeout: number;
};

export type CodexServerEntry = {
  readonly command: string;
  readonly args: string[];
  readonly tool_timeout_sec: number;
  readonly startup_timeout_sec: number;
};

export type OpenCodeServerEntry = {
  readonly type: 'local';
  readonly command: string[];
  readonly enabled: boolean;
  readonly timeout: number;
};

export type McpServerEntry = StdioServerEntry | CodexServerEntry | CopilotServerEntry | OpenCodeServerEntry;

export type ClientConfigFormat = 'json' | 'toml';

export type TimeoutKeyRule = {
  readonly key: string;
  readonly msAliasKey?: string;
};

export type ClientTarget = {
  readonly configPath?: string;
  readonly format: ClientConfigFormat;
  readonly serversKey: string;
  readonly timeoutKeys: TimeoutKeyRule[];
  readonly preservedKeys: string[];
};
