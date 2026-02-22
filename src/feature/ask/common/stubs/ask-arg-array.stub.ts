type AskArgArray = Readonly<{
  args: readonly string[];
  stdinInput: string | undefined;
}>;

export const ASK_DEFAULT_ARG_ARRAY_STUB: AskArgArray = {
  args: ['exec', 'test prompt'],
  stdinInput: undefined,
};

export const ASK_STDIN_ARG_ARRAY_STUB: AskArgArray = {
  args: ['exec'],
  stdinInput: 'test prompt',
};
