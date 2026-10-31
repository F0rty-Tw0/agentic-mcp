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
  it('GIVEN https_proxy set to null WHEN building minimal env THEN both spellings of the proxy variable are removed', () => {
    vi.stubEnv('HTTPS_PROXY', 'http://user:pass@corp:3128');
    vi.stubEnv('https_proxy', 'http://user:pass@corp:3128');

    const env = buildMinimalEnv({ https_proxy: null });
    const keys = Object.keys(env);

    expect(keys).not.toContain('HTTPS_PROXY');
    expect(keys).not.toContain('https_proxy');
  });

  it('GIVEN a lowercase proxy override WHEN building minimal env THEN the parent uppercase value is not kept beside it', () => {
    vi.stubEnv('HTTP_PROXY', 'http://parent:3128');

    const env = buildMinimalEnv({ http_proxy: 'http://config:3128' });

    expect(env.http_proxy).toBe('http://config:3128');
    expect('HTTP_PROXY' in env).toBe(false);
  });
});
