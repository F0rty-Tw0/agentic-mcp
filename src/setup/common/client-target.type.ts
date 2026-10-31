export type SetupMergeStatus =
  'created' | 'merged' | 'unchanged' | 'invalid-json' | 'invalid-toml' | 'rewrite-unsafe' | 'unmergeable';

// Why a TOML merge rewrote the whole file instead of appending a table.
export type TomlRewriteCause = 'new-entry' | 'existing-entry';

export type ClientConfigMergeResult = {
  readonly status: SetupMergeStatus;
  readonly configText: string;
  readonly notes: string[];
  readonly rewritten: boolean;
  readonly rewriteCause?: TomlRewriteCause;
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

// A variable that moves the client's config: the client reads <value>/<relativePath> (the value itself when empty).
export type ConfigPathEnvRule = {
  readonly key: string;
  readonly relativePath: string;
};

export type ClientTarget = {
  readonly configPath?: string;
  readonly format: ClientConfigFormat;
  readonly serversKey: string;
  readonly timeoutKeys: TimeoutKeyRule[];
  readonly preservedKeys: string[];
  readonly configPathEnvRules: ConfigPathEnvRule[];
  readonly timeoutNote?: string;
  // A timeout key setup never writes but keeps; a value below the tool-call timeout gets a warning note.
  readonly keptTimeoutKey?: string;
};

export type ClientToolTimeoutSource = 'providers-config' | 'defaults';

// The tool-call limit setup writes: the longest provider run plus the longest queue wait plus a margin.
export type ClientToolTimeout = {
  readonly ms: number;
  readonly runMs: number;
  readonly queueMs: number;
  readonly source: ClientToolTimeoutSource;
  readonly fallbackReason?: string;
};
