import { describe, expect, it } from 'vitest';

import { HELP_TEXT } from './help-text.const';

describe('HELP_TEXT', () => {
  it('GIVEN CLI help WHEN rendered THEN ping wording stays truthful', () => {
    expect(HELP_TEXT).toContain('Check limited provider proof');
  });

  it('GIVEN CLI help WHEN rendered THEN it mentions review provider commands', () => {
    expect(HELP_TEXT).toContain('review_<provider>');
  });

  it('GIVEN CLI help WHEN rendered THEN provider_metrics wording reflects real usage feedback', () => {
    expect(HELP_TEXT).toContain('Show which providers you actually used');
  });

  it('GIVEN CLI help WHEN rendered THEN it mentions the prove command', () => {
    expect(HELP_TEXT).toContain('prove');
  });

  it('GIVEN CLI help WHEN rendered THEN it mentions the ask_all report option', () => {
    expect(HELP_TEXT).toContain('--report <path>');
  });
});
