import { describe, expect, it, vi } from 'vitest';

import { parseSetupArgs } from './setup-cli-args.util.ts';

describe('parseSetupArgs', () => {
  it('GIVEN no flags WHEN parsing setup args THEN returns default values', () => {
    const stderrWrite = vi.fn<(text: string) => void>();

    const result = parseSetupArgs({ args: [], stderrWrite });

    expect(result).toStrictEqual({
      client: 'generic',
      dryRun: false,
      yes: false,
      output: 'human',
      mode: 'merge',
      pathOverride: undefined,
      backup: 'if-exists',
    });
    expect(stderrWrite).not.toHaveBeenCalled();
  });

  it('GIVEN all supported flags WHEN parsing setup args THEN maps every value correctly', () => {
    const stderrWrite = vi.fn<(text: string) => void>();

    const result = parseSetupArgs({
      args: [
        '--client',
        'cursor',
        '--output',
        'json',
        '--mode',
        'overwrite',
        '--path',
        '/tmp/custom.json',
        '--backup',
        'always',
        '--dry-run',
        '--yes',
      ],
      stderrWrite,
    });

    expect(result).toStrictEqual({
      client: 'cursor',
      dryRun: true,
      yes: true,
      output: 'json',
      mode: 'overwrite',
      pathOverride: '/tmp/custom.json',
      backup: 'always',
    });
    expect(stderrWrite).not.toHaveBeenCalled();
  });

  it('GIVEN unknown value flags WHEN parsing setup args THEN warns and keeps defaults', () => {
    const stderrWrite = vi.fn<(text: string) => void>();

    const result = parseSetupArgs({
      args: ['--client', 'unknown-client', '--output', 'xml', '--mode', 'replace', '--backup', 'sometimes'],
      stderrWrite,
    });

    expect(result).toStrictEqual({
      client: 'generic',
      dryRun: false,
      yes: false,
      output: 'human',
      mode: 'merge',
      pathOverride: undefined,
      backup: 'if-exists',
    });
    expect(stderrWrite).toHaveBeenCalledWith('Warning: unknown client "unknown-client", using "generic"\n');
    expect(stderrWrite).toHaveBeenCalledWith('Warning: unknown output mode "xml", using "human"\n');
    expect(stderrWrite).toHaveBeenCalledWith('Warning: unknown mode "replace", using "merge"\n');
    expect(stderrWrite).toHaveBeenCalledWith('Warning: unknown backup policy "sometimes", using "if-exists"\n');
  });

  it('GIVEN value flag followed by another flag WHEN parsing setup args THEN treats next token as its value', () => {
    const stderrWrite = vi.fn<(text: string) => void>();

    const result = parseSetupArgs({
      args: ['--client', '--yes'],
      stderrWrite,
    });

    expect(result).toStrictEqual({
      client: 'generic',
      dryRun: false,
      yes: false,
      output: 'human',
      mode: 'merge',
      pathOverride: undefined,
      backup: 'if-exists',
    });
    expect(stderrWrite).toHaveBeenCalledWith('Warning: unknown client "--yes", using "generic"\n');
  });
});
