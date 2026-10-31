import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildMinimalEnv } from './platform';

describe('buildMinimalEnv network and identity keys', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(['HTTPS_PROXY', 'https_proxy', 'NO_PROXY', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'USER', 'TERM'])(
    'GIVEN %s in process.env WHEN building minimal env THEN the provider CLI gets it',
    (key) => {
      vi.stubEnv(key, 'value-from-parent');

      const env = buildMinimalEnv({});

      expect(env[key]).toBe('value-from-parent');
    }
  );

  it('GIVEN a provider env key set to null WHEN building minimal env THEN the inherited variable is removed', () => {
    vi.stubEnv('LANG', 'en_US.UTF-8');

    const env = buildMinimalEnv({ LANG: null });

    expect('LANG' in env).toBe(false);
  });
});
