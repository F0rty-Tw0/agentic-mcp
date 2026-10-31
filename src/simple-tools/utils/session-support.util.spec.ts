import { describe, expect, it } from 'vitest';

import { describeSessionSupport } from './session-support.util';
import type { CommandDef, ProviderConfig } from '../../shared/provider/common';
import { SIMPLE_TOOLS_PROVIDER_CONFIG_STUB } from '../test/stubs/simple-tools.stub';

const buildConfig = (flags?: CommandDef['flags']): ProviderConfig => {
  const sessions: CommandDef = { flags };
  const commands: ProviderConfig['commands'] = { ...SIMPLE_TOOLS_PROVIDER_CONFIG_STUB.commands, sessions };
  const result: ProviderConfig = { ...SIMPLE_TOOLS_PROVIDER_CONFIG_STUB, commands };

  return result;
};

describe('FEATURE: session support description', () => {
  it('GIVEN a provider without a sessions command WHEN described THEN returns undefined', () => {
    const result = describeSessionSupport(SIMPLE_TOOLS_PROVIDER_CONFIG_STUB);

    expect(result).toBeUndefined();
  });

  it('GIVEN a sessions command without flags WHEN described THEN reports prompt replay', () => {
    const config = buildConfig();

    const result = describeSessionSupport(config);

    expect(result).toBe('agentic-mcp sessions: prior turns are replayed in the prompt.');
  });

  it('GIVEN a resume flag without a startWithId flag WHEN described THEN reports resume only when the CLI reports an id', () => {
    const config = buildConfig({ resume: ['--resume'] });

    const result = describeSessionSupport(config);

    expect(result).toBe(
      'agentic-mcp sessions: native resume (--resume <id>) when the CLI reports a session id; ' +
        'otherwise prior turns are replayed in the prompt.'
    );
  });

  it('GIVEN a startWithId flag without a resume flag WHEN described THEN reports prompt replay', () => {
    const config = buildConfig({ startWithId: '--session-id=' });

    const result = describeSessionSupport(config);

    expect(result).toBe('agentic-mcp sessions: prior turns are replayed in the prompt.');
  });

  it('GIVEN resume and startWithId flags WHEN described THEN reports native resume with both argument shapes', () => {
    const config = buildConfig({ resume: ['--resume'], startWithId: '--session-id=' });

    const result = describeSessionSupport(config);

    expect(result).toBe(
      'agentic-mcp sessions: native resume. A new session starts with an id agentic-mcp generates ' +
        '(--session-id=<id>); follow-ups resume it (--resume <id>).'
    );
  });
});
