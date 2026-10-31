import type { Readable } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

import { MAX_OUTPUT_BYTES } from '../common';
import type { StreamChunkCallback, StreamCollector } from '../common';

type CollectStreamResult = { readonly bytes: number; readonly truncated: boolean };

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

const emitDecodedText = (text: string, onChunk?: StreamChunkCallback): void => {
  if (!onChunk || text.length === 0) return;

  try {
    onChunk(text);
  } catch {
    /* empty */
  }
};

export const attachStreamCollector = (stream: Readable | null, onChunk?: StreamChunkCallback): StreamCollector => {
  const chunks: Buffer[] = [];
  const decoder = new StringDecoder('utf-8');
  let currentBytes = 0;
  let isTruncated = false;

  stream?.on('data', (chunk: Buffer) => {
    const result = collectStream(chunks, chunk, currentBytes);

    currentBytes = result.bytes;

    if (result.truncated) isTruncated = true;

    emitDecodedText(decoder.write(chunk), onChunk);
  });

  stream?.on('end', () => {
    emitDecodedText(decoder.end(), onChunk);
  });

  const streamCollector: StreamCollector = {
    output: () => Buffer.concat(chunks).toString('utf-8'),
    bytes: () => currentBytes,
    truncated: () => isTruncated,
  };

  return streamCollector;
};
