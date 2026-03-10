import { describe, expect, it } from 'vitest';

import { buildSessionPrompt } from './session-context.util';

describe('buildSessionPrompt', () => {
  it('GIVEN empty sessionTurnsText and no userContext WHEN buildSessionPrompt called THEN returns only current request', () => {
    const result = buildSessionPrompt({ sessionTurnsText: '', prompt: 'What is 2+2?' });

    expect(result).toBe('Current request:\nWhat is 2+2?');
  });

  it('GIVEN non-empty sessionTurnsText WHEN buildSessionPrompt called THEN includes "Previous context:" section', () => {
    const result = buildSessionPrompt({ sessionTurnsText: 'Turn 1 content', prompt: 'Follow up question' });

    expect(result).toBe('Previous context:\nTurn 1 content\n\nCurrent request:\nFollow up question');
  });

  it('GIVEN non-empty userContext WHEN buildSessionPrompt called THEN includes "Additional context:" section', () => {
    const result = buildSessionPrompt({ sessionTurnsText: '', userContext: 'Extra info', prompt: 'New question' });

    expect(result).toBe('Additional context:\nExtra info\n\nCurrent request:\nNew question');
  });

  it('GIVEN all three parts present WHEN buildSessionPrompt called THEN joins with double newline separators', () => {
    const result = buildSessionPrompt({
      sessionTurnsText: 'Prior turns',
      userContext: 'Extra info',
      prompt: 'New question',
    });

    expect(result).toBe(
      'Previous context:\nPrior turns\n\nAdditional context:\nExtra info\n\nCurrent request:\nNew question'
    );
  });

  it('GIVEN empty string userContext WHEN buildSessionPrompt called THEN omits additional context section', () => {
    const result = buildSessionPrompt({ sessionTurnsText: 'Some turns', userContext: '', prompt: 'A question' });

    expect(result).toBe('Previous context:\nSome turns\n\nCurrent request:\nA question');
  });

  it('GIVEN sessionTurnsText and userContext and prompt WHEN called THEN order is previous, additional, current', () => {
    const result = buildSessionPrompt({
      sessionTurnsText: 'turn A',
      userContext: 'ctx B',
      prompt: 'req C',
    });
    const previousIndex = result.indexOf('Previous context:');
    const additionalIndex = result.indexOf('Additional context:');
    const currentIndex = result.indexOf('Current request:');

    expect(previousIndex).toBeLessThan(additionalIndex);
    expect(additionalIndex).toBeLessThan(currentIndex);
  });

  it('GIVEN empty sessionTurnsText and present userContext WHEN called THEN includes additional and current only', () => {
    const result = buildSessionPrompt({ sessionTurnsText: '', userContext: 'Some context', prompt: 'A question' });

    expect(result).toBe('Additional context:\nSome context\n\nCurrent request:\nA question');
  });
});
