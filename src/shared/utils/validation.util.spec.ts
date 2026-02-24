import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  validateFiles,
  validateModel,
  validatePromptSize,
  validateSessionId,
  validateWorkingDirectory,
} from './validation.util.ts';
import { ValidationError } from '../common/errors/index.ts';
import { MAX_FILES, MAX_PROMPT_BYTES } from '../common/index.ts';

describe('validateModel', () => {
  it('GIVEN valid simple model WHEN validated THEN does not throw', () => {
    expect(() => validateModel('gpt-4')).not.toThrow();
  });

  it('GIVEN valid model with dots and colons WHEN validated THEN does not throw', () => {
    expect(() => validateModel('claude-opus-4-20250514')).not.toThrow();
  });

  it('GIVEN valid model with slashes WHEN validated THEN does not throw', () => {
    expect(() => validateModel('org/model-name')).not.toThrow();
  });

  it('GIVEN valid model with all allowed chars WHEN validated THEN does not throw', () => {
    expect(() => validateModel('a0._:-/bC')).not.toThrow();
  });

  it('GIVEN single alphanumeric char WHEN validated THEN does not throw', () => {
    expect(() => validateModel('x')).not.toThrow();
  });

  it('GIVEN model starting with digit WHEN validated THEN does not throw', () => {
    expect(() => validateModel('4o-mini')).not.toThrow();
  });

  it('GIVEN empty string WHEN validated THEN throws ValidationError', () => {
    expect(() => validateModel('')).toThrow(ValidationError);
  });

  it('GIVEN model starting with dot WHEN validated THEN throws ValidationError', () => {
    expect(() => validateModel('.model')).toThrow(ValidationError);
  });

  it('GIVEN model starting with dash WHEN validated THEN throws ValidationError', () => {
    expect(() => validateModel('-model')).toThrow(ValidationError);
  });

  it('GIVEN model with spaces WHEN validated THEN throws ValidationError', () => {
    expect(() => validateModel('gpt 4')).toThrow(ValidationError);
  });

  it('GIVEN model exceeding 128 chars WHEN validated THEN throws ValidationError', () => {
    const longModel = `a${'b'.repeat(128)}`;

    expect(() => validateModel(longModel)).toThrow(ValidationError);
  });

  it('GIVEN model at exactly 128 chars WHEN validated THEN does not throw', () => {
    const model = `a${'b'.repeat(127)}`;

    expect(() => validateModel(model)).not.toThrow();
  });

  it('GIVEN model with special chars WHEN validated THEN throws ValidationError', () => {
    expect(() => validateModel('model@v1')).toThrow(ValidationError);
  });
});

describe('validateSessionId', () => {
  it('GIVEN valid alphanumeric session ID WHEN validated THEN does not throw', () => {
    expect(() => validateSessionId('abc123')).not.toThrow();
  });

  it('GIVEN valid session ID with dots and dashes WHEN validated THEN does not throw', () => {
    expect(() => validateSessionId('session.2024-01-01')).not.toThrow();
  });

  it('GIVEN valid session ID with colons WHEN validated THEN does not throw', () => {
    expect(() => validateSessionId('s:123:456')).not.toThrow();
  });

  it('GIVEN single alphanumeric char WHEN validated THEN does not throw', () => {
    expect(() => validateSessionId('x')).not.toThrow();
  });

  it('GIVEN empty string WHEN validated THEN throws ValidationError', () => {
    expect(() => validateSessionId('')).toThrow(ValidationError);
  });

  it('GIVEN session ID starting with dot WHEN validated THEN throws ValidationError', () => {
    expect(() => validateSessionId('.session')).toThrow(ValidationError);
  });

  it('GIVEN session ID starting with dash WHEN validated THEN throws ValidationError', () => {
    expect(() => validateSessionId('-session')).toThrow(ValidationError);
  });

  it('GIVEN session ID with spaces WHEN validated THEN throws ValidationError', () => {
    expect(() => validateSessionId('my session')).toThrow(ValidationError);
  });

  it('GIVEN session ID exceeding 64 chars WHEN validated THEN throws ValidationError', () => {
    const longId = `a${'b'.repeat(64)}`;

    expect(() => validateSessionId(longId)).toThrow(ValidationError);
  });

  it('GIVEN session ID at exactly 64 chars WHEN validated THEN does not throw', () => {
    const id = `a${'b'.repeat(63)}`;

    expect(() => validateSessionId(id)).not.toThrow();
  });

  it('GIVEN session ID with slashes WHEN validated THEN throws ValidationError', () => {
    expect(() => validateSessionId('a/b')).toThrow(ValidationError);
  });
});

