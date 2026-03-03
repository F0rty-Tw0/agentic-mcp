import type { Readable } from 'node:stream';

import type { StreamChunkCallback, StreamCollector } from '../common';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

type CollectStreamResult = Readonly<{ bytes: number; truncated: boolean }>;

const collectStream = (chunks: Buffer[], chunk: Buffer, currentBytes: number): CollectStreamResult => {
  const newBytes = currentBytes + chunk.length;

  if (newBytes <= MAX_OUTPUT_BYTES) {
    chunks.push(chunk);

    const streamResults: CollectStreamResult = { bytes: newBytes, truncated: false };

    return streamResults;
  }

  const remaining = MAX_OUTPUT_BYTES - currentBytes;

  if (remaining > 0) chunks.push(chunk.subarray(0, remaining));

  const streamResults: CollectStreamResult = { bytes: currentBytes + remaining, truncated: true };

  return streamResults;
};

export const attachStreamCollector = (stream: Readable | null, onChunk?: StreamChunkCallback): StreamCollector => {
  const chunks: Buffer[] = [];
  let currentBytes = 0;
  let isTruncated = false;

  stream?.on('data', (chunk: Buffer) => {
    const result = collectStream(chunks, chunk, currentBytes);

    currentBytes = result.bytes;

    if (result.truncated) isTruncated = true;

    if (onChunk) {
      try {
        onChunk(chunk.toString('utf-8'));
      } catch {
        // callback errors are non-fatal for command lifecycle
      }
    }
  });

  const streamCollector: StreamCollector = {
    output: () => Buffer.concat(chunks).toString('utf-8'),
    bytes: () => currentBytes,
    truncated: () => isTruncated,
  };

  return streamCollector;
};
