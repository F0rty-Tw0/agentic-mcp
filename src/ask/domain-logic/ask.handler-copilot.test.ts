import type { CallToolResult } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';

import { handleAsk } from './ask.handler';
import { handleHelp } from '../../simple-tools';
import type { AskToolArgs } from '../common';
import { createFakeCopilotContext, isStringArray, uniqueCopilotSessionId } from '../test/utils/fake-copilot.spec.util';
import { readFirstText } from '../test/utils/text-content.spec.util';

type SessionArgv = {
  readonly first: string[];
  readonly followUp: string[];
};

const ARGV_LINE_PREFIX = 'argv: ';
const SESSION_ID_FLAG_PATTERN = /^--session-id=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const readArgv = (result: CallToolResult): string[] => {
  const lines = readFirstText(result).split('\n');
  const argvLine = lines.find((line) => line.startsWith(ARGV_LINE_PREFIX)) ?? `${ARGV_LINE_PREFIX}[]`;
  const parsed: unknown = JSON.parse(argvLine.slice(ARGV_LINE_PREFIX.length));

  if (!isStringArray(parsed)) throw new Error(`fake copilot printed no argv: ${readFirstText(result)}`);

  return parsed;
};

const readFlagValue = (argv: string[], flag: string): string | undefined => {
  const index = argv.indexOf(flag);

  if (index < 0) return;

  const value = argv[index + 1];

  return value;
};

const askTwiceInOneSession = async (): Promise<SessionArgv> => {
  const context = await createFakeCopilotContext();
  const sessionId = uniqueCopilotSessionId();
  const firstArgs: AskToolArgs = { prompt: 'remember the word teal', session_id: sessionId };
  const followUpArgs: AskToolArgs = { prompt: 'which word?', session_id: sessionId };
  const firstResult = await handleAsk(context, firstArgs);
  const followUpResult = await handleAsk(context, followUpArgs);
  const sessionArgv: SessionArgv = { first: readArgv(firstResult), followUp: readArgv(followUpResult) };

  return sessionArgv;
};

describe('FEATURE: copilot native session resume against a fake copilot CLI', () => {
  describe('GIVEN the bundled copilot config and two asks in one session', () => {
    it('WHEN the first ask runs THEN copilot gets one --session-id=<uuid> argument', async () => {
      const { first } = await askTwiceInOneSession();

      const sessionIdArgs = first.filter((arg) => arg.startsWith('--session-id'));

      expect(sessionIdArgs).toHaveLength(1);
      expect(sessionIdArgs[0]).toMatch(SESSION_ID_FLAG_PATTERN);
    });

    it('WHEN the first ask runs THEN copilot gets no --resume argument', async () => {
      const { first } = await askTwiceInOneSession();

      expect(first).not.toContain('--resume');
    });

    it('WHEN the follow-up runs THEN copilot resumes the same uuid', async () => {
      const { first, followUp } = await askTwiceInOneSession();

      const startedId = first.find((arg) => arg.startsWith('--session-id='))?.slice('--session-id='.length);

      expect(followUp.slice(-2)).toStrictEqual(['--resume', startedId]);
    });

    it('WHEN the follow-up runs THEN the prompt is only the new turn, not a replay', async () => {
      const { followUp } = await askTwiceInOneSession();

      expect(readFlagValue(followUp, '-p')).toBe('which word?');
    });

    it('WHEN the follow-up runs THEN copilot gets no --session-id argument', async () => {
      const { followUp } = await askTwiceInOneSession();

      const sessionIdArgs = followUp.filter((arg) => arg.startsWith('--session-id'));

      expect(sessionIdArgs).toStrictEqual([]);
    });
  });

  it('GIVEN the bundled copilot config WHEN help_copilot runs THEN it reports native resume', async () => {
    const context = await createFakeCopilotContext();

    const result = await handleHelp(context);

    expect(readFirstText(result)).toBe(
      'Usage: copilot [options]\n\nagentic-mcp sessions: native resume. A new session starts with an id ' +
        'agentic-mcp generates (--session-id=<id>); follow-ups resume it (--resume <id>).'
    );
  });
});
