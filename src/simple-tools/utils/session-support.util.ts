import { buildNativeSessionArgs, buildStartSessionArgs, canStartNativeSession } from '../../ask/utils';
import type { ProviderConfig } from '../../shared/provider/common';

const SESSION_ID_PLACEHOLDER = '<id>';
const REPLAY_TEXT = 'prior turns are replayed in the prompt';

export const describeSessionSupport = (config: ProviderConfig): string | undefined => {
  if (!config.commands.sessions) return;

  const resumeText = buildNativeSessionArgs(config, SESSION_ID_PLACEHOLDER).join(' ');
  const canStart = canStartNativeSession(config, SESSION_ID_PLACEHOLDER);

  if (canStart) {
    const startText = buildStartSessionArgs(config, SESSION_ID_PLACEHOLDER).join(' ');
    const nativeText =
      `agentic-mcp sessions: native resume. A new session starts with an id agentic-mcp generates ` +
      `(${startText}); follow-ups resume it (${resumeText}).`;

    return nativeText;
  }

  const replayText = `agentic-mcp sessions: ${REPLAY_TEXT}.`;

  if (!resumeText) return replayText;

  const reportedIdText = `agentic-mcp sessions: native resume (${resumeText}) when the CLI reports a session id; otherwise ${REPLAY_TEXT}.`;

  return reportedIdText;
};