describe('validatePromptSize', () => {
  it('GIVEN valid short prompt WHEN validated THEN does not throw', () => {
    expect(() => validatePromptSize('Hello, world!')).not.toThrow();
  });

  it('GIVEN prompt at exactly MAX_PROMPT_BYTES WHEN validated THEN does not throw', () => {
    const prompt = 'a'.repeat(MAX_PROMPT_BYTES);

    expect(() => validatePromptSize(prompt)).not.toThrow();
  });

  it('GIVEN prompt exceeding MAX_PROMPT_BYTES WHEN validated THEN throws ValidationError', () => {
    const prompt = 'a'.repeat(MAX_PROMPT_BYTES + 1);

    expect(() => validatePromptSize(prompt)).toThrow(ValidationError);
  });

  it('GIVEN prompt exceeding limit WHEN validated THEN error message includes byte count', () => {
    const prompt = 'a'.repeat(MAX_PROMPT_BYTES + 1);

    expect(() => validatePromptSize(prompt)).toThrow(/bytes/);
  });

  it('GIVEN undefined prompt WHEN validated THEN throws ValidationError', () => {
    expect(() => validatePromptSize(undefined)).toThrow(ValidationError);
  });

  it('GIVEN undefined prompt WHEN validated THEN error mentions "required"', () => {
    expect(() => validatePromptSize(undefined)).toThrow(/required/i);
  });

  it('GIVEN empty string prompt WHEN validated THEN throws ValidationError', () => {
    expect(() => validatePromptSize('')).toThrow(ValidationError);
  });

  it('GIVEN multi-byte unicode prompt near limit WHEN validated THEN counts bytes not chars', () => {
    // Each emoji is 4 bytes in UTF-8
    const charCount = Math.floor(MAX_PROMPT_BYTES / 4);
    const prompt = '\u{1F600}'.repeat(charCount);

    expect(() => validatePromptSize(prompt)).not.toThrow();
  });

  it('GIVEN multi-byte unicode prompt over limit WHEN validated THEN throws ValidationError', () => {
    // Each emoji is 4 bytes — exceed limit with fewer chars than bytes
    const charCount = Math.floor(MAX_PROMPT_BYTES / 4) + 1;
    const prompt = '\u{1F600}'.repeat(charCount);

    expect(() => validatePromptSize(prompt)).toThrow(ValidationError);
  });
});

describe('validateWorkingDirectory', () => {
  it('GIVEN absolute path WHEN validated THEN returns the same resolved path', () => {
    const dir = path.resolve('/some/absolute/path');

    const result = validateWorkingDirectory(dir);

    expect(result).toBe(dir);
  });

  it('GIVEN relative path WHEN validated THEN returns an absolute resolved path', () => {
    const result = validateWorkingDirectory('relative/path');

    expect(path.isAbsolute(result)).toBe(true);
  });

  it('GIVEN path with .. segments WHEN validated THEN returns resolved path without ..', () => {
    const result = validateWorkingDirectory('/foo/bar/../baz');

    expect(result).not.toContain('..');
    expect(result).toBe(path.resolve('/foo/baz'));
  });

  it('GIVEN path with . segment WHEN validated THEN returns resolved path', () => {
    const result = validateWorkingDirectory('/foo/./bar');

    expect(result).toBe(path.resolve('/foo/bar'));
  });
});

