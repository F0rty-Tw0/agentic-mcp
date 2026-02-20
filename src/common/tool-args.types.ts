export type AskToolArgs = Readonly<{
  prompt?: string;
  model?: string;
  session_id?: string;
  working_directory?: string;
  files?: readonly string[];
  auto_mode?: boolean;
  sandbox?: string | boolean;
}>;

export type BuiltArgs = Readonly<{
  args: readonly string[];
  stdinInput?: string;
}>;
