import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { attachStreamCollector } from './command-stream-collector.util';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

describe('attachStreamCollector', () => {
  describe('basic collection', () => {
    it('GIVEN a stream emitting data WHEN collected THEN output contains the data', () => {
      const stream = new PassThrough();
      const collector = attachStreamCollector(stream);

      stream.emit('data', Buffer.from('hello'));

      expect(collector.output()).toBe('hello');
      expect(collector.bytes()).toBe(5);
      expect(collector.truncated()).toBe(false);
    });

    it('GIVEN multiple chunks WHEN collected THEN output is concatenated', () => {
      const stream = new PassThrough();
      const collector = attachStreamCollector(stream);

      stream.emit('data', Buffer.from('hello '));
      stream.emit('data', Buffer.from('world'));

      expect(collector.output()).toBe('hello world');
      expect(collector.bytes()).toBe(11);
      expect(collector.truncated()).toBe(false);
    });

    it('GIVEN a null stream WHEN attached THEN collector returns empty defaults', () => {
      const collector = attachStreamCollector(null);

      expect(collector.output()).toBe('');
      expect(collector.bytes()).toBe(0);
      expect(collector.truncated()).toBe(false);
    });
  });

  describe('truncation', () => {
    it('GIVEN output exceeding MAX_OUTPUT_BYTES WHEN collected THEN output is truncated preserving partial chunk at boundary', () => {
      const stream = new PassThrough();
      const collector = attachStreamCollector(stream);

      const firstChunkSize = MAX_OUTPUT_BYTES - 100;

      stream.emit('data', Buffer.alloc(firstChunkSize, 'a'));
      stream.emit('data', Buffer.alloc(200, 'b'));

      expect(collector.truncated()).toBe(true);
      expect(collector.bytes()).toBe(MAX_OUTPUT_BYTES);
      expect(collector.output()).toHaveLength(MAX_OUTPUT_BYTES);
      expect(collector.output().slice(-100)).toBe('b'.repeat(100));
      expect(collector.output()[firstChunkSize - 1]).toBe('a');
    });

    it('GIVEN a single chunk exceeding MAX_OUTPUT_BYTES WHEN collected THEN truncated flag is set', () => {
      const stream = new PassThrough();
      const collector = attachStreamCollector(stream);

      stream.emit('data', Buffer.alloc(MAX_OUTPUT_BYTES + 1, 'x'));

      expect(collector.truncated()).toBe(true);
      expect(collector.bytes()).toBe(MAX_OUTPUT_BYTES);
    });

    it('GIVEN output exactly at MAX_OUTPUT_BYTES WHEN collected THEN truncated is false', () => {
      const stream = new PassThrough();
      const collector = attachStreamCollector(stream);

      stream.emit('data', Buffer.alloc(MAX_OUTPUT_BYTES, 'a'));

      expect(collector.truncated()).toBe(false);
      expect(collector.bytes()).toBe(MAX_OUTPUT_BYTES);
    });
  });

  describe('onChunk callback', () => {
    it('GIVEN an onChunk callback WHEN data arrives THEN callback receives utf-8 string', () => {
      const stream = new PassThrough();
      const onChunk = vi.fn();
      const collector = attachStreamCollector(stream, onChunk);

      stream.emit('data', Buffer.from('hello'));

      expect(onChunk).toHaveBeenCalledWith('hello');
      expect(collector.output()).toBe('hello');
    });

    it('GIVEN an onChunk callback that throws WHEN data arrives THEN collection continues without error', () => {
      const stream = new PassThrough();
      const onChunk = vi.fn().mockImplementation(() => {
        throw new Error('callback error');
      });

      const collector = attachStreamCollector(stream, onChunk);

      stream.emit('data', Buffer.from('hello'));
      stream.emit('data', Buffer.from(' world'));

      expect(collector.output()).toBe('hello world');
      expect(onChunk).toHaveBeenCalledTimes(2);
    });
  });
});
