type AskArgArray = Readonly<{
  args: readonly string[];
  stdinInput?: string;
  outputFormat: 'json' | 'stream-json' | 'text';
}>;

export const ASK_DEFAULT_ARG_ARRAY_STUB: AskArgArray = {
  args: ['exec', 'test prompt'],
  stdinInput: undefined,
  outputFormat: 'json',
};

export const ASK_STDIN_ARG_ARRAY_STUB: AskArgArray = {
  args: ['exec'],
  stdinInput: 'test prompt',
  outputFormat: 'json',
};