describe('validateFiles', () => {
  const workingDir = path.resolve('/project');

  it('GIVEN empty file list WHEN validated THEN returns empty array', () => {
    const result = validateFiles([], workingDir);

    expect(result).toStrictEqual([]);
  });

  it('GIVEN single relative file WHEN validated THEN returns resolved absolute path', () => {
    const result = validateFiles(['src/index.ts'], workingDir);

    expect(result).toStrictEqual([path.resolve(workingDir, 'src/index.ts')]);
  });

  it('GIVEN multiple files WHEN validated THEN returns all resolved paths', () => {
    const files = ['a.ts', 'b.ts', 'c.ts'];

    const result = validateFiles(files, workingDir);

    expect(result).toHaveLength(3);
    result.forEach((resolved) => {
      expect(path.isAbsolute(resolved)).toBe(true);
    });
  });

  it('GIVEN files at exactly MAX_FILES WHEN validated THEN does not throw', () => {
    const files = Array.from({ length: MAX_FILES }, (_, i) => `file${i}.ts`);

    expect(() => validateFiles(files, workingDir)).not.toThrow();
  });

  it('GIVEN files exceeding MAX_FILES WHEN validated THEN throws ValidationError', () => {
    const files = Array.from({ length: MAX_FILES + 1 }, (_, i) => `file${i}.ts`);

    expect(() => validateFiles(files, workingDir)).toThrow(ValidationError);
  });

  it('GIVEN files exceeding limit WHEN validated THEN error message includes count', () => {
    const files = Array.from({ length: MAX_FILES + 1 }, (_, i) => `file${i}.ts`);

    expect(() => validateFiles(files, workingDir)).toThrow(new RegExp(String(MAX_FILES + 1)));
  });

  it('GIVEN file path traversing above working dir WHEN validated THEN throws ValidationError', () => {
    expect(() => validateFiles(['../../etc/passwd'], workingDir)).toThrow(ValidationError);
  });

  it('GIVEN file path escaping via .. WHEN validated THEN error mentions "escapes"', () => {
    expect(() => validateFiles(['../outside.txt'], workingDir)).toThrow(/escapes/i);
  });

  it('GIVEN file path within working dir using .. WHEN validated THEN resolves correctly', () => {
    const result = validateFiles(['src/../lib/util.ts'], workingDir);

    expect(result).toStrictEqual([path.resolve(workingDir, 'lib/util.ts')]);
  });

  it('GIVEN absolute file path inside working dir WHEN validated THEN returns it resolved', () => {
    const absFile = path.join(workingDir, 'src/file.ts');

    const result = validateFiles([absFile], workingDir);

    expect(result).toStrictEqual([path.resolve(workingDir, 'src/file.ts')]);
  });

  it('GIVEN absolute file path outside working dir WHEN validated THEN throws ValidationError', () => {
    const outsideFile = path.resolve('/other/project/file.ts');

    expect(() => validateFiles([outsideFile], workingDir)).toThrow(ValidationError);
  });

  describe.runIf(process.platform === 'win32')('windows paths', () => {
    const winDir = 'C:\\project';

    it('GIVEN backslash relative path WHEN validated THEN resolves correctly', () => {
      const result = validateFiles(['src\\index.ts'], winDir);

      expect(result).toStrictEqual([path.resolve(winDir, 'src\\index.ts')]);
    });

    it('GIVEN mixed separators WHEN validated THEN resolves correctly', () => {
      const result = validateFiles(['src/sub\\file.ts'], winDir);

      expect(result).toStrictEqual([path.resolve(winDir, 'src/sub\\file.ts')]);
    });

    it('GIVEN backslash traversal above working dir WHEN validated THEN throws ValidationError', () => {
      expect(() => validateFiles(['..\\..\\Windows\\System32\\config'], winDir)).toThrow(ValidationError);
    });

    it('GIVEN file on different drive letter WHEN validated THEN throws ValidationError', () => {
      expect(() => validateFiles(['D:\\other\\secret.txt'], winDir)).toThrow(ValidationError);
    });

    it('GIVEN backslash traversal within working dir WHEN validated THEN resolves correctly', () => {
      const result = validateFiles(['src\\..\\lib\\util.ts'], winDir);

      expect(result).toStrictEqual([path.resolve(winDir, 'lib\\util.ts')]);
    });

    it('GIVEN deeply nested backslash path WHEN validated THEN resolves correctly', () => {
      const result = validateFiles(['src\\components\\ui\\Button.tsx'], winDir);

      expect(result).toStrictEqual([path.resolve(winDir, 'src\\components\\ui\\Button.tsx')]);
    });
  });
});
