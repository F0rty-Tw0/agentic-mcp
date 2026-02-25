import { MAX_RESPONSE_TEXT_BYTES } from '../common';

export const buildCappedOutput = (output: string): string => {
  const outputBytes = Buffer.byteLength(output, 'utf8');

  if (outputBytes <= MAX_RESPONSE_TEXT_BYTES) return output;

  return `${Buffer.from(output, 'utf8').subarray(0, MAX_RESPONSE_TEXT_BYTES).toString('utf8')}\n\n[output truncated — ${outputBytes} bytes total]`;
};
